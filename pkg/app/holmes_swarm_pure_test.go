package app

import (
	"strings"
	"testing"

	"github.com/docker/docker/api/types/swarm"
)

// ---------------------------------------------------------------------------
// TestWriteNodeTasksContext – pure function using swarm.Task
// ---------------------------------------------------------------------------

func TestWriteNodeTasksContext(t *testing.T) {
	t.Run("no tasks", func(t *testing.T) {
		var sb strings.Builder
		writeNodeTasksContext(&sb, nil)
		out := sb.String()
		if !strings.Contains(out, "0") {
			t.Errorf("expected 0 tasks in output: %s", out)
		}
	})

	t.Run("single task without error", func(t *testing.T) {
		var sb strings.Builder
		tasks := []swarm.Task{
			{
				ID:        "abc123def456",
				ServiceID: "svc123abc",
				Status: swarm.TaskStatus{
					State: swarm.TaskStateRunning,
				},
			},
		}
		writeNodeTasksContext(&sb, tasks)
		out := sb.String()
		if !strings.Contains(out, "running") {
			t.Errorf("expected 'running' in output: %s", out)
		}
	})

	t.Run("task with error", func(t *testing.T) {
		var sb strings.Builder
		tasks := []swarm.Task{
			{
				ID:        "failid12345",
				ServiceID: "svcfail",
				Status: swarm.TaskStatus{
					State: swarm.TaskStateFailed,
					Err:   "container exited with code 1",
				},
			},
		}
		writeNodeTasksContext(&sb, tasks)
		out := sb.String()
		if !strings.Contains(out, "container exited") {
			t.Errorf("expected error message in output: %s", out)
		}
	})

	t.Run("multiple tasks", func(t *testing.T) {
		var sb strings.Builder
		tasks := []swarm.Task{
			{ID: "t1", ServiceID: "s1", Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
			{ID: "t2", ServiceID: "s2", Status: swarm.TaskStatus{State: swarm.TaskStatePending}},
			{ID: "t3", ServiceID: "s3", Status: swarm.TaskStatus{State: swarm.TaskStateFailed, Err: "OOM"}},
		}
		writeNodeTasksContext(&sb, tasks)
		out := sb.String()
		if !strings.Contains(out, "3") {
			t.Errorf("expected count 3 in output: %s", out)
		}
		if !strings.Contains(out, "OOM") {
			t.Errorf("expected OOM error in output: %s", out)
		}
	})
}

// ---------------------------------------------------------------------------
// TestFormatServiceReplicas – pure function
// ---------------------------------------------------------------------------

func TestFormatServiceReplicas(t *testing.T) {
	t.Run("replicated mode", func(t *testing.T) {
		replicas := uint64(5)
		svc := swarm.Service{
			Spec: swarm.ServiceSpec{
				Mode: swarm.ServiceMode{
					Replicated: &swarm.ReplicatedService{Replicas: &replicas},
				},
			},
		}
		got := formatServiceReplicas(svc)
		if !strings.Contains(got, "5") {
			t.Errorf("expected '5' in output: %q", got)
		}
		if !strings.Contains(got, "replicas") {
			t.Errorf("expected 'replicas' in output: %q", got)
		}
	})

	t.Run("global mode", func(t *testing.T) {
		svc := swarm.Service{
			Spec: swarm.ServiceSpec{
				Mode: swarm.ServiceMode{
					Global: &swarm.GlobalService{},
				},
			},
		}
		got := formatServiceReplicas(svc)
		if got != "global" {
			t.Errorf("expected 'global', got %q", got)
		}
	})

	t.Run("no mode returns empty", func(t *testing.T) {
		svc := swarm.Service{}
		got := formatServiceReplicas(svc)
		if got != "" {
			t.Errorf("expected empty string, got %q", got)
		}
	})

	t.Run("replicated with nil replicas pointer", func(t *testing.T) {
		svc := swarm.Service{
			Spec: swarm.ServiceSpec{
				Mode: swarm.ServiceMode{
					Replicated: &swarm.ReplicatedService{Replicas: nil},
				},
			},
		}
		got := formatServiceReplicas(svc)
		// Replicated != nil but Replicas == nil → falls through to global check
		if got != "" {
			t.Errorf("expected empty string for nil Replicas, got %q", got)
		}
	})
}

// ---------------------------------------------------------------------------
// TestWriteStackServiceInfo – pure function
// ---------------------------------------------------------------------------

func TestWriteStackServiceInfo(t *testing.T) {
	t.Run("empty services list", func(t *testing.T) {
		var sb strings.Builder
		writeStackServiceInfo(&sb, nil)
		out := sb.String()
		if !strings.Contains(out, "0") {
			t.Errorf("expected 0 in output: %s", out)
		}
	})

	t.Run("service with container spec", func(t *testing.T) {
		var sb strings.Builder
		replicas := uint64(3)
		services := []swarm.Service{
			{
				Spec: swarm.ServiceSpec{
					Annotations: swarm.Annotations{Name: "myapp_web"},
					Mode: swarm.ServiceMode{
						Replicated: &swarm.ReplicatedService{Replicas: &replicas},
					},
					TaskTemplate: swarm.TaskSpec{
						ContainerSpec: &swarm.ContainerSpec{
							Image: "nginx:latest",
						},
					},
				},
			},
		}
		writeStackServiceInfo(&sb, services)
		out := sb.String()
		if !strings.Contains(out, "nginx:latest") {
			t.Errorf("expected image in output: %s", out)
		}
		if !strings.Contains(out, "myapp_web") {
			t.Errorf("expected service name in output: %s", out)
		}
	})

	t.Run("service without container spec", func(t *testing.T) {
		var sb strings.Builder
		services := []swarm.Service{
			{
				Spec: swarm.ServiceSpec{
					Annotations: swarm.Annotations{Name: "bare-svc"},
				},
			},
		}
		writeStackServiceInfo(&sb, services)
		out := sb.String()
		if !strings.Contains(out, "bare-svc") {
			t.Errorf("expected service name in output: %s", out)
		}
	})
}

// ---------------------------------------------------------------------------
// TestCountTaskStates – pure function
// ---------------------------------------------------------------------------

func TestCountTaskStates(t *testing.T) {
	t.Run("empty tasks", func(t *testing.T) {
		counts, failed := countTaskStates(nil)
		if len(counts) != 0 {
			t.Errorf("expected empty counts, got %v", counts)
		}
		if len(failed) != 0 {
			t.Errorf("expected no failed tasks, got %d", len(failed))
		}
	})

	t.Run("mixed states", func(t *testing.T) {
		tasks := []swarm.Task{
			{Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
			{Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
			{Status: swarm.TaskStatus{State: swarm.TaskStateFailed}},
			{Status: swarm.TaskStatus{State: swarm.TaskStateRejected}},
			{Status: swarm.TaskStatus{State: swarm.TaskStatePending}},
		}
		counts, failed := countTaskStates(tasks)
		if counts["running"] != 2 {
			t.Errorf("expected 2 running, got %d", counts["running"])
		}
		if counts["failed"] != 1 {
			t.Errorf("expected 1 failed, got %d", counts["failed"])
		}
		if len(failed) != 2 {
			t.Errorf("expected 2 failed/rejected tasks, got %d", len(failed))
		}
	})

	t.Run("all running no failures", func(t *testing.T) {
		tasks := []swarm.Task{
			{Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
			{Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
		}
		counts, failed := countTaskStates(tasks)
		if len(failed) != 0 {
			t.Errorf("expected no failed tasks, got %d", len(failed))
		}
		if counts["running"] != 2 {
			t.Errorf("expected 2 running, got %d", counts["running"])
		}
	})
}

// ---------------------------------------------------------------------------
// TestWriteTaskSummary – pure function
// ---------------------------------------------------------------------------

func TestWriteTaskSummary(t *testing.T) {
	t.Run("no tasks no failures", func(t *testing.T) {
		var sb strings.Builder
		writeTaskSummary(&sb, nil, map[string]int{}, nil)
		out := sb.String()
		if !strings.Contains(out, "0 total") {
			t.Errorf("expected '0 total' in output: %s", out)
		}
	})

	t.Run("with failed tasks", func(t *testing.T) {
		var sb strings.Builder
		tasks := []swarm.Task{
			{Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
			{Status: swarm.TaskStatus{State: swarm.TaskStateFailed}},
		}
		counts := map[string]int{"running": 1, "failed": 1}
		failedTasks := []swarm.Task{
			{
				ID:     "abc123def456xyz",
				Status: swarm.TaskStatus{State: swarm.TaskStateFailed, Err: "container crashed"},
			},
		}
		writeTaskSummary(&sb, tasks, counts, failedTasks)
		out := sb.String()
		if !strings.Contains(out, "container crashed") {
			t.Errorf("expected error message in output: %s", out)
		}
		if !strings.Contains(out, "2 total") {
			t.Errorf("expected '2 total' in output: %s", out)
		}
	})

	t.Run("failed task short id", func(t *testing.T) {
		var sb strings.Builder
		failedTasks := []swarm.Task{
			{
				ID:     "abc123def456xyz",
				Status: swarm.TaskStatus{State: swarm.TaskStateFailed, Err: "oom"},
			},
		}
		counts := map[string]int{"failed": 1}
		writeTaskSummary(&sb, failedTasks, counts, failedTasks)
		out := sb.String()
		// ID should be truncated to 12 chars
		if !strings.Contains(out, "abc123def456") {
			t.Errorf("expected truncated ID in output: %s", out)
		}
	})

	t.Run("failed task short id no error", func(t *testing.T) {
		var sb strings.Builder
		failedTasks := []swarm.Task{
			{
				ID:     "short",  // less than 12 chars
				Status: swarm.TaskStatus{State: swarm.TaskStateFailed},
			},
		}
		counts := map[string]int{"failed": 1}
		writeTaskSummary(&sb, failedTasks, counts, failedTasks)
		out := sb.String()
		if !strings.Contains(out, "short") {
			t.Errorf("expected short ID in output: %s", out)
		}
	})
}
