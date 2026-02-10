package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gowails/pkg/app/holmesgpt"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes/fake"
)

func setupHolmesServer(t *testing.T, response string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/chat" {
			json.NewEncoder(w).Encode(holmesgpt.HolmesResponse{Response: response})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	holmesConfig = holmesgpt.HolmesConfigData{Enabled: true, Endpoint: server.URL}
	t.Cleanup(func() {
		server.Close()
		holmesMu.Lock()
		holmesClient = nil
		holmesMu.Unlock()
		holmesConfig = holmesgpt.DefaultConfig()
	})
	return server
}

func TestAnalyzeStatefulSet_WithFakeHolmes(t *testing.T) {
	replicas := int32(2)
	clientset := fake.NewSimpleClientset(
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{Name: "db", Namespace: "default"},
			Spec: appsv1.StatefulSetSpec{
				Replicas:    &replicas,
				ServiceName: "db-svc",
				Selector:    &metav1.LabelSelector{MatchLabels: map[string]string{"app": "db"}},
			},
			Status: appsv1.StatefulSetStatus{ReadyReplicas: 1},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "db-0", Namespace: "default", Labels: map[string]string{"app": "db"}},
			Status:     corev1.PodStatus{Phase: corev1.PodRunning},
		},
	)

	setupHolmesServer(t, "stateful ok")
	app := &App{ctx: context.Background(), testClientset: clientset}
	app.initHolmes()

	resp, err := app.AnalyzeStatefulSet("default", "db")
	if err != nil {
		t.Fatalf("AnalyzeStatefulSet() unexpected error: %v", err)
	}
	if resp.Response != "stateful ok" {
		t.Fatalf("AnalyzeStatefulSet() response = %q, want %q", resp.Response, "stateful ok")
	}
}

func TestAnalyzeDaemonSet_WithFakeHolmes(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.DaemonSet{
			ObjectMeta: metav1.ObjectMeta{Name: "ds", Namespace: "default"},
			Spec: appsv1.DaemonSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "ds"}},
			},
			Status: appsv1.DaemonSetStatus{DesiredNumberScheduled: 1},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "ds-pod", Namespace: "default", Labels: map[string]string{"app": "ds"}},
			Status:     corev1.PodStatus{Phase: corev1.PodRunning},
		},
	)

	setupHolmesServer(t, "daemon ok")
	app := &App{ctx: context.Background(), testClientset: clientset}
	app.initHolmes()

	resp, err := app.AnalyzeDaemonSet("default", "ds")
	if err != nil {
		t.Fatalf("AnalyzeDaemonSet() unexpected error: %v", err)
	}
	if resp.Response != "daemon ok" {
		t.Fatalf("AnalyzeDaemonSet() response = %q, want %q", resp.Response, "daemon ok")
	}
}

func TestAnalyzeService_WithFakeHolmes(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{Name: "svc", Namespace: "default"},
			Spec: corev1.ServiceSpec{
				Type:      corev1.ServiceTypeClusterIP,
				ClusterIP: "10.0.0.1",
				Ports: []corev1.ServicePort{{
					Name:       "http",
					Port:       80,
					TargetPort: intstrFromInt(8080),
				}},
			},
		},
	)

	setupHolmesServer(t, "service ok")
	app := &App{ctx: context.Background(), testClientset: clientset}
	app.initHolmes()

	resp, err := app.AnalyzeService("default", "svc")
	if err != nil {
		t.Fatalf("AnalyzeService() unexpected error: %v", err)
	}
	if resp.Response != "service ok" {
		t.Fatalf("AnalyzeService() response = %q, want %q", resp.Response, "service ok")
	}
}

func TestAnalyzePodLogs_WithFakeHolmes(t *testing.T) {
	setupHolmesServer(t, "logs ok")
	app := &App{
		ctx: context.Background(),
		testPodLogsFetcher: func(namespace, podName, containerName string, lines int) (string, error) {
			return "pod logs", nil
		},
	}
	app.initHolmes()

	resp, err := app.AnalyzePodLogs("default", "pod", 50)
	if err != nil {
		t.Fatalf("AnalyzePodLogs() unexpected error: %v", err)
	}
	if resp.Response != "logs ok" {
		t.Fatalf("AnalyzePodLogs() response = %q, want %q", resp.Response, "logs ok")
	}
}

func TestAnalyzeResource_Routes(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "pod", Namespace: "default"},
			Status:     corev1.PodStatus{Phase: corev1.PodRunning},
		},
	)

	setupHolmesServer(t, "route ok")
	app := &App{ctx: context.Background(), testClientset: clientset}
	app.initHolmes()

	resp, err := app.AnalyzeResource("pod", "default", "pod")
	if err != nil {
		t.Fatalf("AnalyzeResource() unexpected error: %v", err)
	}
	if resp.Response != "route ok" {
		t.Fatalf("AnalyzeResource() response = %q, want %q", resp.Response, "route ok")
	}

	if _, err := app.AnalyzeResource("widget", "default", "pod"); err == nil {
		t.Fatal("AnalyzeResource() expected error for unsupported kind")
	}
}

func intstrFromInt(val int) intstr.IntOrString {
	return intstr.IntOrString{Type: intstr.Int, IntVal: int32(val)}
}
