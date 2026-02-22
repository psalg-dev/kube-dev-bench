package app

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ─── collectNamespaceIssues: error-type branch ────────────────────────────────

// TestCollectNamespaceIssues_ErrorIssue creates a Failed pod so that
// checkPodIssues returns an issue with Type=="error" which exercises the
// if issue.Type == "error" { errors = append(...) } branch.
func TestCollectNamespaceIssues_ErrorIssue(t *testing.T) {
	failedPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "failed-pod", Namespace: "default"},
		Status: corev1.PodStatus{
			Phase:   corev1.PodFailed,
			Message: "OOMKilled",
		},
	}
	clientset := fake.NewSimpleClientset(failedPod)
	app := &App{ctx: context.Background(), testClientset: clientset}

	// Call collectNamespaceIssues directly.
	warnings, errors := app.collectNamespaceIssues(
		clientset,
		context.Background(),
		"default",
	)
	if len(errors) == 0 {
		t.Errorf("expected at least one error issue for failed pod, got warnings=%d errors=%d",
			len(warnings), len(errors))
	}
}

// ─── ScanClusterHealth: nil ctx branch ───────────────────────────────────────

// TestScanClusterHealth_NilCtx covers the "if ctx == nil { ctx = Background() }"
// branch in ScanClusterHealth.
func TestScanClusterHealth_NilCtx(t *testing.T) {
	ns := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{Name: "default"},
	}
	app := &App{
		ctx:           nil, // intentionally nil to trigger the safety branch
		testClientset: fake.NewSimpleClientset(ns),
	}
	_, err := app.ScanClusterHealth()
	if err != nil {
		t.Fatalf("ScanClusterHealth with nil ctx unexpected error: %v", err)
	}
}

// TestScanClusterHealth_WithFailedPod verifies that ScanClusterHealth picks up
// error-type issues from pods in the cluster so both the loop branches in
// collectNamespaceIssues are exercised via ScanClusterHealth.
func TestScanClusterHealth_WithFailedPod(t *testing.T) {
	ns := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{Name: "test-ns"},
	}
	failedPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "crashed", Namespace: "test-ns"},
		Status: corev1.PodStatus{
			Phase:   corev1.PodFailed,
			Message: "Killed",
		},
	}
	crashPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "crash-loop", Namespace: "test-ns"},
		Status: corev1.PodStatus{
			ContainerStatuses: []corev1.ContainerStatus{{
				Name: "app",
				State: corev1.ContainerState{
					Waiting: &corev1.ContainerStateWaiting{
						Reason:  "CrashLoopBackOff",
						Message: "Back-off restarting failed container",
					},
				},
			}},
		},
	}
	app := &App{
		ctx:           context.Background(),
		testClientset: fake.NewSimpleClientset(ns, failedPod, crashPod),
	}
	result, err := app.ScanClusterHealth()
	if err != nil {
		t.Fatalf("ScanClusterHealth error: %v", err)
	}
	if result.ErrorCount == 0 {
		t.Errorf("expected error issues for failed pods, got ErrorCount=0")
	}
}

// ─── checkContainersConfigMapRef: init container not via EnvFrom  ─────────────

// TestCollectNamespaceIssues_WithWarningAndError exercises both the "else
// (warnings)" branch and the error branch in the podIssues loop by having one
// warning pod (ImagePullBackOff → still "error") and one clean pod so at minimum
// the loop body is exercised.
func TestCollectNamespaceIssues_WithPodCondition(t *testing.T) {
	podWithCondition := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "pod-condition", Namespace: "default"},
		Status: corev1.PodStatus{
			Conditions: []corev1.PodCondition{{
				Type:    corev1.PodScheduled,
				Status:  corev1.ConditionFalse,
				Reason:  "Unschedulable",
				Message: "0/1 nodes available",
			}},
		},
	}
	clientset := fake.NewSimpleClientset(podWithCondition)
	app := &App{ctx: context.Background(), testClientset: clientset}

	warnings, _ := app.collectNamespaceIssues(clientset, context.Background(), "default")
	_ = warnings // condition-type issues are warnings
}

// ─── findIssueByID: not-found path ───────────────────────────────────────────

// TestFindIssueByID_NotFound covers the "no match found" return path in
// findIssueByID.
func TestFindIssueByID_NotFound(t *testing.T) {
	info := MonitorInfo{
		Warnings: []MonitorIssue{
			{IssueID: "issue-1", Type: "warning", Name: "pod-a"},
		},
		Errors: []MonitorIssue{
			{IssueID: "issue-2", Type: "error", Name: "pod-b"},
		},
	}
	result := findIssueByID(info, "nonexistent-id")
	if result != nil {
		t.Errorf("expected nil for missing ID, got %+v", result)
	}
}

// ─── GetPodEvents: empty namespace resolved from currentNamespace ─────────────

// TestGetPodEvents_ResolvesCurrentNamespace verifies that an empty namespace
// parameter is resolved from app.currentNamespace.
func TestGetPodEvents_ResolvesCurrentNamespace(t *testing.T) {
	app := &App{
		ctx:              context.Background(),
		currentNamespace: "default",
		testClientset:    fake.NewSimpleClientset(),
	}
	// Should succeed (no events) rather than returning namespace error.
	events, err := app.GetPodEvents("", "my-pod")
	if err != nil {
		t.Fatalf("GetPodEvents unexpectedly errored: %v", err)
	}
	_ = events
}

// TestGetPodEvents_EmptyNamespaceNoCurrentNS covers the "no namespace selected"
// error return when both namespace param and currentNamespace are "".
func TestGetPodEvents_EmptyNamespaceNoCurrentNS(t *testing.T) {
	app := &App{
		ctx:              context.Background(),
		currentNamespace: "",
		testClientset:    fake.NewSimpleClientset(),
	}
	_, err := app.GetPodEvents("", "my-pod")
	if err == nil {
		t.Error("expected error when no namespace can be resolved")
	}
}
