package app

import (
	"context"
	"testing"
	"time"

	v1 "k8s.io/api/core/v1"
	eventsv1 "k8s.io/api/events/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/fake"
)

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
