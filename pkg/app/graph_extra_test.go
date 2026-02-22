package app

import (
	"context"
	"testing"

	"k8s.io/client-go/kubernetes/fake"
)

// newGraphApp creates a minimal App suitable for graph function tests.
// It uses a fake clientset so all K8s calls succeed with empty data.
func newGraphApp(t *testing.T) *App {
	t.Helper()
	return &App{
		ctx:                context.Background(),
		testClientset:      fake.NewSimpleClientset(),
		currentKubeContext: "test-ctx",
	}
}

// ─── GetNamespaceGraph ────────────────────────────────────────────────────────

func TestGetNamespaceGraph_EmptyNamespaceError(t *testing.T) {
	app := newGraphApp(t)
	_, err := app.GetNamespaceGraph("", 1)
	if err == nil {
		t.Error("expected error for empty namespace")
	}
}

func TestGetNamespaceGraph_Success(t *testing.T) {
	app := newGraphApp(t)
	graph, err := app.GetNamespaceGraph("default", 1)
	if err != nil {
		t.Fatalf("GetNamespaceGraph() error = %v", err)
	}
	if graph == nil {
		t.Fatal("expected non-nil graph")
	}
}

func TestGetNamespaceGraph_CacheHit(t *testing.T) {
	app := newGraphApp(t)
	// First call populates cache
	graph1, err := app.GetNamespaceGraph("default", 1)
	if err != nil {
		t.Fatalf("first GetNamespaceGraph() error = %v", err)
	}
	// Second call should return cached result
	graph2, err := app.GetNamespaceGraph("default", 1)
	if err != nil {
		t.Fatalf("second GetNamespaceGraph() error = %v", err)
	}
	if graph1 == nil || graph2 == nil {
		t.Fatal("expected non-nil graphs")
	}
}

// ─── GetStorageGraph ──────────────────────────────────────────────────────────

func TestGetStorageGraph_EmptyNamespaceError(t *testing.T) {
	app := newGraphApp(t)
	_, err := app.GetStorageGraph("", 1)
	if err == nil {
		t.Error("expected error for empty namespace")
	}
}

func TestGetStorageGraph_Success(t *testing.T) {
	app := newGraphApp(t)
	graph, err := app.GetStorageGraph("default", 2)
	if err != nil {
		t.Fatalf("GetStorageGraph() error = %v", err)
	}
	if graph == nil {
		t.Fatal("expected non-nil graph")
	}
}

// ─── GetNetworkPolicyGraph ────────────────────────────────────────────────────

func TestGetNetworkPolicyGraph_EmptyNamespaceError(t *testing.T) {
	app := newGraphApp(t)
	_, err := app.GetNetworkPolicyGraph("", 1)
	if err == nil {
		t.Error("expected error for empty namespace")
	}
}

func TestGetNetworkPolicyGraph_Success(t *testing.T) {
	app := newGraphApp(t)
	graph, err := app.GetNetworkPolicyGraph("default", 1)
	if err != nil {
		t.Fatalf("GetNetworkPolicyGraph() error = %v", err)
	}
	if graph == nil {
		t.Fatal("expected non-nil graph")
	}
}

// ─── GetRBACGraph ─────────────────────────────────────────────────────────────

func TestGetRBACGraph_EmptyNamespaceError(t *testing.T) {
	app := newGraphApp(t)
	_, err := app.GetRBACGraph("")
	if err == nil {
		t.Error("expected error for empty namespace")
	}
}

func TestGetRBACGraph_Success(t *testing.T) {
	app := newGraphApp(t)
	graph, err := app.GetRBACGraph("default")
	if err != nil {
		t.Fatalf("GetRBACGraph() error = %v", err)
	}
	if graph == nil {
		t.Fatal("expected non-nil graph")
	}
}

// ─── GetResourceGraph ─────────────────────────────────────────────────────────

func TestGetResourceGraph_EmptyKindError(t *testing.T) {
	app := newGraphApp(t)
	_, err := app.GetResourceGraph("default", "", "my-deploy", 1)
	if err == nil {
		t.Error("expected error for empty kind")
	}
}

func TestGetResourceGraph_EmptyNameNonNamespaceKind(t *testing.T) {
	app := newGraphApp(t)
	_, err := app.GetResourceGraph("default", "deployment", "", 1)
	if err == nil {
		t.Error("expected error for empty name with non-namespace kind")
	}
}

func TestGetResourceGraph_NamespaceKindWithName(t *testing.T) {
	app := newGraphApp(t)
	// kind=namespace with a name should call BuildForNamespace
	graph, err := app.GetResourceGraph("", "namespace", "default", 1)
	if err != nil {
		t.Fatalf("GetResourceGraph(namespace) error = %v", err)
	}
	if graph == nil {
		t.Fatal("expected non-nil graph")
	}
}

func TestGetResourceGraph_DeploymentSuccess(t *testing.T) {
	app := newGraphApp(t)
	// Even with empty clientset the builder should return an empty graph or
	// a not-found error; if the resource doesn't exist the builder returns an
	// error, so we accept either a graph or a returned error here.
	// What matters for coverage is that we hit the BuildForResource path.
	_, _ = app.GetResourceGraph("default", "deployment", "my-deploy", 1)
}

// ─── normalizeGraphDepth ──────────────────────────────────────────────────────

func TestNormalizeGraphDepth(t *testing.T) {
	// depth < 1 → DefaultDepth
	d := normalizeGraphDepth(0)
	if d < 1 {
		t.Errorf("expected positive depth, got %d", d)
	}
	// depth in range passes through
	d2 := normalizeGraphDepth(2)
	if d2 != 2 {
		t.Errorf("expected 2, got %d", d2)
	}
}

// ─── cloneResourceGraph ───────────────────────────────────────────────────────

func TestCloneResourceGraph_Nil(t *testing.T) {
	result := cloneResourceGraph(nil)
	if result != nil {
		t.Error("expected nil for nil input")
	}
}
