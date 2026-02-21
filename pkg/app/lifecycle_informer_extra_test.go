package app

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"k8s.io/client-go/kubernetes/fake"
)

// ─── Shutdown ────────────────────────────────────────────────────────────────

// TestShutdown_Minimal calls Shutdown on a bare App (nil docker client, no
// informer manager, empty logCancels).  All sub-calls must be safe to invoke
// without a real Docker daemon or Wails runtime.
func TestShutdown_Minimal(t *testing.T) {
	app := &App{
		ctx: context.Background(),
	}
	// Must not panic or block.
	app.Shutdown(context.Background())
}

// TestShutdown_WithLogCancels verifies that Shutdown cancels and removes every
// entry in logCancels.
func TestShutdown_WithLogCancels(t *testing.T) {
	cancelled := false
	_, cancelFn := context.WithCancel(context.Background())
	wrappedCancel := func() {
		cancelled = true
		cancelFn()
	}

	app := &App{
		ctx: context.Background(),
		logCancels: map[string]context.CancelFunc{
			"ns/pod-a": wrappedCancel,
			"ns/pod-b": nil, // nil cancel must be handled gracefully
		},
	}
	app.Shutdown(context.Background())

	if !cancelled {
		t.Error("expected non-nil cancel function to be called during Shutdown")
	}
	if len(app.logCancels) != 0 {
		t.Errorf("expected logCancels to be empty after Shutdown, got %d entries", len(app.logCancels))
	}
}

// ─── startInformerManager ────────────────────────────────────────────────────

// TestStartInformerManager_UseInformersFalse tests the early-return path when
// informer mode is disabled.
func TestStartInformerManager_UseInformersFalse(t *testing.T) {
	app := &App{
		ctx:          context.Background(),
		useInformers: false,
	}
	app.startInformerManager() // must return immediately without touching manager
	app.informerMu.Lock()
	m := app.informerManager
	app.informerMu.Unlock()
	if m != nil {
		t.Error("expected informerManager to remain nil when useInformers=false")
	}
}

// TestStartInformerManager_EmptyContext tests the early-return when no kube
// context is set even though informer mode is enabled.
func TestStartInformerManager_EmptyContext(t *testing.T) {
	app := &App{
		ctx:                context.Background(),
		useInformers:       true,
		currentKubeContext: "",
	}
	app.startInformerManager()
	app.informerMu.Lock()
	m := app.informerManager
	app.informerMu.Unlock()
	if m != nil {
		t.Error("expected informerManager to remain nil when currentKubeContext is empty")
	}
}

// ─── stopInformerManager ─────────────────────────────────────────────────────

// TestStopInformerManager_NilManager ensures stopInformerManager is a no-op
// when no manager has been started.
func TestStopInformerManager_NilManager(t *testing.T) {
	app := &App{}
	app.stopInformerManager() // must not panic
}

// TestStopInformerManager_ActiveManager verifies that stopInformerManager
// stops the manager and clears the field.
func TestStopInformerManager_ActiveManager(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := newInformerApp(t, cs, "default")

	app.stopInformerManager()

	app.informerMu.Lock()
	m := app.informerManager
	app.informerMu.Unlock()
	if m != nil {
		t.Error("expected informerManager to be nil after stopInformerManager()")
	}
	// t.Cleanup registered by newInformerApp will call manager.Stop() again,
	// which is safe (Stop is idempotent via nil-check on stopCh).
}

// ─── restartInformerManager ──────────────────────────────────────────────────

// TestRestartInformerManager_UseInformersFalse tests the early-return when
// informer mode is off.
func TestRestartInformerManager_UseInformersFalse(t *testing.T) {
	app := &App{
		ctx:          context.Background(),
		useInformers: false,
	}
	app.restartInformerManager() // must return immediately
}

// TestRestartInformerManager_NilManager tests that when the manager is nil,
// restartInformerManager falls through to startInformerManager (which returns
// early because currentKubeContext is empty).
func TestRestartInformerManager_NilManager(t *testing.T) {
	app := &App{
		ctx:                context.Background(),
		useInformers:       true,
		currentKubeContext: "",
	}
	app.restartInformerManager() // startInformerManager returns early → no-op
	app.informerMu.Lock()
	m := app.informerManager
	app.informerMu.Unlock()
	if m != nil {
		t.Error("expected informerManager to remain nil")
	}
}

// ─── SetUseInformers ─────────────────────────────────────────────────────────

// TestSetUseInformers_SwitchToFalse switches from informer mode to polling
// mode.  The test isolates file I/O via a temp configPath.
func TestSetUseInformers_SwitchToFalse(t *testing.T) {
	tmpDir := t.TempDir()
	app := &App{
		ctx:          context.Background(),
		useInformers: true, // starting state
		configPath:   filepath.Join(tmpDir, "config.json"),
	}
	t.Cleanup(app.StopAllPolling)

	if err := app.SetUseInformers(false); err != nil {
		t.Fatalf("SetUseInformers(false): unexpected error: %v", err)
	}
	if app.useInformers {
		t.Error("expected useInformers to be false after toggle")
	}
	if _, err := os.Stat(app.configPath); err != nil {
		t.Errorf("expected config file to exist at %s: %v", app.configPath, err)
	}
}

// TestSetUseInformers_SwitchToTrue switches from polling mode to informer
// mode.  startInformerManager returns early (empty currentKubeContext) so no
// real K8s calls are made.
func TestSetUseInformers_SwitchToTrue(t *testing.T) {
	tmpDir := t.TempDir()
	app := &App{
		ctx:                context.Background(),
		useInformers:       false, // starting state
		currentKubeContext: "",    // startInformerManager will return early
		configPath:         filepath.Join(tmpDir, "config.json"),
	}

	if err := app.SetUseInformers(true); err != nil {
		t.Fatalf("SetUseInformers(true): unexpected error: %v", err)
	}
	if !app.useInformers {
		t.Error("expected useInformers to be true after toggle")
	}
}

// ─── shutdownMCP ─────────────────────────────────────────────────────────────

// TestShutdownMCP_NilServer verifies shutdownMCP is a no-op when no MCP
// server has been started.
func TestShutdownMCP_NilServer(t *testing.T) {
	app := &App{ctx: context.Background()}
	app.shutdownMCP() // mcpServer is nil → must not panic or block
}

// ─── emitPortForwardsUpdate ──────────────────────────────────────────────────

// TestEmitPortForwardsUpdate_Empty calls emitPortForwardsUpdate when no
// sessions are stored (exercises the empty-list emit path).
func TestEmitPortForwardsUpdate_Empty(t *testing.T) {
	app := &App{ctx: context.Background()}
	app.emitPortForwardsUpdate() // must not panic
}

// TestEmitPortForwardsUpdate_WithValidSession stores a correctly-keyed session,
// then calls emitPortForwardsUpdate to exercise the Range + parse branch.
func TestEmitPortForwardsUpdate_WithValidSession(t *testing.T) {
	key := "default/mypod:8080:80"
	portForwardSessions.Store(key, &PortForwardSession{})
	t.Cleanup(func() { portForwardSessions.Delete(key) })

	app := &App{ctx: context.Background()}
	app.emitPortForwardsUpdate() // must not panic; emitEvent is a no-op in tests
}

// TestEmitPortForwardsUpdate_WithInvalidKey stores a key that does not match
// the expected format; emitPortForwardsUpdate must skip it gracefully.
func TestEmitPortForwardsUpdate_WithInvalidKey(t *testing.T) {
	key := "bad-format-key"
	portForwardSessions.Store(key, &PortForwardSession{})
	t.Cleanup(func() { portForwardSessions.Delete(key) })

	app := &App{ctx: context.Background()}
	app.emitPortForwardsUpdate() // must not panic; invalid key is skipped
}
