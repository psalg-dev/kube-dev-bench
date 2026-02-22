package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"gowails/pkg/app/holmesgpt"

	autoscalingv2 "k8s.io/api/autoscaling/v2"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestAnalyzeResource_RoutesNodeAndHPA(t *testing.T) {
	minReplicas := int32(1)
	util := int32(65)
	clientset := fake.NewSimpleClientset(
		&corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "node-a"}},
		&autoscalingv2.HorizontalPodAutoscaler{
			ObjectMeta: metav1.ObjectMeta{Name: "web-hpa", Namespace: "default"},
			Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
				ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{Kind: "Deployment", Name: "web"},
				MinReplicas:    &minReplicas,
				MaxReplicas:    5,
				Metrics: []autoscalingv2.MetricSpec{{
					Type: autoscalingv2.ResourceMetricSourceType,
					Resource: &autoscalingv2.ResourceMetricSource{
						Name: corev1.ResourceCPU,
						Target: autoscalingv2.MetricTarget{
							Type:               autoscalingv2.UtilizationMetricType,
							AverageUtilization: &util,
						},
					},
				}},
			},
		},
	)

	setupHolmesServer(t, "route ok")
	app := &App{ctx: context.Background(), testClientset: clientset}
	app.initHolmes()

	nodeResp, err := app.AnalyzeResource("nodes", "", "node-a")
	if err != nil {
		t.Fatalf("AnalyzeResource(nodes) unexpected error: %v", err)
	}
	if nodeResp.Response != "route ok" {
		t.Fatalf("AnalyzeResource(nodes) response = %q, want %q", nodeResp.Response, "route ok")
	}

	hpaResp, err := app.AnalyzeResource("hpa", "default", "web-hpa")
	if err != nil {
		t.Fatalf("AnalyzeResource(hpa) unexpected error: %v", err)
	}
	if hpaResp.Response != "route ok" {
		t.Fatalf("AnalyzeResource(hpa) response = %q, want %q", hpaResp.Response, "route ok")
	}
}

func TestAnalyzeNodeStream_ContextError(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}

	err := app.AnalyzeNodeStream("missing-node", "stream-node")
	if err == nil {
		t.Fatal("AnalyzeNodeStream expected error for missing node")
	}
	if !strings.Contains(err.Error(), "failed to get node context") {
		t.Fatalf("AnalyzeNodeStream error = %v, want context error", err)
	}
}

func TestAnalyzeHPAStream_ContextError(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}

	err := app.AnalyzeHPAStream("default", "missing-hpa", "stream-hpa")
	if err == nil {
		t.Fatal("AnalyzeHPAStream expected error for missing hpa")
	}
	if !strings.Contains(err.Error(), "failed to get hpa context") {
		t.Fatalf("AnalyzeHPAStream error = %v, want context error", err)
	}
}

func TestAnalyzeResourceStream_RoutesNodeAndHPAErrors(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}

	nodeErr := app.AnalyzeResourceStream("node", "", "missing-node", "sid-node")
	if nodeErr == nil {
		t.Fatal("AnalyzeResourceStream(node) expected context error")
	}
	if !strings.Contains(nodeErr.Error(), "failed to get node context") {
		t.Fatalf("AnalyzeResourceStream(node) error = %v, want node context error", nodeErr)
	}

	hpaErr := app.AnalyzeResourceStream("horizontalpodautoscaler", "default", "missing-hpa", "sid-hpa")
	if hpaErr == nil {
		t.Fatal("AnalyzeResourceStream(hpa) expected context error")
	}
	if !strings.Contains(hpaErr.Error(), "failed to get hpa context") {
		t.Fatalf("AnalyzeResourceStream(hpa) error = %v, want hpa context error", hpaErr)
	}
}

func TestAnalyzeResourceStream_UnsupportedKind(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}

	err := app.AnalyzeResourceStream("widget", "default", "name", "stream")
	if err == nil {
		t.Fatal("AnalyzeResourceStream expected unsupported kind error")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "unsupported resource kind") {
		t.Fatalf("AnalyzeResourceStream unsupported error = %v", err)
	}
}

func TestAskHolmesStream_NotConfigured(t *testing.T) {
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()

	app := &App{ctx: context.Background()}
	err := app.AskHolmesStream("question", "stream-not-configured")
	if err != holmesgpt.ErrNotConfigured {
		t.Fatalf("AskHolmesStream error = %v, want %v", err, holmesgpt.ErrNotConfigured)
	}
}

func TestAskHolmesStream_NilContext(t *testing.T) {
	client, err := holmesgpt.NewHolmesClient(holmesgpt.HolmesConfig{Endpoint: "http://127.0.0.1:1"})
	if err != nil {
		t.Fatalf("NewHolmesClient unexpected error: %v", err)
	}

	holmesMu.Lock()
	holmesClient = client
	holmesMu.Unlock()
	defer func() {
		holmesMu.Lock()
		holmesClient = nil
		holmesMu.Unlock()
	}()

	app := &App{ctx: nil}
	err = app.AskHolmesStream("question", "stream-nil-ctx")
	if err == nil {
		t.Fatal("AskHolmesStream expected nil context error")
	}
	if !strings.Contains(err.Error(), "app context not initialized") {
		t.Fatalf("AskHolmesStream error = %v, want app context error", err)
	}
}

func TestCancelHolmesStream_CancelsRegisteredStream(t *testing.T) {
	streamID := "cancel-me"
	cancelCalled := false

	holmesStreamMu.Lock()
	holmesStreamCancels[streamID] = func() { cancelCalled = true }
	holmesStreamMu.Unlock()

	app := &App{ctx: context.Background()}
	if err := app.CancelHolmesStream(streamID); err != nil {
		t.Fatalf("CancelHolmesStream unexpected error: %v", err)
	}
	if !cancelCalled {
		t.Fatal("CancelHolmesStream expected cancel function to be called")
	}

	holmesStreamMu.Lock()
	_, stillPresent := holmesStreamCancels[streamID]
	holmesStreamMu.Unlock()
	if stillPresent {
		t.Fatal("CancelHolmesStream expected stream id to be removed")
	}
}

func TestAnalyzeStreamFunctions_ContextErrors(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}

	tests := []struct {
		name    string
		call    func() error
		wantMsg string
	}{
		{
			name:    "AnalyzePodStream",
			call:    func() error { return app.AnalyzePodStream("default", "missing-pod", "s1") },
			wantMsg: "failed to get pod context",
		},
		{
			name:    "AnalyzeDeploymentStream",
			call:    func() error { return app.AnalyzeDeploymentStream("default", "missing-deploy", "s2") },
			wantMsg: "failed to get deployment context",
		},
		{
			name:    "AnalyzeStatefulSetStream",
			call:    func() error { return app.AnalyzeStatefulSetStream("default", "missing-sts", "s3") },
			wantMsg: "failed to get statefulset context",
		},
		{
			name:    "AnalyzeDaemonSetStream",
			call:    func() error { return app.AnalyzeDaemonSetStream("default", "missing-ds", "s4") },
			wantMsg: "failed to get daemonset context",
		},
		{
			name:    "AnalyzeServiceStream",
			call:    func() error { return app.AnalyzeServiceStream("default", "missing-svc", "s5") },
			wantMsg: "failed to get service context",
		},
		{
			name:    "AnalyzeJobStream",
			call:    func() error { return app.AnalyzeJobStream("default", "missing-job", "s6") },
			wantMsg: "failed to get job context",
		},
		{
			name:    "AnalyzeCronJobStream",
			call:    func() error { return app.AnalyzeCronJobStream("default", "missing-cron", "s7") },
			wantMsg: "failed to get cronjob context",
		},
		{
			name:    "AnalyzeIngressStream",
			call:    func() error { return app.AnalyzeIngressStream("default", "missing-ing", "s8") },
			wantMsg: "failed to get ingress context",
		},
		{
			name:    "AnalyzeConfigMapStream",
			call:    func() error { return app.AnalyzeConfigMapStream("default", "missing-cm", "s9") },
			wantMsg: "failed to get configmap context",
		},
		{
			name:    "AnalyzeSecretStream",
			call:    func() error { return app.AnalyzeSecretStream("default", "missing-secret", "s10") },
			wantMsg: "failed to get secret context",
		},
		{
			name:    "AnalyzePersistentVolumeStream",
			call:    func() error { return app.AnalyzePersistentVolumeStream("missing-pv", "s11") },
			wantMsg: "failed to get persistent volume context",
		},
		{
			name:    "AnalyzePersistentVolumeClaimStream",
			call:    func() error { return app.AnalyzePersistentVolumeClaimStream("default", "missing-pvc", "s12") },
			wantMsg: "failed to get persistent volume claim context",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.call()
			if err == nil {
				t.Fatalf("%s expected error", tc.name)
			}
			if !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tc.wantMsg)) {
				t.Fatalf("%s error = %v, want containing %q", tc.name, err, tc.wantMsg)
			}
		})
	}
}

func TestAskHolmesStream_CompletesAndCleansUp(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/chat" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = fmt.Fprint(w, "event: token\ndata: hello\n\n")
		_, _ = fmt.Fprint(w, "event: done\ndata: [DONE]\n\n")
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
	}))
	defer server.Close()

	client, err := holmesgpt.NewHolmesClient(holmesgpt.HolmesConfig{Endpoint: server.URL})
	if err != nil {
		t.Fatalf("NewHolmesClient unexpected error: %v", err)
	}

	holmesMu.Lock()
	holmesClient = client
	holmesMu.Unlock()
	defer func() {
		holmesMu.Lock()
		holmesClient = nil
		holmesMu.Unlock()
	}()

	streamID := "stream-success"
	app := &App{ctx: context.Background()}
	if err := app.AskHolmesStream("test question", streamID); err != nil {
		t.Fatalf("AskHolmesStream unexpected error: %v", err)
	}

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		holmesStreamMu.Lock()
		_, exists := holmesStreamCancels[streamID]
		holmesStreamMu.Unlock()
		if !exists {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}

	t.Fatalf("stream %q still registered after completion", streamID)
}

func TestClearHolmesConfig_ResetsClient(t *testing.T) {
	client, err := holmesgpt.NewHolmesClient(holmesgpt.HolmesConfig{Endpoint: "http://127.0.0.1:1"})
	if err != nil {
		t.Fatalf("NewHolmesClient unexpected error: %v", err)
	}

	holmesConfig = holmesgpt.HolmesConfigData{Enabled: true, Endpoint: "http://127.0.0.1:1", APIKey: "key"}
	holmesMu.Lock()
	holmesClient = client
	holmesMu.Unlock()

	app := &App{ctx: context.Background(), configPath: t.TempDir() + "/cfg.json"}
	if err := app.ClearHolmesConfig(); err != nil {
		t.Fatalf("ClearHolmesConfig unexpected error: %v", err)
	}

	holmesMu.RLock()
	current := holmesClient
	holmesMu.RUnlock()
	if current != nil {
		t.Fatal("ClearHolmesConfig expected Holmes client to be nil")
	}
	if holmesConfig.Enabled || holmesConfig.Endpoint != "" || holmesConfig.APIKey != "" {
		t.Fatalf("ClearHolmesConfig expected default config, got %+v", holmesConfig)
	}
}

func TestAnalyzeResourceStream_AliasRoutesReturnContextErrors(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}

	tests := []struct {
		kind    string
		name    string
		wantMsg string
	}{
		{kind: "pods", name: "missing-pod", wantMsg: "failed to get pod context"},
		{kind: "deployments", name: "missing-deployment", wantMsg: "failed to get deployment context"},
		{kind: "statefulsets", name: "missing-sts", wantMsg: "failed to get statefulset context"},
		{kind: "daemonsets", name: "missing-ds", wantMsg: "failed to get daemonset context"},
		{kind: "services", name: "missing-svc", wantMsg: "failed to get service context"},
		{kind: "jobs", name: "missing-job", wantMsg: "failed to get job context"},
		{kind: "cronjobs", name: "missing-cron", wantMsg: "failed to get cronjob context"},
		{kind: "ingresses", name: "missing-ing", wantMsg: "failed to get ingress context"},
		{kind: "configmaps", name: "missing-cm", wantMsg: "failed to get configmap context"},
		{kind: "secrets", name: "missing-secret", wantMsg: "failed to get secret context"},
		{kind: "pv", name: "missing-pv", wantMsg: "failed to get persistent volume context"},
		{kind: "pvc", name: "missing-pvc", wantMsg: "failed to get persistent volume claim context"},
		{kind: "nodes", name: "missing-node", wantMsg: "failed to get node context"},
		{kind: "horizontalpodautoscalers", name: "missing-hpa", wantMsg: "failed to get hpa context"},
	}

	for _, tc := range tests {
		err := app.AnalyzeResourceStream(tc.kind, "default", tc.name, "sid-alias")
		if err == nil {
			t.Fatalf("AnalyzeResourceStream(%s) expected error", tc.kind)
		}
		if !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tc.wantMsg)) {
			t.Fatalf("AnalyzeResourceStream(%s) error = %v, want containing %q", tc.kind, err, tc.wantMsg)
		}
	}
}

func TestTryReconnectAndRetry_Paths(t *testing.T) {
	app := &App{ctx: context.Background()}
	log := holmesgpt.GetLogger()
	question := "q"
	streamID := "sid-retry"

	unhandledErr := errors.New("unhandled")
	client, err := holmesgpt.NewHolmesClient(holmesgpt.HolmesConfig{Endpoint: "http://example.com"})
	if err != nil {
		t.Fatalf("NewHolmesClient unexpected error: %v", err)
	}

	callCount := 0
	streamOnce := func(*holmesgpt.HolmesClient) error {
		callCount++
		return nil
	}

	if got := app.tryReconnectAndRetry(context.Background(), client, question, streamID, streamOnce, log, nil); got != nil {
		t.Fatalf("tryReconnectAndRetry(nil err) = %v, want nil", got)
	}

	got := app.tryReconnectAndRetry(context.Background(), client, question, streamID, streamOnce, log, unhandledErr)
	if !errors.Is(got, unhandledErr) {
		t.Fatalf("tryReconnectAndRetry(unhandled) = %v, want %v", got, unhandledErr)
	}

	kubeProxyClient, err := holmesgpt.NewHolmesClient(holmesgpt.HolmesConfig{Endpoint: "https://127.0.0.1:6443/api/v1/namespaces/default/services/http:holmesgpt:8080/proxy"})
	if err != nil {
		t.Fatalf("NewHolmesClient kube proxy unexpected error: %v", err)
	}

	got = app.tryReconnectAndRetry(context.Background(), kubeProxyClient, question, streamID, streamOnce, log, context.DeadlineExceeded)
	if got != nil {
		t.Fatalf("tryReconnectAndRetry(timeout+kubeproxy) = %v, want nil (handled path)", got)
	}
	if callCount != 0 {
		t.Fatalf("tryReconnectAndRetry expected streamOnce not to be called in port-forward failure path, got %d", callCount)
	}
}

func TestEmitHolmesStreamEvent_AndGetHolmesLogPath(t *testing.T) {
	app := &App{ctx: context.Background()}
	app.emitHolmesStreamEvent("sid", "error", "boom")

	_ = app.GetHolmesLogPath()
}
