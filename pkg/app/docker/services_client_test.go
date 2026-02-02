package docker

import (
	"context"
	"testing"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/swarm"
)

func Test_getSwarmServices_countsRunningTasksAndDefaultsLabels(t *testing.T) {
	ctx := context.Background()

	svc1 := swarm.Service{
		ID: "svc-1",
		Meta: swarm.Meta{
			CreatedAt: time.Unix(10, 0),
			UpdatedAt: time.Unix(20, 0),
		},
		Spec: swarm.ServiceSpec{
			Annotations:  swarm.Annotations{Name: "svc1"},
			Mode:         swarm.ServiceMode{Replicated: &swarm.ReplicatedService{Replicas: uint64Ptr(3)}},
			TaskTemplate: swarm.TaskSpec{ContainerSpec: &swarm.ContainerSpec{Image: "nginx:1"}},
		},
	}

	svc2 := swarm.Service{
		ID: "svc-2",
		Meta: swarm.Meta{
			CreatedAt: time.Unix(11, 0),
			UpdatedAt: time.Unix(21, 0),
			Version:   swarm.Version{Index: 7},
		},
		Spec: swarm.ServiceSpec{
			Annotations:  swarm.Annotations{Name: "svc2", Labels: map[string]string{"com.docker.stack.namespace": "stack-a"}},
			Mode:         swarm.ServiceMode{Global: &swarm.GlobalService{}},
			TaskTemplate: swarm.TaskSpec{ContainerSpec: &swarm.ContainerSpec{Image: "busybox:1"}},
		},
	}

	cli := &fakeDockerClient{
		ServiceListFn: func(context.Context, types.ServiceListOptions) ([]swarm.Service, error) {
			return []swarm.Service{svc1, svc2}, nil
		},
		TaskListFn: func(context.Context, types.TaskListOptions) ([]swarm.Task, error) {
			return []swarm.Task{
				{ServiceID: "svc-1", Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
				{ServiceID: "svc-1", Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
				{ServiceID: "svc-1", Status: swarm.TaskStatus{State: swarm.TaskStateFailed}},
				{ServiceID: "svc-2", Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
			}, nil
		},
	}

	items, err := getSwarmServices(ctx, cli)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 services, got %d", len(items))
	}

	if items[0].ID != "svc-1" {
		t.Fatalf("expected first svc ID svc-1, got %q", items[0].ID)
	}
	if items[0].RunningTasks != 2 {
		t.Fatalf("expected svc-1 runningTasks=2, got %d", items[0].RunningTasks)
	}
	if items[0].Labels == nil {
		t.Fatalf("expected labels map to be non-nil")
	}

	if items[1].ID != "svc-2" {
		t.Fatalf("expected second svc ID svc-2, got %q", items[1].ID)
	}
	if items[1].Mode != "global" {
		t.Fatalf("expected svc-2 mode global, got %q", items[1].Mode)
	}
	if items[1].Replicas != 1 {
		t.Fatalf("expected svc-2 replicas=runningTasks=1, got %d", items[1].Replicas)
	}
}

func Test_scaleSwarmService_replicatedUpdatesReplicas(t *testing.T) {
	ctx := context.Background()

	svc := swarm.Service{
		ID:   "svc-1",
		Meta: swarm.Meta{Version: swarm.Version{Index: 7}},
		Spec: swarm.ServiceSpec{
			Annotations: swarm.Annotations{Name: "svc1"},
			Mode:        swarm.ServiceMode{Replicated: &swarm.ReplicatedService{Replicas: uint64Ptr(1)}},
		},
	}

	var updatedReplicas *uint64
	cli := &fakeDockerClient{
		ServiceInspectWithRawFn: func(context.Context, string, types.ServiceInspectOptions) (swarm.Service, []byte, error) {
			return svc, nil, nil
		},
		ServiceUpdateFn: func(_ context.Context, _ string, _ swarm.Version, spec swarm.ServiceSpec, _ types.ServiceUpdateOptions) (swarm.ServiceUpdateResponse, error) {
			updatedReplicas = spec.Mode.Replicated.Replicas
			return swarm.ServiceUpdateResponse{}, nil
		},
	}

	if err := scaleSwarmService(ctx, cli, "svc-1", 5); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updatedReplicas == nil || *updatedReplicas != 5 {
		t.Fatalf("expected replicas to be updated to 5, got %v", updatedReplicas)
	}
}

func Test_scaleSwarmService_globalReturnsError(t *testing.T) {
	ctx := context.Background()

	svc := swarm.Service{
		ID:   "svc-1",
		Meta: swarm.Meta{Version: swarm.Version{Index: 7}},
		Spec: swarm.ServiceSpec{
			Annotations: swarm.Annotations{Name: "svc1"},
			Mode:        swarm.ServiceMode{Global: &swarm.GlobalService{}},
		},
	}

	cli := &fakeDockerClient{
		ServiceInspectWithRawFn: func(context.Context, string, types.ServiceInspectOptions) (swarm.Service, []byte, error) {
			return svc, nil, nil
		},
	}

	if err := scaleSwarmService(ctx, cli, "svc-1", 2); err == nil {
		t.Fatalf("expected error for global service")
	}
}

func Test_updateSwarmServiceImage_updatesImageAndForceUpdate(t *testing.T) {
	ctx := context.Background()

	svc := swarm.Service{
		ID:   "svc-1",
		Meta: swarm.Meta{Version: swarm.Version{Index: 9}},
		Spec: swarm.ServiceSpec{
			TaskTemplate: swarm.TaskSpec{ContainerSpec: &swarm.ContainerSpec{Image: "old:1"}, ForceUpdate: 41},
		},
	}

	var updatedImage string
	var updatedForce uint64
	cli := &fakeDockerClient{
		ServiceInspectWithRawFn: func(context.Context, string, types.ServiceInspectOptions) (swarm.Service, []byte, error) {
			return svc, nil, nil
		},
		ServiceUpdateFn: func(_ context.Context, _ string, _ swarm.Version, spec swarm.ServiceSpec, _ types.ServiceUpdateOptions) (swarm.ServiceUpdateResponse, error) {
			updatedImage = spec.TaskTemplate.ContainerSpec.Image
			updatedForce = spec.TaskTemplate.ForceUpdate
			return swarm.ServiceUpdateResponse{}, nil
		},
	}

	if err := updateSwarmServiceImage(ctx, cli, "svc-1", "new:2"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updatedImage != "new:2" {
		t.Fatalf("expected image new:2, got %q", updatedImage)
	}
	if updatedForce != 42 {
		t.Fatalf("expected ForceUpdate incremented to 42, got %d", updatedForce)
	}
}

func Test_restartSwarmService_incrementsForceUpdate(t *testing.T) {
	ctx := context.Background()

	svc := swarm.Service{
		ID:   "svc-1",
		Meta: swarm.Meta{Version: swarm.Version{Index: 9}},
		Spec: swarm.ServiceSpec{
			TaskTemplate: swarm.TaskSpec{ContainerSpec: &swarm.ContainerSpec{Image: "old:1"}, ForceUpdate: 1},
		},
	}

	var updatedForce uint64
	cli := &fakeDockerClient{
		ServiceInspectWithRawFn: func(context.Context, string, types.ServiceInspectOptions) (swarm.Service, []byte, error) {
			return svc, nil, nil
		},
		ServiceUpdateFn: func(_ context.Context, _ string, _ swarm.Version, spec swarm.ServiceSpec, _ types.ServiceUpdateOptions) (swarm.ServiceUpdateResponse, error) {
			updatedForce = spec.TaskTemplate.ForceUpdate
			return swarm.ServiceUpdateResponse{}, nil
		},
	}

	if err := restartSwarmService(ctx, cli, "svc-1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updatedForce != 2 {
		t.Fatalf("expected ForceUpdate incremented to 2, got %d", updatedForce)
	}
}

func Test_getSwarmService_countsOnlyRunningTasks(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		ServiceInspectWithRawFn: func(context.Context, string, types.ServiceInspectOptions) (swarm.Service, []byte, error) {
			return swarm.Service{
				ID: "svc-1",
				Meta: swarm.Meta{
					CreatedAt: time.Unix(1, 0),
					UpdatedAt: time.Unix(2, 0),
				},
				Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "svc"}, Mode: swarm.ServiceMode{Replicated: &swarm.ReplicatedService{Replicas: uint64Ptr(1)}}},
			}, nil, nil
		},
		TaskListFn: func(_ context.Context, opts types.TaskListOptions) ([]swarm.Task, error) {
			// Should include desired-state=running.
			vals := opts.Filters.Get("desired-state")
			if len(vals) != 1 || vals[0] != "running" {
				t.Fatalf("expected desired-state=running, got %v", vals)
			}
			return []swarm.Task{
				{Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
				{Status: swarm.TaskStatus{State: swarm.TaskStateFailed}},
			}, nil
		},
	}

	item, err := getSwarmService(ctx, cli, "svc-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if item == nil || item.RunningTasks != 1 {
		t.Fatalf("expected runningTasks=1, got %+v", item)
	}
}

func Test_removeSwarmService_callsRemove(t *testing.T) {
	ctx := context.Background()

	called := false
	cli := &fakeDockerClient{ServiceRemoveFn: func(context.Context, string) error { called = true; return nil }}

	if err := removeSwarmService(ctx, cli, "svc-1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Fatalf("expected remove to be called")
	}
}

func uint64Ptr(v uint64) *uint64 { return &v }

func Test_rollbackSwarmService_setsRollback(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		ServiceInspectWithRawFn: func(context.Context, string, types.ServiceInspectOptions) (swarm.Service, []byte, error) {
			return swarm.Service{ID: "s1", Meta: swarm.Meta{Version: swarm.Version{Index: 1}}, Spec: swarm.ServiceSpec{}}, nil, nil
		},
		ServiceUpdateFn: func(_ context.Context, _ string, _ swarm.Version, _ swarm.ServiceSpec, opts types.ServiceUpdateOptions) (swarm.ServiceUpdateResponse, error) {
			if opts.Rollback != "previous" {
				t.Fatalf("expected rollback='previous', got %q", opts.Rollback)
			}
			return swarm.ServiceUpdateResponse{}, nil
		},
	}

	if err := rollbackSwarmService(ctx, cli, "s1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func Test_createSwarmService_withPorts(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		ServiceCreateFn: func(_ context.Context, spec swarm.ServiceSpec, _ types.ServiceCreateOptions) (swarm.ServiceCreateResponse, error) {
			if len(spec.EndpointSpec.Ports) != 1 {
				t.Fatalf("expected 1 port, got %d", len(spec.EndpointSpec.Ports))
			}
			if spec.EndpointSpec.Ports[0].TargetPort != 80 {
				t.Fatalf("expected target port 80, got %d", spec.EndpointSpec.Ports[0].TargetPort)
			}
			return swarm.ServiceCreateResponse{ID: "svc-id"}, nil
		},
	}

	opts := CreateServiceOptions{
		Name:  "test",
		Image: "nginx",
		Ports: []SwarmPortInfo{{TargetPort: 80, PublishedPort: 8080, Protocol: "tcp"}},
	}
	id, err := createSwarmService(ctx, cli, opts)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if id != "svc-id" {
		t.Fatalf("expected svc-id, got %q", id)
	}
}

func Test_createSwarmService_globalMode(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		ServiceCreateFn: func(_ context.Context, spec swarm.ServiceSpec, _ types.ServiceCreateOptions) (swarm.ServiceCreateResponse, error) {
			if spec.Mode.Global == nil {
				t.Fatalf("expected global mode")
			}
			return swarm.ServiceCreateResponse{ID: "svc-id"}, nil
		},
	}

	opts := CreateServiceOptions{Name: "test", Image: "nginx", Mode: "global"}
	_, err := createSwarmService(ctx, cli, opts)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func Test_createSwarmService_errorOnMissingName(t *testing.T) {
	ctx := context.Background()
	cli := &fakeDockerClient{}

	opts := CreateServiceOptions{Image: "nginx"}
	_, err := createSwarmService(ctx, cli, opts)
	if err != ErrInvalidServiceName {
		t.Fatalf("expected ErrInvalidServiceName, got %v", err)
	}
}

func Test_createSwarmService_errorOnMissingImage(t *testing.T) {
	ctx := context.Background()
	cli := &fakeDockerClient{}

	opts := CreateServiceOptions{Name: "test"}
	_, err := createSwarmService(ctx, cli, opts)
	if err != ErrInvalidServiceImage {
		t.Fatalf("expected ErrInvalidServiceImage, got %v", err)
	}
}

func Test_mountsToInfo_convertsMounts(t *testing.T) {
	mounts := []mount.Mount{
		{Type: mount.TypeBind, Source: "/src", Target: "/dst", ReadOnly: true},
		{Type: mount.TypeVolume, Source: "vol", Target: "/data"},
	}

	result := mountsToInfo(mounts)
	if len(result) != 2 {
		t.Fatalf("expected 2 mounts, got %d", len(result))
	}
	if result[0].Type != "bind" || result[0].ReadOnly != true {
		t.Fatalf("unexpected first mount: %+v", result[0])
	}
	if result[1].Type != "volume" || result[1].Source != "vol" {
		t.Fatalf("unexpected second mount: %+v", result[1])
	}
}

func Test_mountsToInfo_returnsNilForEmpty(t *testing.T) {
	result := mountsToInfo([]mount.Mount{})
	if result != nil {
		t.Fatalf("expected nil for empty mounts, got %+v", result)
	}
}
