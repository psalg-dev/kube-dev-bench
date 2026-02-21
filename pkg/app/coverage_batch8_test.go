package app

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	fake "k8s.io/client-go/kubernetes/fake"

	"gowails/pkg/app/holmesgpt"
)

// ─── ScaleResource: maxInt32 overflow guard ──────────────────────────────────

// TestScaleResource_OverMaxInt32 covers the replicas > maxInt32 guard.
func TestScaleResource_OverMaxInt32(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	// Pass a value strictly greater than int32 max (2147483647).
	if err := app.ScaleResource("deployment", "default", "x", 2147483648); err == nil {
		t.Error("expected error for replicas > maxInt32")
	}
}

// ─── GetDaemonSetNodeCoverage ─────────────────────────────────────────────────

// TestGetDaemonSetNodeCoverage_NotFound covers the DS not-found error path.
func TestGetDaemonSetNodeCoverage_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetDaemonSetNodeCoverage("default", "nonexistent-ds")
	if err == nil {
		t.Error("expected error for missing DaemonSet")
	}
}

// TestGetDaemonSetNodeCoverage_HappyPath covers the full coverage-build path.
func TestGetDaemonSetNodeCoverage_HappyPath(t *testing.T) {
	selector := map[string]string{"app": "test-ds"}
	ds := &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{Name: "test-ds", Namespace: "default"},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: selector},
		},
	}
	node := &corev1.Node{
		ObjectMeta: metav1.ObjectMeta{Name: "node-1"},
	}
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "ds-pod-1",
			Namespace: "default",
			Labels:    selector,
			OwnerReferences: []metav1.OwnerReference{
				{Kind: "DaemonSet", Name: "test-ds"},
			},
		},
		Spec: corev1.PodSpec{NodeName: "node-1"},
	}
	cs := fake.NewSimpleClientset(ds, node, pod)
	app := &App{ctx: context.Background(), testClientset: cs}
	result, err := app.GetDaemonSetNodeCoverage("default", "test-ds")
	if err != nil {
		t.Fatalf("GetDaemonSetNodeCoverage failed: %v", err)
	}
	if result == nil {
		t.Error("expected non-nil result")
	}
}

// ─── saveConfig: happy path ───────────────────────────────────────────────────

// TestSaveConfig_ToTempFile covers the successful write path of saveConfig.
func TestSaveConfig_ToTempFile(t *testing.T) {
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "config.json")
	app := &App{
		ctx:        context.Background(),
		configPath: tmpFile,
	}
	if err := app.saveConfig(); err != nil {
		t.Fatalf("saveConfig unexpected error: %v", err)
	}
	if _, err := os.Stat(tmpFile); err != nil {
		t.Fatalf("config file not created: %v", err)
	}
}

// TestSetPreferredNamespaces_SavesConfig covers the rememberNamespace=true branch
// which calls saveConfig.
func TestSetPreferredNamespaces_SavesConfig(t *testing.T) {
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "config.json")
	app := &App{
		ctx:               context.Background(),
		configPath:        tmpFile,
		rememberNamespace: true,
	}
	if err := app.SetPreferredNamespaces([]string{"default", "kube-system"}); err != nil {
		t.Fatalf("SetPreferredNamespaces unexpected error: %v", err)
	}
}

// ─── DismissMonitorIssue with ctx ─────────────────────────────────────────────

// TestDismissMonitorIssue_WithCtxAndDisabledWailsEvents covers the
// "if a.ctx != nil" branch (ctx set + Wails events disabled to avoid panic).
func TestDismissMonitorIssue_WithCtxAndDisabledWailsEvents(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("KDB_MONITOR_ISSUES_PATH", filepath.Join(tmpDir, "issues.json"))

	prev := disableWailsEvents
	disableWailsEvents = true
	t.Cleanup(func() { disableWailsEvents = prev })

	app := &App{
		ctx:           context.Background(),
		testClientset: fake.NewSimpleClientset(),
	}
	// Dismiss a non-existent issue ID; should persist an entry and emit event.
	if err := app.DismissMonitorIssue("some-issue-id"); err != nil {
		t.Fatalf("DismissMonitorIssue unexpected error: %v", err)
	}
}

// ─── SaveMonitorIssueAnalysis: happy path ─────────────────────────────────────

// TestSaveMonitorIssueAnalysis_HappyPath covers the persist-to-disk path.
func TestSaveMonitorIssueAnalysis_HappyPath(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("KDB_MONITOR_ISSUES_PATH", filepath.Join(tmpDir, "issues.json"))

	app := &App{ctx: context.Background()}
	resp := &holmesgpt.HolmesResponse{Response: "some analysis text"}
	if err := app.SaveMonitorIssueAnalysis("issue-abc", resp); err != nil {
		t.Fatalf("SaveMonitorIssueAnalysis unexpected error: %v", err)
	}
}

// TestSaveMonitorIssueAnalysis_EmptyAnalysis covers the fallback
// `analysis = response.Analysis` branch when Response is empty.
func TestSaveMonitorIssueAnalysis_EmptyResponse(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("KDB_MONITOR_ISSUES_PATH", filepath.Join(tmpDir, "issues.json"))

	app := &App{ctx: context.Background()}
	resp := &holmesgpt.HolmesResponse{Analysis: "fallback analysis"}
	if err := app.SaveMonitorIssueAnalysis("issue-xyz", resp); err != nil {
		t.Fatalf("SaveMonitorIssueAnalysis unexpected error: %v", err)
	}
}

// ─── savePersistedIssues: happy path ──────────────────────────────────────────

// TestSavePersistedIssues_HappyPath covers the successful persist path.
func TestSavePersistedIssues_HappyPath(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("KDB_MONITOR_ISSUES_PATH", filepath.Join(tmpDir, "issues.json"))

	issues := map[string]PersistedIssue{
		"issue-1": {IssueID: "issue-1", Dismissed: false, HolmesAnalysis: "test"},
	}
	if err := savePersistedIssues(issues); err != nil {
		t.Fatalf("savePersistedIssues unexpected error: %v", err)
	}
}

// ─── GetDismissedIssues: with dismissed issues ────────────────────────────────

// TestGetDismissedIssues_WithDismissedEntry covers the loop body that builds issues.
func TestGetDismissedIssues_WithDismissedEntry(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("KDB_MONITOR_ISSUES_PATH", filepath.Join(tmpDir, "issues.json"))

	// Pre-populate with a recently dismissed issue.
	issues := map[string]PersistedIssue{
		"issue-1": {
			IssueID:        "issue-1",
			Dismissed:      true,
			DismissedAt:    time.Now(),
			HolmesAnalysis: "analysis",
		},
	}
	if err := savePersistedIssues(issues); err != nil {
		t.Fatalf("setup: savePersistedIssues failed: %v", err)
	}

	app := &App{ctx: context.Background()}
	dismissed, err := app.GetDismissedIssues()
	if err != nil {
		t.Fatalf("GetDismissedIssues unexpected error: %v", err)
	}
	if len(dismissed) != 1 {
		t.Errorf("expected 1 dismissed issue, got %d", len(dismissed))
	}
}
