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
