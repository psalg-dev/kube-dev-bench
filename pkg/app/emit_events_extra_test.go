package app

import (
	"context"
	"testing"

	"k8s.io/client-go/kubernetes/fake"
)

// ─── emitKindSpecificUpdate ───────────────────────────────────────────────────

func TestEmitKindSpecificUpdate_Deployment(t *testing.T) {
	app := &App{
		ctx:           context.Background(),
		testClientset: fake.NewSimpleClientset(),
	}
	// Should not panic; with empty clientset, fetcher returns empty slice
	app.emitKindSpecificUpdate("default", "deployment")
}

func TestEmitKindSpecificUpdate_AllFetcherKinds(t *testing.T) {
	app := &App{
		ctx:           context.Background(),
		testClientset: fake.NewSimpleClientset(),
	}
	kinds := []string{"statefulset", "daemonset", "replicaset", "job", "cronjob",
		"ingress", "secret", "configmap", "role", "rolebinding"}
	for _, kind := range kinds {
		app.emitKindSpecificUpdate("default", kind)
	}
}

func TestEmitKindSpecificUpdate_ClusterRole(t *testing.T) {
	app := &App{
		ctx:           context.Background(),
		testClientset: fake.NewSimpleClientset(),
	}
	// Covers the switch case "clusterrole"
	app.emitKindSpecificUpdate("default", "clusterrole")
}

func TestEmitKindSpecificUpdate_ClusterRoleBinding(t *testing.T) {
	app := &App{
		ctx:           context.Background(),
		testClientset: fake.NewSimpleClientset(),
	}
	// Covers the switch case "clusterrolebinding"
	app.emitKindSpecificUpdate("default", "clusterrolebinding")
}

func TestEmitKindSpecificUpdate_UnknownKind(t *testing.T) {
	app := &App{
		ctx:           context.Background(),
		testClientset: fake.NewSimpleClientset(),
	}
	// Kind not in fetchers map, not in switch → hits the "not found" path
	app.emitKindSpecificUpdate("default", "widget")
}

// ─── emitResourceUpdateEvents ─────────────────────────────────────────────────

func TestEmitResourceUpdateEvents_NilCtx(t *testing.T) {
	app := &App{ctx: nil, testClientset: fake.NewSimpleClientset()}
	// should return early because ctx == nil
	app.emitResourceUpdateEvents("default", "deployment")
}

func TestEmitResourceUpdateEvents_EmptyNS(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	// should return early because ns == ""
	app.emitResourceUpdateEvents("", "deployment")
}

func TestEmitResourceUpdateEvents_WithNamespace(t *testing.T) {
	app := &App{
		ctx:           context.Background(),
		testClientset: fake.NewSimpleClientset(),
	}
	// calls time.Sleep(2500 ms) then emits events
	app.emitResourceUpdateEvents("default", "deployment")
}

// ─── getResourceContext ───────────────────────────────────────────────────────

func TestGetResourceContext_PodNotFound(t *testing.T) {
	app := &App{
		ctx:           context.Background(),
		testClientset: fake.NewSimpleClientset(),
	}
	// pod not in fake clientset → getPodContext returns error → getResourceContext returns ""
	result := app.getResourceContext("pod", "default", "nonexistent")
	// Empty string is expected since resource is not found
	if result != "" {
		t.Errorf("expected empty context for nonexistent pod, got %q", result)
	}
}

func TestGetResourceContext_PodsPlural(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	result := app.getResourceContext("pods", "default", "nonexistent")
	if result != "" {
		t.Errorf("expected empty context for nonexistent pods, got %q", result)
	}
}

func TestGetResourceContext_Deployment(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	result := app.getResourceContext("deployment", "default", "nonexistent")
	if result != "" {
		t.Errorf("expected empty context for nonexistent deployment, got %q", result)
	}
}

func TestGetResourceContext_DeploymentsPlural(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	result := app.getResourceContext("deployments", "default", "nonexistent")
	if result != "" {
		t.Errorf("expected empty for nonexistent deployments, got %q", result)
	}
}

func TestGetResourceContext_StatefulSet(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	result := app.getResourceContext("statefulset", "default", "nonexistent")
	if result != "" {
		t.Errorf("expected empty context for nonexistent statefulset, got %q", result)
	}
}

func TestGetResourceContext_DaemonSet(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	result := app.getResourceContext("daemonset", "default", "nonexistent")
	if result != "" {
		t.Errorf("expected empty context for nonexistent daemonset, got %q", result)
	}
}

func TestGetResourceContext_Unknown(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	// Falls through to default return ""
	result := app.getResourceContext("service", "default", "my-svc")
	if result != "" {
		t.Errorf("expected empty for unknown resource type, got %q", result)
	}
}

// ─── StopAllPolling ──────────────────────────────────────────────────────────

func TestStopAllPolling_NeverStarted(t *testing.T) {
	app := &App{}
	// pollingStarted is false by default → returns early
	app.StopAllPolling()
	if app.pollingStarted {
		t.Error("expected pollingStarted to remain false")
	}
}

func TestStopAllPolling_WithOpenChannel(t *testing.T) {
	app := &App{
		pollingStarted: true,
		pollingStopCh:  make(chan struct{}),
	}
	app.StopAllPolling()
	if app.pollingStarted {
		t.Error("expected pollingStarted to be false after stop")
	}
	if app.pollingStopCh != nil {
		t.Error("expected pollingStopCh to be nil after stop")
	}
}

func TestStopAllPolling_WithNilChannel(t *testing.T) {
	app := &App{
		pollingStarted: true,
		pollingStopCh:  nil, // pollingStarted but nil channel (edge case)
	}
	app.StopAllPolling()
	if app.pollingStarted {
		t.Error("expected pollingStarted to be false after stop")
	}
}

// ─── DisconnectDocker ─────────────────────────────────────────────────────────

func TestDisconnectDocker_NoClient(t *testing.T) {
	app := &App{ctx: context.Background()}
	// dockerClient is nil globally → should return nil
	err := app.DisconnectDocker()
	if err != nil {
		t.Errorf("DisconnectDocker() with no client: unexpected error = %v", err)
	}
}

// ─── GetSwarmMetricsHistory ───────────────────────────────────────────────────

func TestGetSwarmMetricsHistory_Empty(t *testing.T) {
	app := &App{ctx: context.Background()}
	result, err := app.GetSwarmMetricsHistory()
	if err != nil {
		t.Fatalf("GetSwarmMetricsHistory() error = %v", err)
	}
	// result may be nil or empty; just check no error
	_ = result
}
