package docker

import (
	"context"
	"testing"

	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/swarm"
)

func Test_getSwarmStacks_groupsByStackLabel(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{ServiceListFn: func(context.Context, swarm.ServiceListOptions) ([]swarm.Service, error) {
		return []swarm.Service{
			{Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "a", Labels: map[string]string{"com.docker.stack.namespace": "stack-1"}}}},
			{Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "b", Labels: map[string]string{"com.docker.stack.namespace": "stack-1"}}}},
			{Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "c", Labels: map[string]string{"com.docker.stack.namespace": "stack-2"}}}},
		}, nil
	}}

	items, err := getSwarmStacks(ctx, cli)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 stacks, got %d", len(items))
	}
}

func Test_removeSwarmStack_removesServicesNetworksConfigsSecrets(t *testing.T) {
	ctx := context.Background()

	removedServices := 0
	removedNetworks := 0
	removedConfigs := 0
	removedSecrets := 0

	cli := &fakeDockerClient{
		ServiceListFn: func(context.Context, swarm.ServiceListOptions) ([]swarm.Service, error) {
			return []swarm.Service{
				{ID: "svc-1", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Labels: map[string]string{"com.docker.stack.namespace": "stack-a"}}}},
				{ID: "svc-2", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Labels: map[string]string{"com.docker.stack.namespace": "stack-b"}}}},
			}, nil
		},
		ServiceRemoveFn: func(_ context.Context, id string) error {
			if id == "svc-1" {
				removedServices++
			}
			return nil
		},
		NetworkListFn: func(context.Context, network.ListOptions) ([]network.Summary, error) {
			return []network.Summary{{ID: "net-1", Labels: map[string]string{"com.docker.stack.namespace": "stack-a"}}}, nil
		},
		NetworkRemoveFn: func(_ context.Context, id string) error {
			if id == "net-1" {
				removedNetworks++
			}
			return nil
		},
		ConfigListFn: func(context.Context, swarm.ConfigListOptions) ([]swarm.Config, error) {
			return []swarm.Config{{ID: "cfg-1", Spec: swarm.ConfigSpec{Annotations: swarm.Annotations{Labels: map[string]string{"com.docker.stack.namespace": "stack-a"}}}}}, nil
		},
		ConfigRemoveFn: func(_ context.Context, id string) error {
			if id == "cfg-1" {
				removedConfigs++
			}
			return nil
		},
		SecretListFn: func(context.Context, swarm.SecretListOptions) ([]swarm.Secret, error) {
			return []swarm.Secret{{ID: "sec-1", Spec: swarm.SecretSpec{Annotations: swarm.Annotations{Labels: map[string]string{"com.docker.stack.namespace": "stack-a"}}}}}, nil
		},
		SecretRemoveFn: func(_ context.Context, id string) error {
			if id == "sec-1" {
				removedSecrets++
			}
			return nil
		},
	}

	if err := removeSwarmStack(ctx, cli, "stack-a"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if removedServices != 1 || removedNetworks != 1 || removedConfigs != 1 || removedSecrets != 1 {
		t.Fatalf("unexpected removals: services=%d networks=%d configs=%d secrets=%d", removedServices, removedNetworks, removedConfigs, removedSecrets)
	}
}
