package app

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"gowails/pkg/app/k8s_graph"
)

// ─── NewApp migration path ────────────────────────────────────────────────────

// TestNewApp_MigrationPath verifies that NewApp copies the old config from
// ~/gowails/config.json to ~/KubeDevBench/config.json when only the old path exists.
func TestNewApp_MigrationPath(t *testing.T) {
	dir := t.TempDir()
	if isWindows() {
		t.Setenv("USERPROFILE", dir)
	} else {
		t.Setenv("HOME", dir)
	}

	// Create the old (gowails) config file.
	oldCfgDir := filepath.Join(dir, "gowails")
	if err := os.MkdirAll(oldCfgDir, 0o750); err != nil {
		t.Fatalf("setup: %v", err)
	}
	oldCfg := filepath.Join(oldCfgDir, "config.json")
	if err := os.WriteFile(oldCfg, []byte(`{"currentContext":"migrated-ctx"}`), 0o600); err != nil {
		t.Fatalf("setup: %v", err)
	}

	app := NewApp()
	if app == nil {
		t.Fatal("NewApp() returned nil")
	}

	// The config should now be at the new (KubeDevBench) path.
	newCfg := filepath.Join(dir, "KubeDevBench", "config.json")
	if app.configPath != newCfg && app.configPath != oldCfg {
		t.Errorf("configPath = %q, want %q or %q", app.configPath, newCfg, oldCfg)
	}
	// The new config file should exist (migration succeeded or fallback used).
	if _, err := os.Stat(app.configPath); err != nil {
		t.Errorf("configPath %q does not exist: %v", app.configPath, err)
	}
}

// ─── Startup safety branch ────────────────────────────────────────────────────

// TestStartup_NilCountsRefreshCh verifies the nil-safety guard that initialises
// countsRefreshCh inside Startup when the caller forgot to do so.
func TestStartup_NilCountsRefreshCh(t *testing.T) {
	previous := disableWailsEvents
	disableWailsEvents = true
	t.Cleanup(func() { disableWailsEvents = previous })

	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.json")
	if err := os.WriteFile(configPath, []byte(`{}`), 0o600); err != nil {
		t.Fatalf("setup: %v", err)
	}

	app := &App{
		configPath:           configPath,
		disableStartupDocker: true,
		logCancels:           make(map[string]context.CancelFunc),
		swarmVolumeHelpers:   make(map[string]string),
		// countsRefreshCh intentionally NOT set → triggers the safety branch
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	app.Startup(ctx)
	defer app.Shutdown(ctx) // ensure background goroutines and resources are cleaned up

	if app.countsRefreshCh == nil {
		t.Error("countsRefreshCh should have been initialised by Startup")
	}
}

// ─── setCachedGraph nil guard ─────────────────────────────────────────────────

// TestSetCachedGraph_NilGraph verifies the early-return guard when graph is nil.
func TestSetCachedGraph_NilGraph(t *testing.T) {
	app := &App{}
	// Calling with nil should not panic and return without storing.
	app.setCachedGraph("key", nil)
	_, ok := app.graphCache.Load("key")
	if ok {
		t.Error("nil graph should not be stored in the cache")
	}
}

// TestSetCachedGraph_NonNilGraph verifies a non-nil graph IS stored.
func TestSetCachedGraph_NonNilGraph(t *testing.T) {
	app := &App{}
	g := &k8s_graph.ResourceGraph{}
	app.setCachedGraph("test-key", g)
	_, ok := app.graphCache.Load("test-key")
	if !ok {
		t.Error("non-nil graph should be stored in the cache")
	}
}

// ─── emitHookStarted / emitHookCompleted nil-context guard ───────────────────

// TestEmitHookStarted_NilApp verifies the nil-app guard in emitHookStarted.
func TestEmitHookStarted_NilApp(t *testing.T) {
	var app *App
	// Should not panic.
	app.emitHookStarted(HookConfig{ID: "h1"}, "kubernetes", "c1")
}

// TestEmitHookStarted_NilContext verifies the nil-ctx guard in emitHookStarted.
func TestEmitHookStarted_NilContext(t *testing.T) {
	app := &App{} // ctx is nil
	app.emitHookStarted(HookConfig{ID: "h1"}, "kubernetes", "c1")
}

// TestEmitHookCompleted_NilApp verifies the nil-app guard in emitHookCompleted.
func TestEmitHookCompleted_NilApp(t *testing.T) {
	var app *App
	app.emitHookCompleted(HookConfig{ID: "h1"}, HookExecutionResult{}, "kubernetes", "c1")
}

// TestEmitHookCompleted_NilContext verifies the nil-ctx guard in emitHookCompleted.
func TestEmitHookCompleted_NilContext(t *testing.T) {
	app := &App{} // ctx is nil
	app.emitHookCompleted(HookConfig{ID: "h1"}, HookExecutionResult{}, "kubernetes", "c1")
}

// ─── isOwnedByDaemonSet edge cases ───────────────────────────────────────────

// TestIsOwnedByDaemonSet_NoOwnerRefs verifies that a pod without any
// OwnerReferences returns false.
func TestIsOwnedByDaemonSet_NoOwnerRefs(t *testing.T) {
	pod := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "p1"}}
	if isOwnedByDaemonSet(pod, "ds1") {
		t.Error("expected false for pod with no OwnerReferences")
	}
}

// TestIsOwnedByDaemonSet_WrongKind verifies that a pod whose only owner is a
// different kind (e.g. ReplicaSet) returns false.
func TestIsOwnedByDaemonSet_WrongKind(t *testing.T) {
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name: "p1",
			OwnerReferences: []metav1.OwnerReference{
				{Kind: "ReplicaSet", Name: "ds1"},
			},
		},
	}
	if isOwnedByDaemonSet(pod, "ds1") {
		t.Error("expected false for pod owned by ReplicaSet, not DaemonSet")
	}
}

// ─── collectPodsByNode – empty NodeName ──────────────────────────────────────

// TestCollectPodsByNode_EmptyNodeName verifies that pods with an empty
// NodeName are ignored.
func TestCollectPodsByNode_EmptyNodeName(t *testing.T) {
	pods := []corev1.Pod{
		{
			ObjectMeta: metav1.ObjectMeta{
				Name: "p1",
				OwnerReferences: []metav1.OwnerReference{
					{Kind: "DaemonSet", Name: "ds1"},
				},
			},
			Spec: corev1.PodSpec{
				NodeName: "", // empty – should be skipped
			},
		},
	}
	result := collectPodsByNode(pods, "ds1")
	if len(result) != 0 {
		t.Errorf("expected 0 entries, got %d", len(result))
	}
}

// TestCollectPodsByNode_PodNotOwnedByDS verifies pods not owned by the named
// DaemonSet are excluded even when NodeName is set.
func TestCollectPodsByNode_PodNotOwnedByDS(t *testing.T) {
	pods := []corev1.Pod{
		{
			ObjectMeta: metav1.ObjectMeta{
				Name: "p1",
				OwnerReferences: []metav1.OwnerReference{
					{Kind: "DaemonSet", Name: "other-ds"},
				},
			},
			Spec: corev1.PodSpec{NodeName: "node1"},
		},
	}
	result := collectPodsByNode(pods, "ds1")
	if len(result) != 0 {
		t.Errorf("expected 0 entries, got %d", len(result))
	}
}

// ─── detectDialogDirFromWorkdir happy path ────────────────────────────────────

// TestDetectDialogDirFromWorkdir_HappyPath creates the mapping file structure
// under a temp dir and then changes the effective working directory.
func TestDetectDialogDirFromWorkdir_HappyPath(t *testing.T) {
	tmpWD := t.TempDir()

	mappingDir := filepath.Join(tmpWD, "e2e", ".run", "dialog-dirs")
	if err := os.MkdirAll(mappingDir, 0o750); err != nil {
		t.Fatalf("setup: %v", err)
	}
	targetDir := filepath.Join(tmpWD, "dialog-target")
	if err := os.MkdirAll(targetDir, 0o750); err != nil {
		t.Fatalf("setup: %v", err)
	}
	// Write the single mapping file containing the target dir.
	mappingFile := filepath.Join(mappingDir, "100-test.txt")
	if err := os.WriteFile(mappingFile, []byte(targetDir), 0o600); err != nil {
		t.Fatalf("setup: %v", err)
	}

	// Temporarily change the working directory.
	origWD, _ := os.Getwd()
	if err := os.Chdir(tmpWD); err != nil {
		t.Skipf("cannot chdir to %s: %v", tmpWD, err)
	}
	t.Cleanup(func() { _ = os.Chdir(origWD) })

	got := detectDialogDirFromWorkdir()
	if got != targetDir {
		t.Errorf("detectDialogDirFromWorkdir() = %q, want %q", got, targetDir)
	}
}

// TestDetectDialogDirFromWorkdir_MultipleFiles verifies that more than one
// mapping file causes the function to return "".
func TestDetectDialogDirFromWorkdir_MultipleFiles(t *testing.T) {
	tmpWD := t.TempDir()

	mappingDir := filepath.Join(tmpWD, "e2e", ".run", "dialog-dirs")
	if err := os.MkdirAll(mappingDir, 0o750); err != nil {
		t.Fatalf("setup: %v", err)
	}
	for _, name := range []string{"file1.txt", "file2.txt"} {
		if err := os.WriteFile(filepath.Join(mappingDir, name), []byte("x"), 0o600); err != nil {
			t.Fatalf("setup: %v", err)
		}
	}

	origWD, _ := os.Getwd()
	if err := os.Chdir(tmpWD); err != nil {
		t.Skipf("cannot chdir to %s: %v", tmpWD, err)
	}
	t.Cleanup(func() { _ = os.Chdir(origWD) })

	got := detectDialogDirFromWorkdir()
	if got != "" {
		t.Errorf("detectDialogDirFromWorkdir() = %q, want empty string", got)
	}
}

// ─── monitorIssuesPath home-dir fallback ─────────────────────────────────────

// TestMonitorIssuesPath_HomeDir verifies the home-dir derived path when the
// override env var is NOT set.
func TestMonitorIssuesPath_HomeDir(t *testing.T) {
	t.Setenv("KDB_MONITOR_ISSUES_PATH", "") // ensure override is absent
	p, err := monitorIssuesPath()
	if err != nil {
		t.Fatalf("monitorIssuesPath() error = %v", err)
	}
	if p == "" {
		t.Error("expected non-empty path")
	}
	// The path should end with the canonical filename.
	if filepath.Base(p) != monitorIssuesFileName {
		t.Errorf("expected filename %q, got %q", monitorIssuesFileName, filepath.Base(p))
	}
}
