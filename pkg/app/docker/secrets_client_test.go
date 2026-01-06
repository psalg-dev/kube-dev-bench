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
