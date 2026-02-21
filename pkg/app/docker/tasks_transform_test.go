package docker

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/swarm"
)

// TestTaskToInfo covers all 6+ swarm.Task state values via a table-driven test.
func TestTaskToInfo_AllSwarmStates(t *testing.T) {
	t.Parallel()

	tests := []struct {
		state        swarm.TaskState
		wantState    string
		desiredState swarm.TaskState
	}{
		{swarm.TaskStateNew, "new", swarm.TaskStateRunning},
		{swarm.TaskStatePending, "pending", swarm.TaskStateRunning},
		{swarm.TaskStateAssigned, "assigned", swarm.TaskStateRunning},
		{swarm.TaskStatePreparing, "preparing", swarm.TaskStateRunning},
		{swarm.TaskStateStarting, "starting", swarm.TaskStateRunning},
		{swarm.TaskStateRunning, "running", swarm.TaskStateRunning},
		{swarm.TaskStateComplete, "complete", swarm.TaskStateShutdown},
		{swarm.TaskStateShutdown, "shutdown", swarm.TaskStateShutdown},
		{swarm.TaskStateFailed, "failed", swarm.TaskStateShutdown},
		{swarm.TaskStateRejected, "rejected", swarm.TaskStateShutdown},
		{swarm.TaskStateRemove, "remove", swarm.TaskStateShutdown},
		{swarm.TaskStateOrphaned, "orphaned", swarm.TaskStateShutdown},
	}

	serviceNames := map[string]string{"svc1": "my-service"}
	nodeNames := map[string]string{"node1": "worker-1"}

	for _, tc := range tests {
		tc := tc
		t.Run(fmt.Sprintf("state_%s", tc.state), func(t *testing.T) {
			t.Parallel()
			now := time.Date(2026, 2, 19, 12, 0, 0, 0, time.UTC)
			task := swarm.Task{
				ID:           "task-abc",
				ServiceID:    "svc1",
				NodeID:       "node1",
				Slot:         2,
				DesiredState: tc.desiredState,
				Meta: swarm.Meta{
					CreatedAt: now,
					UpdatedAt: now.Add(time.Minute),
				},
				Status: swarm.TaskStatus{
					State: tc.state,
				},
				Spec: swarm.TaskSpec{
					ContainerSpec: &swarm.ContainerSpec{
						Image: "nginx:latest",
					},
				},
			}

			info := taskToInfo(task, serviceNames, nodeNames)

			if info.State != tc.wantState {
				t.Errorf("State: got %q, want %q", info.State, tc.wantState)
			}
			if info.DesiredState != string(tc.desiredState) {
				t.Errorf("DesiredState: got %q, want %q", info.DesiredState, string(tc.desiredState))
			}
			if info.ServiceName != "my-service" {
				t.Errorf("ServiceName: got %q, want %q", info.ServiceName, "my-service")
			}
			if info.NodeName != "worker-1" {
				t.Errorf("NodeName: got %q, want %q", info.NodeName, "worker-1")
			}
			if info.Slot != 2 {
				t.Errorf("Slot: got %d, want 2", info.Slot)
			}
			if info.Image != "nginx:latest" {
				t.Errorf("Image: got %q, want nginx:latest", info.Image)
			}
			if info.HealthStatus != "none" {
				t.Errorf("HealthStatus: got %q, want none (default)", info.HealthStatus)
			}
			wantCreated := now.Format(time.RFC3339)
			if info.CreatedAt != wantCreated {
				t.Errorf("CreatedAt: got %q, want %q", info.CreatedAt, wantCreated)
			}
		})
	}
}

// TestTaskToInfo_NetworkAttachments verifies that network attachments are extracted.
func TestTaskToInfo_NetworkAttachments(t *testing.T) {
	t.Parallel()

	task := swarm.Task{
		ID:           "task-net",
		DesiredState: swarm.TaskStateRunning,
		Meta: swarm.Meta{
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		Status: swarm.TaskStatus{State: swarm.TaskStateRunning},
		NetworksAttachments: []swarm.NetworkAttachment{
			{
				Network:   swarm.Network{ID: "net1"},
				Addresses: []string{"10.0.0.1/24", "10.0.0.2/24"},
			},
			{
				// Empty network ID should be filtered out
				Network:   swarm.Network{ID: ""},
				Addresses: []string{"192.168.1.1/16"},
			},
		},
	}

	info := taskToInfo(task, nil, nil)

	if len(info.Networks) != 1 {
		t.Fatalf("expected 1 network (empty ID filtered), got %d", len(info.Networks))
	}
	if info.Networks[0].NetworkID != "net1" {
		t.Errorf("expected NetworkID net1, got %q", info.Networks[0].NetworkID)
	}
	if len(info.Networks[0].Addresses) != 2 {
		t.Errorf("expected 2 addresses, got %d", len(info.Networks[0].Addresses))
	}
}

// TestTaskToInfo_Mounts verifies that mounts from ContainerSpec are included.
func TestTaskToInfo_Mounts(t *testing.T) {
	t.Parallel()

	task := swarm.Task{
		ID:           "task-mnt",
		DesiredState: swarm.TaskStateRunning,
		Meta: swarm.Meta{
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		Status: swarm.TaskStatus{State: swarm.TaskStateRunning},
		Spec: swarm.TaskSpec{
			ContainerSpec: &swarm.ContainerSpec{
				Mounts: []mount.Mount{
					{Type: mount.TypeBind, Source: "/host/path", Target: "/container/path", ReadOnly: true},
					{Type: mount.TypeVolume, Source: "my-vol", Target: "/data", ReadOnly: false},
				},
			},
		},
	}

	info := taskToInfo(task, nil, nil)

	if len(info.Mounts) != 2 {
		t.Fatalf("expected 2 mounts, got %d", len(info.Mounts))
	}
	if info.Mounts[0].Type != "bind" {
		t.Errorf("mount[0].Type: got %q, want bind", info.Mounts[0].Type)
	}
	if !info.Mounts[0].ReadOnly {
		t.Error("mount[0].ReadOnly: expected true")
	}
	if info.Mounts[1].Type != "volume" {
		t.Errorf("mount[1].Type: got %q, want volume", info.Mounts[1].Type)
	}
}

// TestTaskToInfo_NilMaps verifies taskToInfo is safe with nil service/node maps.
func TestTaskToInfo_NilMaps(t *testing.T) {
	t.Parallel()

	task := swarm.Task{
		ID:        "task-nil",
		ServiceID: "orphaned-svc",
		NodeID:    "orphaned-node",
		Meta: swarm.Meta{
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		Status: swarm.TaskStatus{State: swarm.TaskStateRunning},
	}

	// Should not panic with nil maps
	info := taskToInfo(task, nil, nil)

	if info.ServiceName != "" {
		t.Errorf("expected empty ServiceName for nil map, got %q", info.ServiceName)
	}
	if info.NodeName != "" {
		t.Errorf("expected empty NodeName for nil map, got %q", info.NodeName)
	}
}

// TestTaskToInfo_HealthCheck verifies that HealthConfig is converted properly.
func TestTaskToInfo_HealthCheck(t *testing.T) {
	t.Parallel()

	task := swarm.Task{
		ID:           "task-hc",
		DesiredState: swarm.TaskStateRunning,
		Meta: swarm.Meta{
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		Status: swarm.TaskStatus{State: swarm.TaskStateRunning},
		Spec: swarm.TaskSpec{
			ContainerSpec: &swarm.ContainerSpec{
				Healthcheck: &container.HealthConfig{
					Test:        []string{"CMD", "curl", "-f", "http://localhost/health"},
					Interval:    30 * time.Second,
					Timeout:     5 * time.Second,
					Retries:     3,
					StartPeriod: 10 * time.Second,
				},
			},
		},
	}

	info := taskToInfo(task, nil, nil)

	if info.HealthCheck == nil {
		t.Fatal("expected HealthCheck to be populated")
	}
	if len(info.HealthCheck.Test) != 4 {
		t.Errorf("expected 4 test args, got %d: %v", len(info.HealthCheck.Test), info.HealthCheck.Test)
	}
	if info.HealthCheck.Test[0] != "CMD" {
		t.Errorf("expected Test[0]=CMD, got %q", info.HealthCheck.Test[0])
	}
	if info.HealthCheck.Interval != "30s" {
		t.Errorf("Interval: got %q, want 30s", info.HealthCheck.Interval)
	}
	if info.HealthCheck.Retries != 3 {
		t.Errorf("Retries: got %d, want 3", info.HealthCheck.Retries)
	}
}

// TestTaskStatusString verifies that task state values are correctly stringified
// in the SwarmTaskInfo.State field.
func TestTaskStatusString(t *testing.T) {
	t.Parallel()

	tests := []struct {
		state    swarm.TaskState
		wantStr  string
	}{
		{swarm.TaskStateNew, "new"},
		{swarm.TaskStateAllocated, "allocated"},
		{swarm.TaskStatePending, "pending"},
		{swarm.TaskStateAssigned, "assigned"},
		{swarm.TaskStateAccepted, "accepted"},
		{swarm.TaskStatePreparing, "preparing"},
		{swarm.TaskStateReady, "ready"},
		{swarm.TaskStateStarting, "starting"},
		{swarm.TaskStateRunning, "running"},
		{swarm.TaskStateComplete, "complete"},
		{swarm.TaskStateShutdown, "shutdown"},
		{swarm.TaskStateFailed, "failed"},
		{swarm.TaskStateRejected, "rejected"},
		{swarm.TaskStateRemove, "remove"},
		{swarm.TaskStateOrphaned, "orphaned"},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(string(tc.state), func(t *testing.T) {
			t.Parallel()
			task := swarm.Task{
				Status:       swarm.TaskStatus{State: tc.state},
				DesiredState: swarm.TaskStateRunning,
				Meta: swarm.Meta{
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				},
			}
			info := taskToInfo(task, nil, nil)
			if info.State != tc.wantStr {
				t.Errorf("taskToInfo State for state %q: got %q, want %q",
					tc.state, info.State, tc.wantStr)
			}
		})
	}
}

// TestSetCachedHealthStatus verifies that setCachedHealthStatus stores
// values retrievable via getCachedHealthStatus within the TTL.
func TestSetCachedHealthStatus(t *testing.T) {
	t.Parallel()

	containerID := fmt.Sprintf("test-container-%d", time.Now().UnixNano())

	// Before setting, should have no cached entry
	_, ok := getCachedHealthStatus(containerID)
	if ok {
		t.Fatal("expected no cache hit before setting")
	}

	// Set a healthy status
	setCachedHealthStatus(containerID, "healthy")

	// Should now be retrievable
	status, ok := getCachedHealthStatus(containerID)
	if !ok {
		t.Fatal("expected cache hit after setting")
	}
	if status != "healthy" {
		t.Errorf("expected status 'healthy', got %q", status)
	}

	// Update with a different status
	containerID2 := fmt.Sprintf("test-container2-%d", time.Now().UnixNano())
	setCachedHealthStatus(containerID2, "unhealthy")
	status2, ok2 := getCachedHealthStatus(containerID2)
	if !ok2 {
		t.Fatal("expected cache hit for second container")
	}
	if status2 != "unhealthy" {
		t.Errorf("expected status 'unhealthy', got %q", status2)
	}
}

// TestSetCachedHealthStatus_EmptyStatus verifies that an empty status
// stored and then retrieved returns "none" (the default).
func TestSetCachedHealthStatus_EmptyReturnsNone(t *testing.T) {
	t.Parallel()

	containerID := fmt.Sprintf("test-container-empty-%d", time.Now().UnixNano())

	// Set empty status (simulates "no health info available")
	setCachedHealthStatus(containerID, "")

	// getCachedHealthStatus should return "none" for an empty cached status
	status, ok := getCachedHealthStatus(containerID)
	if !ok {
		t.Fatal("expected cache hit even for empty status")
	}
	if status != "none" {
		t.Errorf("expected 'none' for empty cached status, got %q", status)
	}
}

// TestSetCachedHealthStatus_OverwritesPreviousEntry verifies overwrite behavior.
func TestSetCachedHealthStatus_Overwrite(t *testing.T) {
	t.Parallel()

	containerID := fmt.Sprintf("test-container-overwrite-%d", time.Now().UnixNano())

	setCachedHealthStatus(containerID, "starting")
	setCachedHealthStatus(containerID, "healthy")

	status, ok := getCachedHealthStatus(containerID)
	if !ok {
		t.Fatal("expected cache hit")
	}
	if status != "healthy" {
		t.Errorf("expected overwritten status 'healthy', got %q", status)
	}
}

// TestGetSwarmTaskHealthLogs_NilClient verifies that getSwarmTaskHealthLogs
// returns an empty slice and no error when given a nil client.
func TestGetSwarmTaskHealthLogs_NilClient(t *testing.T) {
t.Parallel()

out, err := getSwarmTaskHealthLogs(nil, nil, "task-123")
if err != nil {
t.Errorf("expected nil error for nil client, got %v", err)
}
if out == nil {
t.Error("expected non-nil empty slice, got nil")
}
if len(out) != 0 {
t.Errorf("expected empty slice, got %d entries", len(out))
}
}

// TestGetSwarmTaskHealthLogs_TypedNilClient verifies that getSwarmTaskHealthLogs
// returns an empty slice and no error when given a typed nil pointer client.
func TestGetSwarmTaskHealthLogs_TypedNilClient(t *testing.T) {
t.Parallel()

var cli *fakeDockerClient // typed nil
out, err := getSwarmTaskHealthLogs(nil, cli, "task-123")
if err != nil {
t.Errorf("expected nil error for typed nil client, got %v", err)
}
if len(out) != 0 {
t.Errorf("expected empty slice, got %d entries", len(out))
}
}

// TestGetSwarmTaskHealthLogs_TaskInspectError verifies that inspect errors
// are propagated correctly.
func TestGetSwarmTaskHealthLogs_TaskInspectError(t *testing.T) {
t.Parallel()

cli := &fakeDockerClient{
TaskInspectWithRawFn: func(_ context.Context, taskID string) (swarm.Task, []byte, error) {
return swarm.Task{}, nil, fmt.Errorf("task not found")
},
}

_, err := getSwarmTaskHealthLogs(nil, cli, "missing-task")
if err == nil {
t.Error("expected non-nil error when task inspect fails")
}
}

// TestGetSwarmTaskHealthLogs_NoContainerID verifies empty logs are returned
// when the task has no container status.
func TestGetSwarmTaskHealthLogs_NoContainerID(t *testing.T) {
t.Parallel()

cli := &fakeDockerClient{
TaskInspectWithRawFn: func(_ context.Context, taskID string) (swarm.Task, []byte, error) {
return swarm.Task{
Status: swarm.TaskStatus{
ContainerStatus: nil, // no container
},
}, nil, nil
},
}

out, err := getSwarmTaskHealthLogs(nil, cli, "task-no-container")
if err != nil {
t.Errorf("expected nil error, got %v", err)
}
if len(out) != 0 {
t.Errorf("expected empty slice for task with no container, got %d", len(out))
}
}

// TestGetSwarmTaskHealthLogs_ContainerInspectError verifies that container
// inspect errors are handled gracefully (best-effort: returns empty slice).
func TestGetSwarmTaskHealthLogs_ContainerInspectError(t *testing.T) {
t.Parallel()

cli := &fakeDockerClient{
TaskInspectWithRawFn: func(_ context.Context, taskID string) (swarm.Task, []byte, error) {
return swarm.Task{
Status: swarm.TaskStatus{
ContainerStatus: &swarm.ContainerStatus{ContainerID: "cid-123"},
},
}, nil, nil
},
ContainerInspectFn: func(_ context.Context, containerID string) (container.InspectResponse, error) {
return container.InspectResponse{}, fmt.Errorf("container inspect failed")
},
}

out, err := getSwarmTaskHealthLogs(nil, cli, "task-with-container")
if err != nil {
t.Errorf("expected nil error for container inspect failure (best-effort), got %v", err)
}
if len(out) != 0 {
t.Errorf("expected empty slice when container inspect fails, got %d", len(out))
}
}
