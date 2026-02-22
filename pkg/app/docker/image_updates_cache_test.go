package docker

import (
	"strings"
	"testing"
	"time"

	"github.com/docker/docker/api/types/swarm"
)

func TestSetCachedImageUpdate_StoresAndRetrieves(t *testing.T) {
	t.Parallel()

	serviceID := "test-svc-" + strings.Repeat("x", 8)
	info := ImageUpdateInfo{
		Image:           "nginx:1.25",
		UpdateAvailable: true,
		LocalDigest:     "sha256:local",
		RemoteDigest:    "sha256:remote",
		CheckedAt:       time.Now().UTC().Format(time.RFC3339),
	}

	setCachedImageUpdate(serviceID, info)

	swarmImageUpdateCache.mu.RLock()
	entry, ok := swarmImageUpdateCache.items[serviceID]
	swarmImageUpdateCache.mu.RUnlock()

	if !ok {
		t.Fatal("expected cache entry to exist after setCachedImageUpdate")
	}
	if entry.info.Image != "nginx:1.25" {
		t.Fatalf("expected Image=nginx:1.25, got %q", entry.info.Image)
	}
	if !entry.info.UpdateAvailable {
		t.Fatal("expected UpdateAvailable=true")
	}
	if entry.checkedAt.IsZero() {
		t.Fatal("expected checkedAt to be set")
	}
}

func TestTrimServiceIDs_FiltersBlanks(t *testing.T) {
	t.Parallel()

	cases := []struct {
		input []string
		want  []string
	}{
		{nil, []string{}},
		{[]string{}, []string{}},
		{[]string{"  ", "", "  "}, []string{}},
		{[]string{"abc", "", "  def  "}, []string{"abc", "def"}},
		{[]string{"a", "b", "c"}, []string{"a", "b", "c"}},
	}

	for _, tc := range cases {
		got := trimServiceIDs(tc.input)
		if len(got) != len(tc.want) {
			t.Fatalf("trimServiceIDs(%v)=%v want %v", tc.input, got, tc.want)
		}
		for i := range tc.want {
			if got[i] != tc.want[i] {
				t.Fatalf("trimServiceIDs(%v)[%d]=%q want %q", tc.input, i, got[i], tc.want[i])
			}
		}
	}
}

func TestFindRunningContainerID_ReturnsRunningFirst(t *testing.T) {
	t.Parallel()

	tasks := []swarm.Task{
		{
			// Non-running task with a container ID
			Status: swarm.TaskStatus{
				State:           swarm.TaskStateFailed,
				ContainerStatus: &swarm.ContainerStatus{ContainerID: "failed-container"},
			},
		},
		{
			// Running task
			Status: swarm.TaskStatus{
				State:           swarm.TaskStateRunning,
				ContainerStatus: &swarm.ContainerStatus{ContainerID: "running-container"},
			},
		},
	}

	got := findRunningContainerID(tasks)
	if got != "running-container" {
		t.Fatalf("expected running-container, got %q", got)
	}
}

func TestFindRunningContainerID_FallsBackToNonRunning(t *testing.T) {
	t.Parallel()

	tasks := []swarm.Task{
		{
			Status: swarm.TaskStatus{
				State:           swarm.TaskStateFailed,
				ContainerStatus: &swarm.ContainerStatus{ContainerID: "fallback-container"},
			},
		},
	}

	got := findRunningContainerID(tasks)
	if got != "fallback-container" {
		t.Fatalf("expected fallback-container, got %q", got)
	}
}

func TestFindRunningContainerID_NilContainerStatus(t *testing.T) {
	t.Parallel()

	tasks := []swarm.Task{
		{
			Status: swarm.TaskStatus{
				State:           swarm.TaskStateRunning,
				ContainerStatus: nil, // no container status
			},
		},
	}

	got := findRunningContainerID(tasks)
	if got != "" {
		t.Fatalf("expected empty string for nil ContainerStatus, got %q", got)
	}
}

func TestFindRunningContainerID_EmptyTaskList(t *testing.T) {
	t.Parallel()

	got := findRunningContainerID(nil)
	if got != "" {
		t.Fatalf("expected empty string for nil task list, got %q", got)
	}
}

func TestFindRunningContainerID_EmptyContainerID(t *testing.T) {
	t.Parallel()

	tasks := []swarm.Task{
		{
			Status: swarm.TaskStatus{
				State:           swarm.TaskStateRunning,
				ContainerStatus: &swarm.ContainerStatus{ContainerID: "   "}, // whitespace only
			},
		},
	}

	// TrimSpace makes "   " become "" so should not be returned as running
	got := findRunningContainerID(tasks)
	if got != "" {
		t.Fatalf("expected empty string for whitespace container ID, got %q", got)
	}
}
