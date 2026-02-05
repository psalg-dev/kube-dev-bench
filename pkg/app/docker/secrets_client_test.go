package docker

import (
	"context"
	"testing"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
)

func Test_getSwarmSecrets_listsAndConverts(t *testing.T) {
	ctx := context.Background()

	sec := swarm.Secret{ID: "sec-1", Meta: swarm.Meta{CreatedAt: time.Unix(1, 0), UpdatedAt: time.Unix(2, 0)}, Spec: swarm.SecretSpec{Annotations: swarm.Annotations{Name: "s1"}}}
	cli := &fakeDockerClient{SecretListFn: func(context.Context, types.SecretListOptions) ([]swarm.Secret, error) {
		return []swarm.Secret{sec}, nil
	}}

	items, err := getSwarmSecrets(ctx, cli)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 1 || items[0].Name != "s1" {
		t.Fatalf("unexpected items: %+v", items)
	}
	if items[0].Labels == nil {
		t.Fatalf("expected labels to be non-nil")
	}
}

func Test_createSwarmSecret_callsSecretCreate(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{SecretCreateFn: func(_ context.Context, spec swarm.SecretSpec) (types.SecretCreateResponse, error) {
		if spec.Annotations.Name != "s1" {
			t.Fatalf("unexpected name %q", spec.Annotations.Name)
		}
		return types.SecretCreateResponse{ID: "id-1"}, nil
	}}

	id, err := createSwarmSecret(ctx, cli, "s1", []byte("x"), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if id != "id-1" {
		t.Fatalf("expected id-1, got %q", id)
	}
}

func Test_removeSwarmSecret_callsRemove(t *testing.T) {
	ctx := context.Background()

	called := false
	cli := &fakeDockerClient{SecretRemoveFn: func(context.Context, string) error { called = true; return nil }}

	if err := removeSwarmSecret(ctx, cli, "sec-1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Fatalf("expected remove to be called")
	}
}

func Test_getSwarmSecret_returnsItem(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{SecretInspectWithRawFn: func(context.Context, string) (swarm.Secret, []byte, error) {
		return swarm.Secret{ID: "sec-1", Meta: swarm.Meta{CreatedAt: time.Unix(1, 0), UpdatedAt: time.Unix(2, 0)}, Spec: swarm.SecretSpec{Annotations: swarm.Annotations{Name: "s1"}}}, nil, nil
	}}

	item, err := getSwarmSecret(ctx, cli, "sec-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if item == nil || item.ID != "sec-1" {
		t.Fatalf("unexpected item: %+v", item)
	}
}

// Note: The public wrapper functions (GetSwarmSecrets, GetSwarmSecret, CreateSwarmSecret, etc.)
// that accept *client.Client cannot be easily unit tested since they require a real Docker client.
// These wrappers are thin delegates to the internal functions (getSwarmSecrets, getSwarmSecret, etc.)
// which are already comprehensively tested above.

func Test_getSwarmSecretUsage_findsReferencingServices(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		SecretInspectWithRawFn: func(context.Context, string) (swarm.Secret, []byte, error) {
			return swarm.Secret{ID: "sec-1", Spec: swarm.SecretSpec{Annotations: swarm.Annotations{Name: "secret1"}}}, nil, nil
		},
		ServiceListFn: func(context.Context, types.ServiceListOptions) ([]swarm.Service, error) {
			return []swarm.Service{
				{ID: "svc-1", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "service1"}, TaskTemplate: swarm.TaskSpec{ContainerSpec: &swarm.ContainerSpec{Secrets: []*swarm.SecretReference{{SecretID: "sec-1"}}}}}},
				{ID: "svc-2", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "service2"}}},
			}, nil
		},
	}

	refs, err := getSwarmSecretUsage(ctx, cli, "sec-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(refs) != 1 || refs[0].ServiceID != "svc-1" {
		t.Fatalf("expected 1 ref to svc-1, got %+v", refs)
	}
}

func Test_updateSwarmSecretDataImmutable_createsNewSecretAndMigrates(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		SecretInspectWithRawFn: func(context.Context, string) (swarm.Secret, []byte, error) {
			return swarm.Secret{ID: "sec-old", Meta: swarm.Meta{Version: swarm.Version{Index: 1}}, Spec: swarm.SecretSpec{Annotations: swarm.Annotations{Name: "mysecret"}, Data: []byte("old")}}, nil, nil
		},
		SecretCreateFn: func(_ context.Context, spec swarm.SecretSpec) (types.SecretCreateResponse, error) {
			if string(spec.Data) != "new" {
				t.Fatalf("expected new data, got %q", string(spec.Data))
			}
			return types.SecretCreateResponse{ID: "sec-new"}, nil
		},
		ServiceListFn: func(context.Context, types.ServiceListOptions) ([]swarm.Service, error) {
			return []swarm.Service{
				{ID: "svc-1", Meta: swarm.Meta{Version: swarm.Version{Index: 5}}, Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "service1"}, TaskTemplate: swarm.TaskSpec{ContainerSpec: &swarm.ContainerSpec{Secrets: []*swarm.SecretReference{{SecretID: "sec-old", SecretName: "mysecret"}}}}}},
			}, nil
		},
		ServiceInspectWithRawFn: func(context.Context, string, types.ServiceInspectOptions) (swarm.Service, []byte, error) {
			return swarm.Service{ID: "svc-1", Meta: swarm.Meta{Version: swarm.Version{Index: 5}}, Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "service1"}, TaskTemplate: swarm.TaskSpec{ContainerSpec: &swarm.ContainerSpec{Secrets: []*swarm.SecretReference{{SecretID: "sec-old", SecretName: "mysecret"}}}}}}, nil, nil
		},
		ServiceUpdateFn: func(_ context.Context, _ string, _ swarm.Version, spec swarm.ServiceSpec, _ types.ServiceUpdateOptions) (swarm.ServiceUpdateResponse, error) {
			if spec.TaskTemplate.ContainerSpec.Secrets[0].SecretID != "sec-new" {
				t.Fatalf("expected new secret ID")
			}
			return swarm.ServiceUpdateResponse{}, nil
		},
		SecretRemoveFn: func(context.Context, string) error {
			return nil
		},
	}

	result, err := updateSwarmSecretDataImmutable(ctx, cli, "sec-old", []byte("new"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == nil || result.NewSecretID != "sec-new" || len(result.Updated) != 1 {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func Test_serviceReferencesSecret_matchesIDOrName(t *testing.T) {
	svc := swarm.Service{
		Spec: swarm.ServiceSpec{
			TaskTemplate: swarm.TaskSpec{
				ContainerSpec: &swarm.ContainerSpec{
					Secrets: []*swarm.SecretReference{
						{SecretID: "sec-1", SecretName: "secret1"},
					},
				},
			},
		},
	}

	if !serviceReferencesSecret(svc, "sec-1", "") {
		t.Fatal("expected match by ID")
	}
	if !serviceReferencesSecret(svc, "", "secret1") {
		t.Fatal("expected match by name")
	}
	if serviceReferencesSecret(svc, "wrong", "") {
		t.Fatal("unexpected match")
	}
}

func Test_replaceServiceSecretRefs_updatesMatchingRefs(t *testing.T) {
	spec := &swarm.ServiceSpec{
		TaskTemplate: swarm.TaskSpec{
			ContainerSpec: &swarm.ContainerSpec{
				Secrets: []*swarm.SecretReference{
					{SecretID: "old-id", SecretName: "oldname"},
				},
			},
		},
	}

	changed := replaceServiceSecretRefs(spec, "old-id", "oldname", "new-id", "newname")
	if !changed {
		t.Fatal("expected changed=true")
	}
	if spec.TaskTemplate.ContainerSpec.Secrets[0].SecretID != "new-id" {
		t.Fatalf("expected new-id, got %q", spec.TaskTemplate.ContainerSpec.Secrets[0].SecretID)
	}
}
