package app

import (
	"context"
	"errors"
	"net"
	"strings"
	"syscall"
	"testing"

	"gowails/pkg/app/holmesgpt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestHolmesClientConfigAndEndpoints(t *testing.T) {
	cfg := holmesgpt.HolmesConfigData{
		Endpoint:       "https://example.com",
		APIKey:         "key",
		ModelKey:       "model",
		ResponseFormat: `{"type":"json_object"}`,
	}
	clientCfg := buildHolmesClientConfig(cfg, nil)
	if clientCfg.Endpoint != cfg.Endpoint || clientCfg.APIKey != cfg.APIKey || clientCfg.ModelKey != cfg.ModelKey {
		t.Fatalf("buildHolmesClientConfig mismatch: %+v", clientCfg)
	}
	if len(clientCfg.ResponseFormat) == 0 {
		t.Fatal("buildHolmesClientConfig expected ResponseFormat to be set")
	}

	if !isLocalHolmesEndpoint("http://localhost:8080") {
		t.Fatal("expected localhost endpoint to be local")
	}
	if !isLocalHolmesEndpoint("http://127.0.0.1:8080") {
		t.Fatal("expected loopback endpoint to be local")
	}
	if !isLocalHolmesEndpoint("http://[::1]:8080") {
		t.Fatal("expected IPv6 loopback endpoint to be local")
	}
	if isLocalHolmesEndpoint("https://holmesgpt.svc.cluster.local") {
		t.Fatal("expected cluster endpoint to be non-local")
	}
}

func TestHolmesErrorHelpers(t *testing.T) {
	if isConnectionRefused(nil) {
		t.Fatal("isConnectionRefused should be false for nil error")
	}
	if !isConnectionRefused(syscall.ECONNREFUSED) {
		t.Fatal("isConnectionRefused should detect syscall ECONNREFUSED")
	}
	if !isConnectionRefused(&net.OpError{Err: syscall.ECONNREFUSED}) {
		t.Fatal("isConnectionRefused should detect net.OpError")
	}
	if !isConnectionRefused(errors.New("connection refused by host")) {
		t.Fatal("isConnectionRefused should detect message fallback")
	}

	if isTimeoutError(nil) {
		t.Fatal("isTimeoutError should be false for nil error")
	}
	if !isTimeoutError(context.DeadlineExceeded) {
		t.Fatal("isTimeoutError should detect context deadline")
	}
	if !isTimeoutError(&net.DNSError{IsTimeout: true}) {
		t.Fatal("isTimeoutError should detect net timeout")
	}
	if !isTimeoutError(errors.New("request timeout")) {
		t.Fatal("isTimeoutError should detect timeout message")
	}
}

func TestHolmesEndpointParsing(t *testing.T) {
	if !isInClusterEndpoint("https://holmesgpt.ns.svc.cluster.local") {
		t.Fatal("isInClusterEndpoint should detect cluster DNS")
	}
	if isInClusterEndpoint("https://example.com") {
		t.Fatal("isInClusterEndpoint should be false for non-cluster")
	}

	if !isKubeProxyEndpoint("https://127.0.0.1:6443/api/v1/namespaces/test/services/http:holmesgpt:8080/proxy") {
		t.Fatal("isKubeProxyEndpoint should detect proxy URLs")
	}
	if isKubeProxyEndpoint("https://example.com") {
		t.Fatal("isKubeProxyEndpoint should be false for non-proxy")
	}

	if !isHolmesServiceNotFound(errors.New(`services "holmesgpt" not found`)) {
		t.Fatal("isHolmesServiceNotFound should detect service missing error")
	}

	if ns := holmesNamespaceFromEndpoint("http://holmesgpt.demo.svc.cluster.local"); ns != "demo" {
		t.Fatalf("holmesNamespaceFromEndpoint = %q, want demo", ns)
	}
	if ns := holmesNamespaceFromEndpoint("::://bad-url"); ns != holmesDefaultNamespace {
		t.Fatalf("holmesNamespaceFromEndpoint invalid = %q, want default", ns)
	}

	proxyEndpoint := "https://127.0.0.1:6443/api/v1/namespaces/qa/services/http:holmesgpt:8080/proxy"
	if ns := holmesNamespaceFromProxyEndpoint(proxyEndpoint); ns != "qa" {
		t.Fatalf("holmesNamespaceFromProxyEndpoint = %q, want qa", ns)
	}
	if ns := holmesNamespaceFromProxyEndpoint("::://bad-url"); ns != holmesDefaultNamespace {
		t.Fatalf("holmesNamespaceFromProxyEndpoint invalid = %q, want default", ns)
	}
}

func TestHolmesProxyURLAndScoring(t *testing.T) {
	proxy, err := buildHolmesProxyURL("https://127.0.0.1:6443", "", "", 0)
	if err != nil {
		t.Fatalf("buildHolmesProxyURL error: %v", err)
	}
	if !strings.Contains(proxy, "/api/v1/namespaces/"+holmesDefaultNamespace+"/services/http:"+holmesServiceName) {
		t.Fatalf("proxy url missing expected path: %s", proxy)
	}

	svc := corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name: holmesDefaultReleaseName,
			Labels: map[string]string{
				"app.kubernetes.io/instance":  holmesDefaultReleaseName,
				"app.kubernetes.io/name":      "holmesgpt",
				"app.kubernetes.io/component": "api",
			},
		},
		Spec: corev1.ServiceSpec{
			Ports: []corev1.ServicePort{{Name: "http", Port: 8080}},
		},
	}
	if score := scoreServiceLabels(svc); score != 22 {
		t.Fatalf("scoreServiceLabels = %d, want 22", score)
	}
	port, portScore := findBestPort(svc)
	if port != 8080 || portScore != 4 {
		t.Fatalf("findBestPort = %d score %d, want 8080 score 4", port, portScore)
	}

	candidate := scoreHolmesService(svc)
	if candidate.name != svc.Name || candidate.port != 8080 {
		t.Fatalf("scoreHolmesService candidate = %+v", candidate)
	}
	if candidate.score <= 0 {
		t.Fatalf("scoreHolmesService score = %d, want > 0", candidate.score)
	}
}

func TestFindHolmesService(t *testing.T) {
	ns := "holmesgpt"
	ctx := context.Background()
	cs := fake.NewSimpleClientset(
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name: "misc",
				Labels: map[string]string{
					"app.kubernetes.io/name": "other",
				},
			},
			Spec: corev1.ServiceSpec{
				Ports: []corev1.ServicePort{{Name: "web", Port: 9090}},
			},
		},
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name: holmesServiceName,
				Labels: map[string]string{
					"app.kubernetes.io/instance": holmesDefaultReleaseName,
					"app.kubernetes.io/name":     "holmesgpt",
				},
			},
			Spec: corev1.ServiceSpec{
				Ports: []corev1.ServicePort{{Name: "http", Port: 8080}},
			},
		},
	)

	app := newTestAppWithClientset(cs)
	app.ctx = ctx

	name, port, err := app.findHolmesService(ns)
	if err != nil {
		t.Fatalf("findHolmesService error: %v", err)
	}
	if name != holmesServiceName || port != 8080 {
		t.Fatalf("findHolmesService = %s:%d, want %s:8080", name, port, holmesServiceName)
	}

	emptyApp := newTestAppWithClientset(fake.NewSimpleClientset())
	if _, _, err := emptyApp.findHolmesService(ns); err == nil {
		t.Fatal("expected error when no Holmes service is present")
	}
}
