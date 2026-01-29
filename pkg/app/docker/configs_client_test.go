package docker

import (
	"context"
	"testing"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
)

func Test_getSwarmConfigs_listsAndConverts(t *testing.T) {
	ctx := context.Background()

	cfg := swarm.Config{
		ID:   "cfg-1",
		Meta: swarm.Meta{CreatedAt: time.Unix(1, 0), UpdatedAt: time.Unix(2, 0)},
		Spec: swarm.ConfigSpec{Annotations: swarm.Annotations{Name: "c1"}, Data: []byte("abc")},
	}

	cli := &fakeDockerClient{
		ConfigListFn: func(context.Context, types.ConfigListOptions) ([]swarm.Config, error) {
			return []swarm.Config{cfg}, nil
		},
	}

	items, err := getSwarmConfigs(ctx, cli)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 1 || items[0].Name != "c1" || items[0].DataSize != 3 {
		t.Fatalf("unexpected items: %+v", items)
	}
	if items[0].Labels == nil {
		t.Fatalf("expected labels to be non-nil")
	}
}

func Test_getSwarmConfig_returnsItem(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		ConfigInspectWithRawFn: func(context.Context, string) (swarm.Config, []byte, error) {
			return swarm.Config{ID: "cfg-1", Meta: swarm.Meta{CreatedAt: time.Unix(1, 0), UpdatedAt: time.Unix(2, 0)}, Spec: swarm.ConfigSpec{Annotations: swarm.Annotations{Name: "c1"}}}, nil, nil
		},
	}

	item, err := getSwarmConfig(ctx, cli, "cfg-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if item == nil || item.ID != "cfg-1" {
		t.Fatalf("unexpected item: %+v", item)
	}
}

func Test_getSwarmConfigData_returnsBytes(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		ConfigInspectWithRawFn: func(context.Context, string) (swarm.Config, []byte, error) {
			return swarm.Config{Spec: swarm.ConfigSpec{Data: []byte("xyz")}}, nil, nil
		},
	}

	data, err := getSwarmConfigData(ctx, cli, "cfg-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(data) != "xyz" {
		t.Fatalf("expected xyz, got %q", string(data))
	}
}

func Test_createSwarmConfig_callsConfigCreate(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		ConfigCreateFn: func(_ context.Context, spec swarm.ConfigSpec) (types.ConfigCreateResponse, error) {
			if spec.Annotations.Name != "c1" {
				t.Fatalf("unexpected name: %q", spec.Annotations.Name)
			}
			return types.ConfigCreateResponse{ID: "new-id"}, nil
		},
	}

	id, err := createSwarmConfig(ctx, cli, "c1", []byte("d"), map[string]string{"k": "v"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if id != "new-id" {
		t.Fatalf("expected new-id, got %q", id)
	}
}

func Test_updateSwarmConfig_updatesData(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		ConfigInspectWithRawFn: func(context.Context, string) (swarm.Config, []byte, error) {
			return swarm.Config{ID: "cfg-1", Meta: swarm.Meta{Version: swarm.Version{Index: 2}}, Spec: swarm.ConfigSpec{Annotations: swarm.Annotations{Name: "c1"}, Data: []byte("old")}}, nil, nil
		},
		ConfigUpdateFn: func(_ context.Context, _ string, _ swarm.Version, spec swarm.ConfigSpec) error {
			if string(spec.Data) != "new" {
				t.Fatalf("expected new data")
			}
			return nil
		},
	}

	if err := updateSwarmConfig(ctx, cli, "cfg-1", []byte("new")); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func Test_removeSwarmConfig_callsRemove(t *testing.T) {
	ctx := context.Background()

	called := false
	cli := &fakeDockerClient{ConfigRemoveFn: func(context.Context, string) error { called = true; return nil }}

	if err := removeSwarmConfig(ctx, cli, "cfg-1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Fatalf("expected remove to be called")
	}
}

// Note: The public wrapper functions (GetSwarmConfigs, GetSwarmConfig, CreateSwarmConfig, etc.) 
// that accept *client.Client cannot be easily unit tested since they require a real Docker client.
// These wrappers are thin delegates to the internal functions (getSwarmConfigs, getSwarmConfig, etc.)
// which are already comprehensively tested above. The wrappers exist to provide a clean public API
// that can be called from the Wails-exposed functions in pkg/app/docker_integration.go.

func Test_getSwarmConfigUsage_findsReferencingServices(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		ConfigInspectWithRawFn: func(context.Context, string) (swarm.Config, []byte, error) {
			return swarm.Config{ID: "cfg-1", Spec: swarm.ConfigSpec{Annotations: swarm.Annotations{Name: "config1"}}}, nil, nil
		},
		ServiceListFn: func(context.Context, types.ServiceListOptions) ([]swarm.Service, error) {
			return []swarm.Service{
				{ID: "svc-1", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "service1"}, TaskTemplate: swarm.TaskSpec{ContainerSpec: &swarm.ContainerSpec{Configs: []*swarm.ConfigReference{{ConfigID: "cfg-1"}}}}}},
				{ID: "svc-2", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "service2"}}},
			}, nil
		},
	}

	refs, err := getSwarmConfigUsage(ctx, cli, "cfg-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(refs) != 1 || refs[0].ServiceID != "svc-1" {
		t.Fatalf("expected 1 ref to svc-1, got %+v", refs)
	}
}

func Test_updateSwarmConfigDataImmutable_createsNewConfigAndMigrates(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		ConfigInspectWithRawFn: func(context.Context, string) (swarm.Config, []byte, error) {
			return swarm.Config{ID: "cfg-old", Meta: swarm.Meta{Version: swarm.Version{Index: 1}}, Spec: swarm.ConfigSpec{Annotations: swarm.Annotations{Name: "myconfig"}, Data: []byte("old")}}, nil, nil
		},
		ConfigCreateFn: func(_ context.Context, spec swarm.ConfigSpec) (types.ConfigCreateResponse, error) {
			if string(spec.Data) != "new" {
				t.Fatalf("expected new data, got %q", string(spec.Data))
			}
			return types.ConfigCreateResponse{ID: "cfg-new"}, nil
		},
		ServiceListFn: func(context.Context, types.ServiceListOptions) ([]swarm.Service, error) {
			return []swarm.Service{
				{ID: "svc-1", Meta: swarm.Meta{Version: swarm.Version{Index: 5}}, Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "service1"}, TaskTemplate: swarm.TaskSpec{ContainerSpec: &swarm.ContainerSpec{Configs: []*swarm.ConfigReference{{ConfigID: "cfg-old", ConfigName: "myconfig"}}}}}},
			}, nil
		},
		ServiceInspectWithRawFn: func(context.Context, string, types.ServiceInspectOptions) (swarm.Service, []byte, error) {
			return swarm.Service{ID: "svc-1", Meta: swarm.Meta{Version: swarm.Version{Index: 5}}, Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "service1"}, TaskTemplate: swarm.TaskSpec{ContainerSpec: &swarm.ContainerSpec{Configs: []*swarm.ConfigReference{{ConfigID: "cfg-old", ConfigName: "myconfig"}}}}}}, nil, nil
		},
		ServiceUpdateFn: func(_ context.Context, _ string, _ swarm.Version, spec swarm.ServiceSpec, _ types.ServiceUpdateOptions) (types.ServiceUpdateResponse, error) {
			if spec.TaskTemplate.ContainerSpec.Configs[0].ConfigID != "cfg-new" {
				t.Fatalf("expected new config ID")
			}
			return types.ServiceUpdateResponse{}, nil
		},
		ConfigRemoveFn: func(context.Context, string) error {
			return nil
		},
	}

	result, err := updateSwarmConfigDataImmutable(ctx, cli, "cfg-old", []byte("new"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == nil || result.NewConfigID != "cfg-new" || len(result.Updated) != 1 {
		t.Fatalf("unexpected result: %+v", result)
	}
}
