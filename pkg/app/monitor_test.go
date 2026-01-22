package app

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	v1 "k8s.io/api/core/v1"
	eventsv1 "k8s.io/api/events/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/fake"
)

// Tests for formatAge function
func TestFormatAge_LessThanMinute(t *testing.T) {
	result := formatAge(time.Now().Add(-30 * time.Second))
	if result != "< 1m" {
		t.Errorf("Expected '< 1m', got '%s'", result)
	}
}

func TestFormatAge_Minutes(t *testing.T) {
	result := formatAge(time.Now().Add(-5 * time.Minute))
	if result != "5m" {
		t.Errorf("Expected '5m', got '%s'", result)
	}
}

func TestFormatAge_Hours(t *testing.T) {
	result := formatAge(time.Now().Add(-3 * time.Hour))
	if result != "3h" {
		t.Errorf("Expected '3h', got '%s'", result)
	}
}

func TestFormatAge_Days(t *testing.T) {
	result := formatAge(time.Now().Add(-48 * time.Hour))
	if result != "2d" {
		t.Errorf("Expected '2d', got '%s'", result)
	}
}

func TestFormatAge_EdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		duration time.Duration
		expected string
	}{
		{"exactly 1 minute", -1 * time.Minute, "1m"},
		{"exactly 1 hour", -1 * time.Hour, "1h"},
		{"exactly 24 hours", -24 * time.Hour, "1d"},
		{"59 minutes", -59 * time.Minute, "59m"},
		{"23 hours", -23 * time.Hour, "23h"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := formatAge(time.Now().Add(tc.duration))
			if result != tc.expected {
				t.Errorf("Expected '%s', got '%s'", tc.expected, result)
			}
		})
	}
}

// Tests for getOwnerInfo function
func TestGetOwnerInfo_WithOwner(t *testing.T) {
	pod := &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			OwnerReferences: []metav1.OwnerReference{
				{
					Kind: "Deployment",
					Name: "my-deployment",
				},
			},
		},
	}

	kind, name := getOwnerInfo(pod)
	if kind != "Deployment" {
		t.Errorf("Expected kind 'Deployment', got '%s'", kind)
	}
	if name != "my-deployment" {
		t.Errorf("Expected name 'my-deployment', got '%s'", name)
	}
}

func TestGetOwnerInfo_NoOwner(t *testing.T) {
	pod := &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			OwnerReferences: []metav1.OwnerReference{},
		},
	}

	kind, name := getOwnerInfo(pod)
	if kind != "" {
		t.Errorf("Expected empty kind, got '%s'", kind)
	}
	if name != "" {
		t.Errorf("Expected empty name, got '%s'", name)
	}
}

// Helper to create an App with a fake clientset for testing
func newTestApp(clientset kubernetes.Interface) *App {
	return &App{
		ctx:                 context.Background(),
		preferredNamespaces: []string{"default"},
		testClientset:       clientset,
	}
}

func TestCheckPodIssues_FailedPod(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "failed-pod",
			Namespace: "default",
		},
		Status: v1.PodStatus{
			Phase:   v1.PodFailed,
			Message: "Pod failed to start",
		},
	})
	app := newTestApp(clientset)

	issues := app.checkPodIssues("default")

	if len(issues) != 1 {
		t.Fatalf("Expected 1 issue, got %d", len(issues))
	}

	issue := issues[0]
	if issue.Type != "error" {
		t.Errorf("Expected issue type 'error', got '%s'", issue.Type)
	}
	if issue.Resource != "Pod" {
		t.Errorf("Expected resource 'Pod', got '%s'", issue.Resource)
	}
	if issue.Name != "failed-pod" {
		t.Errorf("Expected name 'failed-pod', got '%s'", issue.Name)
	}
	if issue.Reason != "PodFailed" {
		t.Errorf("Expected reason 'PodFailed', got '%s'", issue.Reason)
	}
}

func TestCheckPodIssues_CrashLoopBackOff(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "crashloop-pod",
			Namespace: "default",
		},
		Status: v1.PodStatus{
			Phase: v1.PodRunning,
			ContainerStatuses: []v1.ContainerStatus{
				{
					Name: "container",
					State: v1.ContainerState{
						Waiting: &v1.ContainerStateWaiting{
							Reason:  "CrashLoopBackOff",
							Message: "Back-off restarting failed container",
						},
					},
				},
			},
		},
	})
	app := newTestApp(clientset)

	issues := app.checkPodIssues("default")

	if len(issues) != 1 {
		t.Fatalf("Expected 1 issue, got %d", len(issues))
	}

	issue := issues[0]
	if issue.Type != "error" {
		t.Errorf("Expected issue type 'error', got '%s'", issue.Type)
	}
	if issue.Reason != "CrashLoopBackOff" {
		t.Errorf("Expected reason 'CrashLoopBackOff', got '%s'", issue.Reason)
	}
}

func TestCheckPodIssues_ImagePullBackOff(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "imagepull-pod",
			Namespace: "default",
		},
		Status: v1.PodStatus{
			Phase: v1.PodPending,
			ContainerStatuses: []v1.ContainerStatus{
				{
					Name: "container",
					State: v1.ContainerState{
						Waiting: &v1.ContainerStateWaiting{
							Reason:  "ImagePullBackOff",
							Message: "Failed to pull image",
						},
					},
				},
			},
		},
	})
	app := newTestApp(clientset)

	issues := app.checkPodIssues("default")

	if len(issues) != 1 {
		t.Fatalf("Expected 1 issue, got %d", len(issues))
	}

	issue := issues[0]
	if issue.Type != "error" {
		t.Errorf("Expected issue type 'error', got '%s'", issue.Type)
	}
	if issue.Reason != "ImagePullBackOff" {
		t.Errorf("Expected reason 'ImagePullBackOff', got '%s'", issue.Reason)
	}
}

func TestCheckPodIssues_HealthyPod(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "healthy-pod",
			Namespace: "default",
		},
		Status: v1.PodStatus{
			Phase: v1.PodRunning,
			ContainerStatuses: []v1.ContainerStatus{
				{
					Name: "container",
					State: v1.ContainerState{
						Running: &v1.ContainerStateRunning{
							StartedAt: metav1.Time{Time: time.Now()},
						},
					},
				},
			},
		},
	})
	app := newTestApp(clientset)

	issues := app.checkPodIssues("default")

	if len(issues) != 0 {
		t.Fatalf("Expected 0 issues for healthy pod, got %d", len(issues))
	}
}

func TestCheckEventIssues_WarningEvents(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-event",
			Namespace: "default",
		},
		InvolvedObject: v1.ObjectReference{
			Kind:      "Pod",
			Name:      "test-pod",
			Namespace: "default",
		},
		Type:    "Warning",
		Reason:  "FailedScheduling",
		Message: "0/1 nodes are available",
		LastTimestamp: metav1.Time{
			Time: time.Now(),
		},
	})
	app := newTestApp(clientset)

	issues := app.checkEventIssues("default")

	if len(issues) != 1 {
		t.Fatalf("Expected 1 issue, got %d", len(issues))
	}

	issue := issues[0]
	if issue.Type != "warning" {
		t.Errorf("Expected issue type 'warning', got '%s'", issue.Type)
	}
	if issue.Reason != "FailedScheduling" {
		t.Errorf("Expected reason 'FailedScheduling', got '%s'", issue.Reason)
	}
}

func TestCollectMonitorInfo_FiltersDismissedIssues(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "monitor_issues.json")
	if err := os.Setenv("KDB_MONITOR_ISSUES_PATH", path); err != nil {
		t.Fatalf("failed to set env: %v", err)
	}
	defer os.Unsetenv("KDB_MONITOR_ISSUES_PATH")

	clientset := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "dismissed-pod",
			Namespace: "default",
		},
		Status: v1.PodStatus{
			Phase: v1.PodRunning,
			ContainerStatuses: []v1.ContainerStatus{
				{
					Name: "container",
					State: v1.ContainerState{
						Waiting: &v1.ContainerStateWaiting{
							Reason:  "CrashLoopBackOff",
							Message: "Back-off restarting failed container",
						},
					},
				},
			},
		},
	})
	app := newTestApp(clientset)

	issue := MonitorIssue{
		Resource:  "Pod",
		Namespace: "default",
		Name:      "dismissed-pod",
		Reason:    "CrashLoopBackOff",
	}
	issueID := generateIssueID(issue)
	persisted := map[string]PersistedIssue{
		issueID: {
			IssueID:     issueID,
			Dismissed:   true,
			DismissedAt: time.Now(),
		},
	}
	if err := savePersistedIssues(persisted); err != nil {
		t.Fatalf("savePersistedIssues failed: %v", err)
	}

	info := app.collectMonitorInfo([]string{"default"})
	if info.ErrorCount != 0 {
		t.Fatalf("expected dismissed issue to be filtered, got %d errors", info.ErrorCount)
	}
}

func TestCheckEventIssues_OldEventsIgnored(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "old-event",
			Namespace: "default",
		},
		InvolvedObject: v1.ObjectReference{
			Kind:      "Pod",
			Name:      "test-pod",
			Namespace: "default",
		},
		Type:    "Warning",
		Reason:  "FailedScheduling",
		Message: "0/1 nodes are available",
		LastTimestamp: metav1.Time{
			Time: time.Now().Add(-11 * time.Minute),
		},
	})
	app := newTestApp(clientset)

	issues := app.checkEventIssues("default")

	if len(issues) != 0 {
		t.Fatalf("Expected 0 issues for old events, got %d", len(issues))
	}
}

func TestCheckEventIssues_NormalEventsIgnored(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "normal-event",
			Namespace: "default",
		},
		InvolvedObject: v1.ObjectReference{
			Kind:      "Pod",
			Name:      "test-pod",
			Namespace: "default",
		},
		Type:    "Normal",
		Reason:  "Started",
		Message: "Container started",
		LastTimestamp: metav1.Time{
			Time: time.Now(),
		},
	})
	app := newTestApp(clientset)

	issues := app.checkEventIssues("default")

	if len(issues) != 0 {
		t.Fatalf("Expected 0 issues for normal events, got %d", len(issues))
	}
}

func TestCheckEventIssues_EventsV1(t *testing.T) {
	clientset := fake.NewSimpleClientset(&eventsv1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-event-v1",
			Namespace: "default",
		},
		Regarding: v1.ObjectReference{
			Kind:      "Pod",
			Name:      "test-pod",
			Namespace: "default",
		},
		Type:      "Warning",
		Reason:    "BackOff",
		Note:      "Back-off restarting failed container",
		EventTime: metav1.MicroTime{Time: time.Now()},
	})
	app := newTestApp(clientset)

	issues := app.checkEventIssues("default")

	if len(issues) != 1 {
		t.Fatalf("Expected 1 issue, got %d", len(issues))
	}

	issue := issues[0]
	if issue.Type != "warning" {
		t.Errorf("Expected issue type 'warning', got '%s'", issue.Type)
	}
	if issue.Reason != "BackOff" {
		t.Errorf("Expected reason 'BackOff', got '%s'", issue.Reason)
	}
}

func TestCollectMonitorInfo(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&v1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "failed-pod",
				Namespace: "default",
			},
			Status: v1.PodStatus{
				Phase:   v1.PodFailed,
				Message: "Pod failed",
			},
		},
		&v1.Event{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "warning-event",
				Namespace: "default",
			},
			InvolvedObject: v1.ObjectReference{
				Kind:      "Pod",
				Name:      "test-pod",
				Namespace: "default",
			},
			Type:    "Warning",
			Reason:  "FailedScheduling",
			Message: "0/1 nodes are available",
			LastTimestamp: metav1.Time{
				Time: time.Now(),
			},
		},
	)
	app := newTestApp(clientset)

	info := app.collectMonitorInfo([]string{"default"})

	if info.ErrorCount != 1 {
		t.Errorf("Expected 1 error, got %d", info.ErrorCount)
	}
	if info.WarningCount != 1 {
		t.Errorf("Expected 1 warning, got %d", info.WarningCount)
	}
	if len(info.Errors) != 1 {
		t.Errorf("Expected 1 error in list, got %d", len(info.Errors))
	}
	if len(info.Warnings) != 1 {
		t.Errorf("Expected 1 warning in list, got %d", len(info.Warnings))
	}
}

func TestCheckPodIssues_ErrImagePull(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "errimagepull-pod",
			Namespace: "default",
		},
		Status: v1.PodStatus{
			Phase: v1.PodPending,
			ContainerStatuses: []v1.ContainerStatus{
				{
					Name: "container",
					State: v1.ContainerState{
						Waiting: &v1.ContainerStateWaiting{
							Reason:  "ErrImagePull",
							Message: "Error pulling image",
						},
					},
				},
			},
		},
	})
	app := newTestApp(clientset)

	issues := app.checkPodIssues("default")

	if len(issues) != 1 {
		t.Fatalf("Expected 1 issue, got %d", len(issues))
	}

	issue := issues[0]
	if issue.Type != "error" {
		t.Errorf("Expected issue type 'error', got '%s'", issue.Type)
	}
	if issue.Reason != "ErrImagePull" {
		t.Errorf("Expected reason 'ErrImagePull', got '%s'", issue.Reason)
	}
}

func TestCheckPodIssues_CreateContainerError(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "container-error-pod",
			Namespace: "default",
		},
		Status: v1.PodStatus{
			Phase: v1.PodPending,
			ContainerStatuses: []v1.ContainerStatus{
				{
					Name: "container",
					State: v1.ContainerState{
						Waiting: &v1.ContainerStateWaiting{
							Reason:  "CreateContainerError",
							Message: "Error creating container",
						},
					},
				},
			},
		},
	})
	app := newTestApp(clientset)

	issues := app.checkPodIssues("default")

	if len(issues) != 1 {
		t.Fatalf("Expected 1 issue, got %d", len(issues))
	}

	if issues[0].Type != "error" {
		t.Errorf("Expected issue type 'error', got '%s'", issues[0].Type)
	}
}

func TestCheckPodIssues_TerminatedWithNonZeroExit(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "terminated-pod",
			Namespace: "default",
		},
		Status: v1.PodStatus{
			Phase: v1.PodFailed,
			ContainerStatuses: []v1.ContainerStatus{
				{
					Name: "container",
					State: v1.ContainerState{
						Terminated: &v1.ContainerStateTerminated{
							ExitCode: 1,
							Reason:   "Error",
							Message:  "Container exited with error",
						},
					},
				},
			},
		},
	})
	app := newTestApp(clientset)

	issues := app.checkPodIssues("default")

	// Should have issues for both PodFailed and terminated container
	if len(issues) < 1 {
		t.Fatalf("Expected at least 1 issue, got %d", len(issues))
	}
}

func TestCheckPodIssues_InitContainerWaiting(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "init-waiting-pod",
			Namespace: "default",
		},
		Status: v1.PodStatus{
			Phase: v1.PodPending,
			InitContainerStatuses: []v1.ContainerStatus{
				{
					Name: "init-container",
					State: v1.ContainerState{
						Waiting: &v1.ContainerStateWaiting{
							Reason:  "ImagePullBackOff",
							Message: "Failed to pull init image",
						},
					},
				},
			},
		},
	})
	app := newTestApp(clientset)

	issues := app.checkPodIssues("default")

	if len(issues) != 1 {
		t.Fatalf("Expected 1 issue, got %d", len(issues))
	}

	issue := issues[0]
	if issue.Type != "error" {
		t.Errorf("Expected issue type 'error', got '%s'", issue.Type)
	}
	if issue.ContainerName != "init-container (init)" {
		t.Errorf("Expected container name 'init-container (init)', got '%s'", issue.ContainerName)
	}
}

func TestCheckPodIssues_PodConditionFalse(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "condition-false-pod",
			Namespace: "default",
		},
		Status: v1.PodStatus{
			Phase: v1.PodRunning,
			Conditions: []v1.PodCondition{
				{
					Type:    v1.PodReady,
					Status:  v1.ConditionFalse,
					Message: "Container not ready",
				},
			},
		},
	})
	app := newTestApp(clientset)

	issues := app.checkPodIssues("default")

	if len(issues) != 1 {
		t.Fatalf("Expected 1 issue, got %d", len(issues))
	}

	issue := issues[0]
	if issue.Type != "warning" {
		t.Errorf("Expected issue type 'warning', got '%s'", issue.Type)
	}
	if issue.Reason != "ReadyFalse" {
		t.Errorf("Expected reason 'ReadyFalse', got '%s'", issue.Reason)
	}
}

func TestCheckPodIssues_HighRestarts(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "high-restarts-pod",
			Namespace: "default",
		},
		Status: v1.PodStatus{
			Phase: v1.PodRunning,
			ContainerStatuses: []v1.ContainerStatus{
				{
					Name:         "container",
					RestartCount: 5,
					State: v1.ContainerState{
						Running: &v1.ContainerStateRunning{
							StartedAt: metav1.Time{Time: time.Now()},
						},
					},
					LastTerminationState: v1.ContainerState{
						Terminated: &v1.ContainerStateTerminated{
							FinishedAt: metav1.Time{Time: time.Now().Add(-2 * time.Minute)},
							Message:    "OOMKilled",
						},
					},
				},
			},
		},
	})
	app := newTestApp(clientset)

	issues := app.checkPodIssues("default")

	if len(issues) != 1 {
		t.Fatalf("Expected 1 issue, got %d", len(issues))
	}

	issue := issues[0]
	if issue.Reason != "HighRestarts" {
		t.Errorf("Expected reason 'HighRestarts', got '%s'", issue.Reason)
	}
	if issue.RestartCount != 5 {
		t.Errorf("Expected restart count 5, got %d", issue.RestartCount)
	}
}

func TestCheckPodIssues_WaitingWarning(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "waiting-pod",
			Namespace: "default",
		},
		Status: v1.PodStatus{
			Phase: v1.PodPending,
			ContainerStatuses: []v1.ContainerStatus{
				{
					Name: "container",
					State: v1.ContainerState{
						Waiting: &v1.ContainerStateWaiting{
							Reason:  "ContainerCreating",
							Message: "Container is being created",
						},
					},
				},
			},
		},
	})
	app := newTestApp(clientset)

	issues := app.checkPodIssues("default")

	if len(issues) != 1 {
		t.Fatalf("Expected 1 issue, got %d", len(issues))
	}

	issue := issues[0]
	// ContainerCreating is not in the error list, so it should be a warning
	if issue.Type != "warning" {
		t.Errorf("Expected issue type 'warning', got '%s'", issue.Type)
	}
}

func TestCheckPodIssues_PodWithOwner(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "owned-pod",
			Namespace: "default",
			OwnerReferences: []metav1.OwnerReference{
				{
					Kind: "ReplicaSet",
					Name: "my-replicaset",
				},
			},
		},
		Status: v1.PodStatus{
			Phase:   v1.PodFailed,
			Message: "Pod failed",
		},
		Spec: v1.PodSpec{
			NodeName: "worker-node-1",
		},
	})
	app := newTestApp(clientset)

	issues := app.checkPodIssues("default")

	if len(issues) != 1 {
		t.Fatalf("Expected 1 issue, got %d", len(issues))
	}

	issue := issues[0]
	if issue.OwnerKind != "ReplicaSet" {
		t.Errorf("Expected owner kind 'ReplicaSet', got '%s'", issue.OwnerKind)
	}
	if issue.OwnerName != "my-replicaset" {
		t.Errorf("Expected owner name 'my-replicaset', got '%s'", issue.OwnerName)
	}
	if issue.NodeName != "worker-node-1" {
		t.Errorf("Expected node name 'worker-node-1', got '%s'", issue.NodeName)
	}
}

func TestCollectMonitorInfo_MultipleNamespaces(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&v1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "failed-pod-1",
				Namespace: "ns1",
			},
			Status: v1.PodStatus{
				Phase: v1.PodFailed,
			},
		},
		&v1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "failed-pod-2",
				Namespace: "ns2",
			},
			Status: v1.PodStatus{
				Phase: v1.PodFailed,
			},
		},
	)
	app := newTestApp(clientset)

	info := app.collectMonitorInfo([]string{"ns1", "ns2"})

	if info.ErrorCount != 2 {
		t.Errorf("Expected 2 errors, got %d", info.ErrorCount)
	}
}

func TestCollectMonitorInfo_EmptyNamespaces(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := newTestApp(clientset)

	info := app.collectMonitorInfo([]string{})

	if info.ErrorCount != 0 {
		t.Errorf("Expected 0 errors, got %d", info.ErrorCount)
	}
	if info.WarningCount != 0 {
		t.Errorf("Expected 0 warnings, got %d", info.WarningCount)
	}
}

func TestCheckEventIssues_EventTimeField(t *testing.T) {
	// Test event with EventTime instead of LastTimestamp
	clientset := fake.NewSimpleClientset(&v1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "event-with-eventtime",
			Namespace: "default",
		},
		InvolvedObject: v1.ObjectReference{
			Kind: "Pod",
			Name: "test-pod",
		},
		Type:      "Warning",
		Reason:    "FailedMount",
		Message:   "Unable to mount volume",
		EventTime: metav1.MicroTime{Time: time.Now()},
	})
	app := newTestApp(clientset)

	issues := app.checkEventIssues("default")

	if len(issues) != 1 {
		t.Fatalf("Expected 1 issue, got %d", len(issues))
	}
}
