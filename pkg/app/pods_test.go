package app

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"testing"
	"time"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"
	types "k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes/fake"
	ktesting "k8s.io/client-go/testing"
)

// Tests for terminalSizeQueue
func TestNewTerminalSizeQueue(t *testing.T) {
	q := newTerminalSizeQueue()
	if q == nil {
		t.Fatal("newTerminalSizeQueue() returned nil")
	}
	if q.ch == nil {
		t.Error("channel should be initialized")
	}
}

func TestTerminalSizeQueue_PushAndNext(t *testing.T) {
	q := newTerminalSizeQueue()

	// Push a size
	q.Push(80, 24)

	// Get the size
	size := q.Next()
	if size == nil {
		t.Fatal("Next() returned nil")
	}
	if size.Width != 80 {
		t.Errorf("Width = %d, want 80", size.Width)
	}
	if size.Height != 24 {
		t.Errorf("Height = %d, want 24", size.Height)
	}
}

func TestTerminalSizeQueue_Close(t *testing.T) {
	q := newTerminalSizeQueue()

	// Close the queue
	q.Close()

	// Next should return nil after close
	size := q.Next()
	if size != nil {
		t.Error("Next() should return nil after Close()")
	}
}

func TestTerminalSizeQueue_CloseMultipleTimes(t *testing.T) {
	q := newTerminalSizeQueue()

	// Close multiple times should not panic
	q.Close()
	q.Close()
	q.Close()
}

func TestTerminalSizeQueue_PushNil(t *testing.T) {
	var q *terminalSizeQueue
	// Push on nil queue should not panic
	q.Push(80, 24)
}

func TestTerminalSizeQueue_CloseNil(t *testing.T) {
	var q *terminalSizeQueue
	// Close on nil queue should not panic
	q.Close()
}

func TestTerminalSizeQueue_BufferFull(t *testing.T) {
	q := newTerminalSizeQueue()

	// Push more than buffer can hold (buffer size is 4)
	for i := 0; i < 10; i++ {
		q.Push(uint16(80+i), uint16(24+i))
	}

	// Should not panic, just drops extra
	// Verify first 4 are still there
	for i := 0; i < 4; i++ {
		size := q.Next()
		if size == nil {
			t.Fatalf("Expected size at index %d", i)
		}
	}
}

// Tests for portForwardKey function
func TestPortForwardKey(t *testing.T) {
	tests := []struct {
		name     string
		ns       string
		pod      string
		port     int
		expected string
	}{
		{"default namespace", "default", "nginx", 80, "default/nginx:80:80"},
		{"custom namespace", "kube-system", "coredns", 53, "kube-system/coredns:53:53"},
		{"high port", "myns", "mypod", 8443, "myns/mypod:8443:8443"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := portForwardKey(tc.ns, tc.pod, tc.port)
			if result != tc.expected {
				t.Errorf("portForwardKey(%q, %q, %d) = %q, want %q", tc.ns, tc.pod, tc.port, result, tc.expected)
			}
		})
	}
}

// Tests for portForwardKeyLR function
func TestPortForwardKeyLR(t *testing.T) {
	tests := []struct {
		name     string
		ns       string
		pod      string
		local    int
		remote   int
		expected string
	}{
		{"same ports", "default", "nginx", 80, 80, "default/nginx:80:80"},
		{"different ports", "default", "nginx", 8080, 80, "default/nginx:8080:80"},
		{"reverse mapping", "ns1", "pod1", 3000, 8000, "ns1/pod1:3000:8000"},
		{"high ports", "ns", "pod", 50000, 443, "ns/pod:50000:443"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := portForwardKeyLR(tc.ns, tc.pod, tc.local, tc.remote)
			if result != tc.expected {
				t.Errorf("portForwardKeyLR(%q, %q, %d, %d) = %q, want %q",
					tc.ns, tc.pod, tc.local, tc.remote, result, tc.expected)
			}
		})
	}
}

// Tests for termOutputEvent and termExitEvent
func TestTermOutputEvent(t *testing.T) {
	result := termOutputEvent("session-123")
	expected := "terminal:session-123:output"
	if result != expected {
		t.Errorf("termOutputEvent(\"session-123\") = %q, want %q", result, expected)
	}
}

func TestTermExitEvent(t *testing.T) {
	result := termExitEvent("session-123")
	expected := "terminal:session-123:exit"
	if result != expected {
		t.Errorf("termExitEvent(\"session-123\") = %q, want %q", result, expected)
	}
}

// Helper to create a test app with fake clientset
func newTestAppWithClientset(clientset *fake.Clientset) *App {
	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}
	return app
}

// Tests for GetPodStatusCounts function
func TestGetPodStatusCounts(t *testing.T) {
	tests := []struct {
		name      string
		namespace string
		pods      []v1.Pod
		expected  PodStatusCounts
	}{
		{
			name:      "empty namespace",
			namespace: "default",
			pods:      []v1.Pod{},
			expected:  PodStatusCounts{Total: 0},
		},
		{
			name:      "single running pod",
			namespace: "default",
			pods: []v1.Pod{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pod1", Namespace: "default"},
					Status:     v1.PodStatus{Phase: v1.PodRunning},
				},
			},
			expected: PodStatusCounts{Running: 1, Total: 1},
		},
		{
			name:      "single pending pod",
			namespace: "default",
			pods: []v1.Pod{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pod1", Namespace: "default"},
					Status:     v1.PodStatus{Phase: v1.PodPending},
				},
			},
			expected: PodStatusCounts{Pending: 1, Total: 1},
		},
		{
			name:      "single failed pod",
			namespace: "default",
			pods: []v1.Pod{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pod1", Namespace: "default"},
					Status:     v1.PodStatus{Phase: v1.PodFailed},
				},
			},
			expected: PodStatusCounts{Failed: 1, Total: 1},
		},
		{
			name:      "single succeeded pod",
			namespace: "default",
			pods: []v1.Pod{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pod1", Namespace: "default"},
					Status:     v1.PodStatus{Phase: v1.PodSucceeded},
				},
			},
			expected: PodStatusCounts{Succeeded: 1, Total: 1},
		},
		{
			name:      "single unknown pod",
			namespace: "default",
			pods: []v1.Pod{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pod1", Namespace: "default"},
					Status:     v1.PodStatus{Phase: v1.PodUnknown},
				},
			},
			expected: PodStatusCounts{Unknown: 1, Total: 1},
		},
		{
			name:      "mixed pod statuses",
			namespace: "default",
			pods: []v1.Pod{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pod1", Namespace: "default"},
					Status:     v1.PodStatus{Phase: v1.PodRunning},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pod2", Namespace: "default"},
					Status:     v1.PodStatus{Phase: v1.PodRunning},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pod3", Namespace: "default"},
					Status:     v1.PodStatus{Phase: v1.PodPending},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pod4", Namespace: "default"},
					Status:     v1.PodStatus{Phase: v1.PodFailed},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pod5", Namespace: "default"},
					Status:     v1.PodStatus{Phase: v1.PodSucceeded},
				},
			},
			expected: PodStatusCounts{Running: 2, Pending: 1, Failed: 1, Succeeded: 1, Total: 5},
		},
		{
			name:      "pods in different namespaces - only counts matching",
			namespace: "target-ns",
			pods: []v1.Pod{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pod1", Namespace: "target-ns"},
					Status:     v1.PodStatus{Phase: v1.PodRunning},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pod2", Namespace: "other-ns"},
					Status:     v1.PodStatus{Phase: v1.PodRunning},
				},
			},
			expected: PodStatusCounts{Running: 1, Total: 1},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create fake clientset with pods
			clientset := fake.NewSimpleClientset()
			for _, pod := range tc.pods {
				_, err := clientset.CoreV1().Pods(pod.Namespace).Create(context.Background(), &pod, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create pod: %v", err)
				}
			}

			app := newTestAppWithClientset(clientset)
			result, err := app.GetPodStatusCounts(tc.namespace)
			if err != nil {
				t.Fatalf("GetPodStatusCounts failed: %v", err)
			}

			if result != tc.expected {
				t.Errorf("GetPodStatusCounts(%q) = %+v, want %+v", tc.namespace, result, tc.expected)
			}
		})
	}
}

// Tests for GetRunningPods function
func TestGetRunningPods(t *testing.T) {
	now := time.Now()
	startTime := metav1.NewTime(now.Add(-1 * time.Hour))

	tests := []struct {
		name          string
		namespace     string
		pods          []v1.Pod
		expectedCount int
		expectedNames []string
	}{
		{
			name:          "empty namespace",
			namespace:     "default",
			pods:          []v1.Pod{},
			expectedCount: 0,
			expectedNames: nil,
		},
		{
			name:      "running pods included",
			namespace: "default",
			pods: []v1.Pod{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "running-pod", Namespace: "default"},
					Status:     v1.PodStatus{Phase: v1.PodRunning, StartTime: &startTime},
				},
			},
			expectedCount: 1,
			expectedNames: []string{"running-pod"},
		},
		{
			name:      "pending pods included",
			namespace: "default",
			pods: []v1.Pod{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pending-pod", Namespace: "default"},
					Status:     v1.PodStatus{Phase: v1.PodPending},
				},
			},
			expectedCount: 1,
			expectedNames: []string{"pending-pod"},
		},
		{
			name:      "failed pods excluded unless Job-owned",
			namespace: "default",
			pods: []v1.Pod{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "failed-pod", Namespace: "default"},
					Status:     v1.PodStatus{Phase: v1.PodFailed},
				},
			},
			expectedCount: 0,
			expectedNames: nil,
		},
		{
			name:      "job-owned pod included even if failed",
			namespace: "default",
			pods: []v1.Pod{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "job-pod",
						Namespace: "default",
						OwnerReferences: []metav1.OwnerReference{
							{Kind: "Job", Name: "my-job"},
						},
					},
					Status: v1.PodStatus{Phase: v1.PodFailed},
				},
			},
			expectedCount: 1,
			expectedNames: []string{"job-pod"},
		},
		{
			name:      "counts restart count from containers",
			namespace: "default",
			pods: []v1.Pod{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "restarting-pod", Namespace: "default"},
					Status: v1.PodStatus{
						Phase:     v1.PodRunning,
						StartTime: &startTime,
						ContainerStatuses: []v1.ContainerStatus{
							{RestartCount: 3},
							{RestartCount: 2},
						},
					},
				},
			},
			expectedCount: 1,
			expectedNames: []string{"restarting-pod"},
		},
		{
			name:      "filters by namespace",
			namespace: "target-ns",
			pods: []v1.Pod{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pod-in-target", Namespace: "target-ns"},
					Status:     v1.PodStatus{Phase: v1.PodRunning, StartTime: &startTime},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pod-in-other", Namespace: "other-ns"},
					Status:     v1.PodStatus{Phase: v1.PodRunning, StartTime: &startTime},
				},
			},
			expectedCount: 1,
			expectedNames: []string{"pod-in-target"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			for _, pod := range tc.pods {
				_, err := clientset.CoreV1().Pods(pod.Namespace).Create(context.Background(), &pod, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create pod: %v", err)
				}
			}

			app := newTestAppWithClientset(clientset)
			result, err := app.GetRunningPods(tc.namespace)
			if err != nil {
				t.Fatalf("GetRunningPods failed: %v", err)
			}

			if len(result) != tc.expectedCount {
				t.Errorf("expected %d pods, got %d", tc.expectedCount, len(result))
			}

			// Check pod names match expected
			for i, expectedName := range tc.expectedNames {
				if i < len(result) && result[i].Name != expectedName {
					t.Errorf("expected pod name %q, got %q", expectedName, result[i].Name)
				}
			}
		})
	}
}

// Test GetRunningPods returns correct restarts
func TestGetRunningPods_RestartsCount(t *testing.T) {
	startTime := metav1.NewTime(time.Now().Add(-1 * time.Hour))
	clientset := fake.NewSimpleClientset()

	pod := &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "pod-with-restarts", Namespace: "default"},
		Status: v1.PodStatus{
			Phase:     v1.PodRunning,
			StartTime: &startTime,
			ContainerStatuses: []v1.ContainerStatus{
				{Name: "container-1", RestartCount: 3},
				{Name: "container-2", RestartCount: 5},
			},
		},
	}

	_, err := clientset.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pod: %v", err)
	}

	app := newTestAppWithClientset(clientset)
	result, err := app.GetRunningPods("default")
	if err != nil {
		t.Fatalf("GetRunningPods failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 pod, got %d", len(result))
	}

	// Restarts should be sum of all container restarts
	if result[0].Restarts != 8 {
		t.Errorf("expected 8 restarts, got %d", result[0].Restarts)
	}
}

// Test GetRunningPods returns correct ports
func TestGetRunningPods_Ports(t *testing.T) {
	startTime := metav1.NewTime(time.Now().Add(-1 * time.Hour))
	clientset := fake.NewSimpleClientset()

	pod := &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "pod-with-ports", Namespace: "default"},
		Spec: v1.PodSpec{
			Containers: []v1.Container{
				{
					Name: "container-1",
					Ports: []v1.ContainerPort{
						{ContainerPort: 8080},
						{ContainerPort: 9090},
					},
				},
				{
					Name: "container-2",
					Ports: []v1.ContainerPort{
						{ContainerPort: 3000},
					},
				},
			},
		},
		Status: v1.PodStatus{
			Phase:     v1.PodRunning,
			StartTime: &startTime,
		},
	}

	_, err := clientset.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pod: %v", err)
	}

	app := newTestAppWithClientset(clientset)
	result, err := app.GetRunningPods("default")
	if err != nil {
		t.Fatalf("GetRunningPods failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 pod, got %d", len(result))
	}

	// Should have 3 unique ports
	if len(result[0].Ports) != 3 {
		t.Errorf("expected 3 ports, got %d", len(result[0].Ports))
	}
}

// Tests for DeletePod
func TestDeletePod(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	pod := &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "test-pod", Namespace: "default"},
		Status:     v1.PodStatus{Phase: v1.PodRunning},
	}
	_, _ = clientset.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})

	app := newTestAppWithClientset(clientset)
	err := app.DeletePod("default", "test-pod")
	if err != nil {
		t.Fatalf("DeletePod failed: %v", err)
	}

	// Verify pod was deleted
	_, err = clientset.CoreV1().Pods("default").Get(context.Background(), "test-pod", metav1.GetOptions{})
	if err == nil {
		t.Error("expected pod to be deleted")
	}
}

// Tests for RestartPod
func TestRestartPod(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	pod := &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "test-pod", Namespace: "default"},
		Status:     v1.PodStatus{Phase: v1.PodRunning},
	}
	_, _ = clientset.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})

	app := newTestAppWithClientset(clientset)
	err := app.RestartPod("default", "test-pod")
	if err != nil {
		t.Fatalf("RestartPod failed: %v", err)
	}
}

// Tests for ShellPod
func TestShellPod(t *testing.T) {
	app := &App{}

	cmd, err := app.ShellPod("default", "test-pod")
	if err != nil {
		t.Fatalf("ShellPod failed: %v", err)
	}

	if cmd == "" {
		t.Error("expected non-empty command")
	}

	// Should contain namespace and pod name
	if !strings.Contains(cmd, "default") || !strings.Contains(cmd, "test-pod") {
		t.Errorf("command should contain namespace and pod name: %s", cmd)
	}
}
