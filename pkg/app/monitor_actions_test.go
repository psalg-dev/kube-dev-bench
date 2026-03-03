package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"gowails/pkg/app/holmesgpt"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGenerateIssueID_Stable(t *testing.T) {
	issue := MonitorIssue{
		Resource:  "Pod",
		Namespace: "default",
		Name:      "my-pod",
		Reason:    "CrashLoopBackOff",
	}
	id1 := generateIssueID(issue)
	id2 := generateIssueID(issue)
	if id1 != id2 {
		t.Fatalf("expected stable issue ID, got %s vs %s", id1, id2)
	}
}

func TestPersistedIssues_SaveLoad(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "monitor_issues.json")
	if err := os.Setenv("KDB_MONITOR_ISSUES_PATH", path); err != nil {
		t.Fatalf("failed to set env: %v", err)
	}
	defer os.Unsetenv("KDB_MONITOR_ISSUES_PATH")

	issues := map[string]PersistedIssue{
		"issue-1": {
			IssueID:          "issue-1",
			Dismissed:        true,
			DismissedAt:      time.Now(),
			HolmesAnalysis:   "analysis",
			HolmesAnalyzedAt: time.Now(),
		},
	}
	if err := savePersistedIssues(issues); err != nil {
		t.Fatalf("savePersistedIssues failed: %v", err)
	}

	loaded, err := loadPersistedIssues()
	if err != nil {
		t.Fatalf("loadPersistedIssues failed: %v", err)
	}
	if len(loaded) != 1 {
		t.Fatalf("expected 1 issue, got %d", len(loaded))
	}
	if loaded["issue-1"].IssueID != "issue-1" {
		t.Fatalf("expected issue-1, got %s", loaded["issue-1"].IssueID)
	}
}

func TestCleanupExpiredIssues_RemovesDismissed(t *testing.T) {
	now := time.Now()
	issues := map[string]PersistedIssue{
		"old": {
			IssueID:     "old",
			Dismissed:   true,
			DismissedAt: now.Add(-dismissedIssueTTL - time.Minute),
		},
		"active": {
			IssueID:     "active",
			Dismissed:   true,
			DismissedAt: now.Add(-time.Hour),
		},
	}
	changed, updated := cleanupExpiredIssues(issues, now)
	if !changed {
		t.Fatalf("expected changed to be true")
	}
	if _, ok := updated["old"]; ok {
		t.Fatalf("expected old issue to be removed")
	}
	if _, ok := updated["active"]; !ok {
		t.Fatalf("expected active issue to remain")
	}
}

func TestScanClusterHealth_NodeNotReady(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "default"}},
		&v1.Node{
			ObjectMeta: metav1.ObjectMeta{Name: "node-1"},
			Status: v1.NodeStatus{
				Conditions: []v1.NodeCondition{
					{Type: v1.NodeReady, Status: v1.ConditionFalse, Message: "Not ready"},
				},
			},
		},
	)
	app := &App{ctx: context.Background(), testClientset: clientset}

	info, err := app.ScanClusterHealth()
	if err != nil {
		t.Fatalf("ScanClusterHealth failed: %v", err)
	}
	if info.ErrorCount == 0 {
		t.Fatalf("expected node readiness error")
	}
}

func TestAnalyzeMonitorIssue_PersistsAnalysis(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/chat" {
			json.NewEncoder(w).Encode(holmesgpt.HolmesResponse{Response: "Analysis body"})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "monitor_issues.json")
	if err := os.Setenv("KDB_MONITOR_ISSUES_PATH", path); err != nil {
		t.Fatalf("failed to set env: %v", err)
	}
	defer os.Unsetenv("KDB_MONITOR_ISSUES_PATH")

	holmesConfig = holmesgpt.HolmesConfigData{Enabled: true, Endpoint: server.URL}
	defer func() { holmesConfig = holmesgpt.DefaultConfig() }()

	clientset := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "crash-pod", Namespace: "default"},
		Status: v1.PodStatus{
			Phase: v1.PodRunning,
			ContainerStatuses: []v1.ContainerStatus{
				{
					Name: "container",
					State: v1.ContainerState{
						Waiting: &v1.ContainerStateWaiting{Reason: "CrashLoopBackOff", Message: "Crash"},
					},
				},
			},
		},
	})

	app := &App{ctx: context.Background(), testClientset: clientset, preferredNamespaces: []string{"default"}}
	app.initHolmes()

	info := app.collectMonitorInfo([]string{"default"})
	if len(info.Errors) == 0 {
		t.Fatalf("expected issue to analyze")
	}
	issueID := info.Errors[0].IssueID

	updated, err := app.AnalyzeMonitorIssue(issueID)
	if err != nil {
		t.Fatalf("AnalyzeMonitorIssue failed: %v", err)
	}
	if updated.HolmesAnalysis == "" {
		t.Fatalf("expected Holmes analysis to be saved")
	}

	loaded, err := loadPersistedIssues()
	if err != nil {
		t.Fatalf("loadPersistedIssues failed: %v", err)
	}
	if loaded[issueID].HolmesAnalysis == "" {
		t.Fatalf("expected analysis in persistence")
	}

	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
}

func TestDismissMonitorIssue_Success(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "monitor_issues.json")
	if err := os.Setenv("KDB_MONITOR_ISSUES_PATH", path); err != nil {
		t.Fatalf("failed to set env: %v", err)
	}
	defer os.Unsetenv("KDB_MONITOR_ISSUES_PATH")

	app := &App{ctx: context.Background()}

	issueID := "Pod-default-test-pod-CrashLoopBackOff"
	err := app.DismissMonitorIssue(issueID)
	if err != nil {
		t.Fatalf("DismissMonitorIssue failed: %v", err)
	}

	loaded, err := loadPersistedIssues()
	if err != nil {
		t.Fatalf("loadPersistedIssues failed: %v", err)
	}
	if !loaded[issueID].Dismissed {
		t.Fatalf("expected issue to be dismissed")
	}
	if loaded[issueID].DismissedAt.IsZero() {
		t.Fatalf("expected DismissedAt to be set")
	}
}

func TestDismissMonitorIssue_EmptyID(t *testing.T) {
	app := &App{ctx: context.Background()}

	err := app.DismissMonitorIssue("")
	if err == nil {
		t.Fatalf("expected error for empty issueID")
	}
}

func TestGetDismissedIssues_ReturnsDismissed(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "monitor_issues.json")
	if err := os.Setenv("KDB_MONITOR_ISSUES_PATH", path); err != nil {
		t.Fatalf("failed to set env: %v", err)
	}
	defer os.Unsetenv("KDB_MONITOR_ISSUES_PATH")

	persisted := map[string]PersistedIssue{
		"issue-1": {
			IssueID:     "issue-1",
			Dismissed:   true,
			DismissedAt: time.Now().Add(-time.Hour),
		},
		"issue-2": {
			IssueID:     "issue-2",
			Dismissed:   true,
			DismissedAt: time.Now().Add(-2 * time.Hour),
		},
		"issue-3": {
			IssueID:   "issue-3",
			Dismissed: false,
		},
	}
	if err := savePersistedIssues(persisted); err != nil {
		t.Fatalf("savePersistedIssues failed: %v", err)
	}

	app := &App{ctx: context.Background()}
	issues, err := app.GetDismissedIssues()
	if err != nil {
		t.Fatalf("GetDismissedIssues failed: %v", err)
	}

	if len(issues) != 2 {
		t.Fatalf("expected 2 dismissed issues, got %d", len(issues))
	}
	// Should be sorted by dismissedAt descending
	if issues[0].IssueID != "issue-1" {
		t.Errorf("expected issue-1 first (most recent), got %s", issues[0].IssueID)
	}
}

func TestGetDismissedIssues_FiltersExpired(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "monitor_issues.json")
	if err := os.Setenv("KDB_MONITOR_ISSUES_PATH", path); err != nil {
		t.Fatalf("failed to set env: %v", err)
	}
	defer os.Unsetenv("KDB_MONITOR_ISSUES_PATH")

	persisted := map[string]PersistedIssue{
		"recent": {
			IssueID:     "recent",
			Dismissed:   true,
			DismissedAt: time.Now().Add(-time.Hour),
		},
		"expired": {
			IssueID:     "expired",
			Dismissed:   true,
			DismissedAt: time.Now().Add(-dismissedIssueTTL - time.Hour),
		},
	}
	if err := savePersistedIssues(persisted); err != nil {
		t.Fatalf("savePersistedIssues failed: %v", err)
	}

	app := &App{ctx: context.Background()}
	issues, err := app.GetDismissedIssues()
	if err != nil {
		t.Fatalf("GetDismissedIssues failed: %v", err)
	}

	if len(issues) != 1 {
		t.Fatalf("expected 1 dismissed issue (expired filtered), got %d", len(issues))
	}
	if issues[0].IssueID != "recent" {
		t.Errorf("expected recent issue, got %s", issues[0].IssueID)
	}
}

func TestSaveMonitorIssueAnalysis_Success(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "monitor_issues.json")
	if err := os.Setenv("KDB_MONITOR_ISSUES_PATH", path); err != nil {
		t.Fatalf("failed to set env: %v", err)
	}
	defer os.Unsetenv("KDB_MONITOR_ISSUES_PATH")

	app := &App{ctx: context.Background()}

	issueID := "Pod-default-test-pod-CrashLoopBackOff"
	resp := &holmesgpt.HolmesResponse{Response: "Test analysis response"}
	err := app.SaveMonitorIssueAnalysis(issueID, resp)
	if err != nil {
		t.Fatalf("SaveMonitorIssueAnalysis failed: %v", err)
	}

	loaded, err := loadPersistedIssues()
	if err != nil {
		t.Fatalf("loadPersistedIssues failed: %v", err)
	}
	if loaded[issueID].HolmesAnalysis != "Test analysis response" {
		t.Errorf("expected analysis to be saved, got %s", loaded[issueID].HolmesAnalysis)
	}
	if loaded[issueID].HolmesAnalyzedAt.IsZero() {
		t.Errorf("expected HolmesAnalyzedAt to be set")
	}
}

func TestSaveMonitorIssueAnalysis_InvalidInput(t *testing.T) {
	app := &App{ctx: context.Background()}

	err := app.SaveMonitorIssueAnalysis("", nil)
	if err == nil {
		t.Fatalf("expected error for invalid input")
	}

	err = app.SaveMonitorIssueAnalysis("issue-id", nil)
	if err == nil {
		t.Fatalf("expected error for nil response")
	}
}

func TestMergePersistedIntoIssue(t *testing.T) {
	issue := MonitorIssue{
		Resource:  "Pod",
		Namespace: "default",
		Name:      "test-pod",
		Reason:    "CrashLoopBackOff",
	}
	now := time.Now()
	persisted := PersistedIssue{
		IssueID:          "test-id",
		Dismissed:        true,
		DismissedAt:      now.Add(-time.Hour),
		HolmesAnalysis:   "Analysis text",
		HolmesAnalyzedAt: now.Add(-30 * time.Minute),
	}

	merged := mergePersistedIntoIssue(issue, persisted)

	if !merged.Dismissed {
		t.Errorf("expected Dismissed to be true")
	}
	if merged.DismissedAt != persisted.DismissedAt {
		t.Errorf("expected DismissedAt to match")
	}
	if merged.HolmesAnalysis != "Analysis text" {
		t.Errorf("expected HolmesAnalysis to be set")
	}
	if !merged.HolmesAnalyzed {
		t.Errorf("expected HolmesAnalyzed to be true")
	}
}

func TestGenerateIssueID_WithContainerName(t *testing.T) {
	issue := MonitorIssue{
		Resource:      "Pod",
		Namespace:     "default",
		Name:          "my-pod",
		Reason:        "CrashLoopBackOff",
		ContainerName: "main",
	}
	id := generateIssueID(issue)
	expected := "Pod-default-my-pod-main-CrashLoopBackOff"
	if id != expected {
		t.Errorf("expected %s, got %s", expected, id)
	}
}

func TestGenerateIssueID_WithoutContainerName(t *testing.T) {
	issue := MonitorIssue{
		Resource:  "Pod",
		Namespace: "default",
		Name:      "my-pod",
		Reason:    "PodFailed",
	}
	id := generateIssueID(issue)
	expected := "Pod-default-my-pod-PodFailed"
	if id != expected {
		t.Errorf("expected %s, got %s", expected, id)
	}
}

func TestLoadPersistedIssues_EmptyFile(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "monitor_issues.json")
	if err := os.Setenv("KDB_MONITOR_ISSUES_PATH", path); err != nil {
		t.Fatalf("failed to set env: %v", err)
	}
	defer os.Unsetenv("KDB_MONITOR_ISSUES_PATH")

	// Create empty file
	if err := os.WriteFile(path, []byte(""), 0644); err != nil {
		t.Fatalf("failed to create empty file: %v", err)
	}

	issues, err := loadPersistedIssues()
	if err != nil {
		t.Fatalf("loadPersistedIssues failed: %v", err)
	}
	if issues == nil {
		t.Fatalf("expected non-nil map")
	}
	if len(issues) != 0 {
		t.Errorf("expected empty map, got %d items", len(issues))
	}
}

func TestLoadPersistedIssues_NonExistent(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "nonexistent", "monitor_issues.json")
	if err := os.Setenv("KDB_MONITOR_ISSUES_PATH", path); err != nil {
		t.Fatalf("failed to set env: %v", err)
	}
	defer os.Unsetenv("KDB_MONITOR_ISSUES_PATH")

	issues, err := loadPersistedIssues()
	if err != nil {
		t.Fatalf("loadPersistedIssues failed: %v", err)
	}
	if issues == nil {
		t.Fatalf("expected non-nil map")
	}
	if len(issues) != 0 {
		t.Errorf("expected empty map, got %d items", len(issues))
	}
}

func TestAnalyzeAllMonitorIssues_Batch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/chat" {
			json.NewEncoder(w).Encode(holmesgpt.HolmesResponse{Response: "Batch response"})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "monitor_issues.json")
	if err := os.Setenv("KDB_MONITOR_ISSUES_PATH", path); err != nil {
		t.Fatalf("failed to set env: %v", err)
	}
	defer os.Unsetenv("KDB_MONITOR_ISSUES_PATH")

	holmesConfig = holmesgpt.HolmesConfigData{Enabled: true, Endpoint: server.URL}
	defer func() { holmesConfig = holmesgpt.DefaultConfig() }()

	clientset := fake.NewSimpleClientset(
		&v1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "crash-pod", Namespace: "default"},
			Status: v1.PodStatus{
				Phase: v1.PodRunning,
				ContainerStatuses: []v1.ContainerStatus{
					{
						Name: "container",
						State: v1.ContainerState{
							Waiting: &v1.ContainerStateWaiting{Reason: "CrashLoopBackOff", Message: "Crash"},
						},
					},
				},
			},
		},
		&v1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "image-pod", Namespace: "default"},
			Status: v1.PodStatus{
				Phase: v1.PodPending,
				ContainerStatuses: []v1.ContainerStatus{
					{
						Name: "container",
						State: v1.ContainerState{
							Waiting: &v1.ContainerStateWaiting{Reason: "ImagePullBackOff", Message: "Image"},
						},
					},
				},
			},
		},
	)

	app := &App{ctx: context.Background(), testClientset: clientset, preferredNamespaces: []string{"default"}}
	app.initHolmes()

	if err := app.AnalyzeAllMonitorIssues(); err != nil {
		t.Fatalf("AnalyzeAllMonitorIssues failed: %v", err)
	}

	loaded, err := loadPersistedIssues()
	if err != nil {
		t.Fatalf("loadPersistedIssues failed: %v", err)
	}
	if len(loaded) == 0 {
		t.Fatalf("expected persisted analyses")
	}

	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
}

// TestLoadPersistedIssues_NullJSON covers the branch that converts a JSON null
// result into an empty (non-nil) map.
func TestLoadPersistedIssues_NullJSON(t *testing.T) {
	f, err := os.CreateTemp(t.TempDir(), "issues-*.json")
	if err != nil {
		t.Fatalf("os.CreateTemp: %v", err)
	}
	path := f.Name()
	f.Close()
	if werr := os.WriteFile(path, []byte("null"), 0o600); werr != nil {
		t.Fatalf("write: %v", werr)
	}
	t.Setenv("KDB_MONITOR_ISSUES_PATH", path)

	issues, err := loadPersistedIssues()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if issues == nil {
		t.Error("expected non-nil map after null-JSON load")
	}
}
