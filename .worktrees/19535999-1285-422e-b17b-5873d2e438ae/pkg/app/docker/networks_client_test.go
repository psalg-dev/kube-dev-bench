package docker

import (
	"context"
	"testing"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
)

func Test_getSwarmNetworks_returnsConvertedNetworks(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		NetworkListFn: func(context.Context, network.ListOptions) ([]network.Summary, error) {
			return []network.Summary{
				{ID: "net-1", Name: "n1", Driver: "overlay", Scope: "swarm"},
				{ID: "net-2", Name: "n2", Driver: "bridge", Scope: "local"},
			}, nil
		},
	}

	items, err := getSwarmNetworks(ctx, cli)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 networks, got %d", len(items))
	}
	if items[0].ID != "net-1" || items[0].Name != "n1" {
		t.Fatalf("unexpected first network: %+v", items[0])
	}
}

func Test_getSwarmNetwork_returnsNetwork(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		NetworkInspectFn: func(context.Context, string, network.InspectOptions) (network.Inspect, error) {
			return network.Inspect{ID: "net-1", Name: "n1", Driver: "overlay", Scope: "swarm"}, nil
		},
	}

	item, err := getSwarmNetwork(ctx, cli, "net-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if item == nil || item.ID != "net-1" {
		t.Fatalf("unexpected network: %+v", item)
	}
}

func Test_createSwarmNetwork_passesDriverAndOptions(t *testing.T) {
	ctx := context.Background()

	var gotName string
	var got network.CreateOptions
	cli := &fakeDockerClient{
		NetworkCreateFn: func(_ context.Context, name string, opts network.CreateOptions) (network.CreateResponse, error) {
			gotName = name
			got = opts
			return network.CreateResponse{ID: "net-123"}, nil
		},
	}

	id, err := createSwarmNetwork(ctx, cli, "my-net", "overlay", CreateNetworkOptions{Scope: "swarm", Attachable: true})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if id != "net-123" {
		t.Fatalf("expected id net-123, got %q", id)
	}
	if gotName != "my-net" {
		t.Fatalf("expected name my-net, got %q", gotName)
	}
	if got.Driver != "overlay" {
		t.Fatalf("expected driver overlay, got %q", got.Driver)
	}
	if !got.Attachable {
		t.Fatalf("expected attachable true")
	}
	if got.Scope != "swarm" {
		t.Fatalf("expected scope swarm, got %q", got.Scope)
	}

	// Ensure we can set subnet/gateway without panicking.
	_, _ = createSwarmNetwork(ctx, cli, "ipam-net", "overlay", CreateNetworkOptions{Subnet: "10.0.0.0/24", Gateway: "10.0.0.1"})
}

func Test_pruneSwarmNetworks_returnsDeletedIDs(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		NetworksPruneFn: func(context.Context, filters.Args) (network.PruneReport, error) {
			return network.PruneReport{NetworksDeleted: []string{"n1", "n2"}}, nil
		},
	}

	ids, err := pruneSwarmNetworks(ctx, cli)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(ids) != 2 || ids[0] != "n1" {
		t.Fatalf("unexpected ids: %v", ids)
	}
}

func Test_removeSwarmNetwork_callsRemove(t *testing.T) {
	ctx := context.Background()

	called := false
	cli := &fakeDockerClient{
		NetworkRemoveFn: func(context.Context, string) error {
			called = true
			return nil
		},
	}

	if err := removeSwarmNetwork(ctx, cli, "net-1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Fatalf("expected remove to be called")
	}
}
