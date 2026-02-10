package docker

import (
	"context"
	"testing"
	"time"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/api/types/volume"
)

func Test_getSwarmVolumes_listsAndConverts(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		VolumeListFn: func(context.Context, volume.ListOptions) (volume.ListResponse, error) {
			v1 := &volume.Volume{Name: "v1", Driver: "local", Labels: nil}
			v2 := &volume.Volume{Name: "v2", Driver: "local", Labels: map[string]string{"a": "b"}}
			return volume.ListResponse{Volumes: []*volume.Volume{v1, v2}}, nil
		},
	}

	items, err := getSwarmVolumes(ctx, cli)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 volumes, got %d", len(items))
	}
	if items[0].Labels == nil {
		t.Fatalf("expected labels to be non-nil")
	}
}

func Test_getSwarmVolume_inspectsAndDefaultsLabels(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		VolumeInspectFn: func(context.Context, string) (volume.Volume, error) {
			return volume.Volume{Name: "v1", Driver: "local", Labels: nil, CreatedAt: time.Now().Format(time.RFC3339)}, nil
		},
	}

	item, err := getSwarmVolume(ctx, cli, "v1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if item == nil || item.Name != "v1" {
		t.Fatalf("unexpected volume: %+v", item)
	}
	if item.Labels == nil {
		t.Fatalf("expected labels to be non-nil")
	}
}

func Test_createSwarmVolume_buildsOptionsAndReturnsInfo(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		VolumeCreateFn: func(_ context.Context, opts volume.CreateOptions) (volume.Volume, error) {
			if opts.Name != "v1" || opts.Driver != "local" {
				t.Fatalf("unexpected create opts: %+v", opts)
			}
			return volume.Volume{Name: opts.Name, Driver: opts.Driver, Labels: opts.Labels, CreatedAt: time.Now().Format(time.RFC3339)}, nil
		},
	}

	item, err := createSwarmVolume(ctx, cli, "v1", "local", map[string]string{"k": "v"}, map[string]string{"o": "p"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if item == nil || item.Name != "v1" {
		t.Fatalf("unexpected volume: %+v", item)
	}
}

func Test_pruneSwarmVolumes_returnsReport(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		VolumesPruneFn: func(context.Context, filters.Args) (volume.PruneReport, error) {
			return volume.PruneReport{VolumesDeleted: []string{"v1"}, SpaceReclaimed: 123}, nil
		},
	}

	deleted, space, err := pruneSwarmVolumes(ctx, cli)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(deleted) != 1 || deleted[0] != "v1" || space != 123 {
		t.Fatalf("unexpected prune result: deleted=%v space=%d", deleted, space)
	}
}

func Test_removeSwarmVolume_callsRemove(t *testing.T) {
	ctx := context.Background()

	called := false
	cli := &fakeDockerClient{
		VolumeRemoveFn: func(context.Context, string, bool) error {
			called = true
			return nil
		},
	}

	if err := removeSwarmVolume(ctx, cli, "v1", true); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Fatalf("expected remove to be called")
	}
}

func Test_formatVolumeAge_handlesInvalidDate(t *testing.T) {
	if got := formatVolumeAge("not-a-date"); got != "-" {
		t.Fatalf("expected '-', got %q", got)
	}
}

func Test_formatVolumeAge_formatsRFC3339(t *testing.T) {
	created := time.Now().Add(-10 * time.Second).UTC().Format(time.RFC3339)
	if got := formatVolumeAge(created); got == "-" {
		t.Fatalf("expected non-dash")
	}
}

// Note: The public wrapper functions (GetSwarmVolumes, GetSwarmVolume, CreateSwarmVolume, etc.)
// that accept *client.Client cannot be easily unit tested since they require a real Docker client.
// These wrappers are thin delegates to the internal functions (getSwarmVolumes, getSwarmVolume, etc.)
// which are already comprehensively tested above.

func Test_getSwarmVolumeUsage_findsServicesUsingVolume(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		ServiceListFn: func(context.Context, swarm.ServiceListOptions) ([]swarm.Service, error) {
			return []swarm.Service{
				{
					ID: "svc-1",
					Spec: swarm.ServiceSpec{
						Annotations: swarm.Annotations{Name: "service1"},
						TaskTemplate: swarm.TaskSpec{
							ContainerSpec: &swarm.ContainerSpec{
								Mounts: []mount.Mount{
									{Type: mount.TypeVolume, Source: "myvol"},
								},
							},
						},
					},
				},
				{ID: "svc-2", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "service2"}}},
			}, nil
		},
	}

	refs, err := getSwarmVolumeUsage(ctx, cli, "myvol")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(refs) != 1 || refs[0].ServiceID != "svc-1" {
		t.Fatalf("expected 1 ref to svc-1, got %+v", refs)
	}
}
