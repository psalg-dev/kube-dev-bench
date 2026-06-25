package docker

import (
	"context"
	"testing"

	"github.com/moby/moby/api/types/network"
	"github.com/moby/moby/api/types/swarm"
	"github.com/moby/moby/client"
)

func Test_getSwarmStacks_groupsByStackLabel(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{ServiceListFn: func(context.Context, client.ServiceListOptions) (client.ServiceListResult, error) {
		return client.ServiceListResult{Items: []swarm.Service{
			{Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "a", Labels: map[string]string{"com.docker.stack.namespace": "stack-1"}}}},
			{Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "b", Labels: map[string]string{"com.docker.stack.namespace": "stack-1"}}}},
			{Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "c", Labels: map[string]string{"com.docker.stack.namespace": "stack-2"}}}},
		}}, nil
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
		ServiceListFn: func(context.Context, client.ServiceListOptions) (client.ServiceListResult, error) {
			return client.ServiceListResult{Items: []swarm.Service{
				{ID: "svc-1", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Labels: map[string]string{"com.docker.stack.namespace": "stack-a"}}}},
				{ID: "svc-2", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Labels: map[string]string{"com.docker.stack.namespace": "stack-b"}}}},
			}}, nil
		},
		ServiceRemoveFn: func(_ context.Context, id string, opts client.ServiceRemoveOptions) (client.ServiceRemoveResult, error) {
			if id == "svc-1" {
				removedServices++
			}
			return client.ServiceRemoveResult{}, nil
		},
		NetworkListFn: func(context.Context, client.NetworkListOptions) (client.NetworkListResult, error) {
			return client.NetworkListResult{Items: []network.Summary{{Network: network.Network{ID: "net-1", Labels: map[string]string{"com.docker.stack.namespace": "stack-a"}}}}}, nil
		},
		NetworkRemoveFn: func(_ context.Context, id string, opts client.NetworkRemoveOptions) (client.NetworkRemoveResult, error) {
			if id == "net-1" {
				removedNetworks++
			}
			return client.NetworkRemoveResult{}, nil
		},
		ConfigListFn: func(context.Context, client.ConfigListOptions) (client.ConfigListResult, error) {
			return client.ConfigListResult{Items: []swarm.Config{{ID: "cfg-1", Spec: swarm.ConfigSpec{Annotations: swarm.Annotations{Labels: map[string]string{"com.docker.stack.namespace": "stack-a"}}}}}}, nil
		},
		ConfigRemoveFn: func(_ context.Context, id string, opts client.ConfigRemoveOptions) (client.ConfigRemoveResult, error) {
			if id == "cfg-1" {
				removedConfigs++
			}
			return client.ConfigRemoveResult{}, nil
		},
		SecretListFn: func(context.Context, client.SecretListOptions) (client.SecretListResult, error) {
			return client.SecretListResult{Items: []swarm.Secret{{ID: "sec-1", Spec: swarm.SecretSpec{Annotations: swarm.Annotations{Labels: map[string]string{"com.docker.stack.namespace": "stack-a"}}}}}}, nil
		},
		SecretRemoveFn: func(_ context.Context, id string, opts client.SecretRemoveOptions) (client.SecretRemoveResult, error) {
			if id == "sec-1" {
				removedSecrets++
			}
			return client.SecretRemoveResult{}, nil
		},
	}

	if err := removeSwarmStack(ctx, cli, "stack-a"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if removedServices != 1 || removedNetworks != 1 || removedConfigs != 1 || removedSecrets != 1 {
		t.Fatalf("unexpected removals: services=%d networks=%d configs=%d secrets=%d", removedServices, removedNetworks, removedConfigs, removedSecrets)
	}
}
