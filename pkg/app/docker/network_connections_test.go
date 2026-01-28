package docker

import (
	"context"
	"testing"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/swarm"
)

type fakeNetworkConnectionsClient struct {
	services []swarm.Service
	tasks    []swarm.Task
	nodes    []swarm.Node
	networks map[string]types.NetworkResource
}

func (f *fakeNetworkConnectionsClient) ServiceList(ctx context.Context, opts types.ServiceListOptions) ([]swarm.Service, error) {
	return f.services, nil
}

func (f *fakeNetworkConnectionsClient) TaskList(ctx context.Context, opts types.TaskListOptions) ([]swarm.Task, error) {
	return f.tasks, nil
}

func (f *fakeNetworkConnectionsClient) NodeList(ctx context.Context, opts types.NodeListOptions) ([]swarm.Node, error) {
	return f.nodes, nil
}

func (f *fakeNetworkConnectionsClient) NetworkInspect(ctx context.Context, networkID string, opts types.NetworkInspectOptions) (types.NetworkResource, error) {
	if net, ok := f.networks[networkID]; ok {
		return net, nil
	}
	return types.NetworkResource{ID: networkID}, nil
}

func TestGetSwarmNetworkServices_ReturnsAttachedServices(t *testing.T) {
	ctx := context.Background()
	networkID := "net-123"

	cli := &fakeNetworkConnectionsClient{
		services: []swarm.Service{
			{
				ID: "svc-1",
				Spec: swarm.ServiceSpec{
					Annotations: swarm.Annotations{Name: "web"},
					TaskTemplate: swarm.TaskSpec{
						Networks: []swarm.NetworkAttachmentConfig{
							{Target: networkID},
						},
					},
				},
			},
			{
				ID: "svc-2",
				Spec: swarm.ServiceSpec{
					Annotations: swarm.Annotations{Name: "api"},
					TaskTemplate: swarm.TaskSpec{
						Networks: []swarm.NetworkAttachmentConfig{
							{Target: "other-net"},
						},
					},
				},
			},
			{
				ID: "svc-3",
				Spec: swarm.ServiceSpec{
					Annotations: swarm.Annotations{Name: "database"},
					TaskTemplate: swarm.TaskSpec{
						Networks: []swarm.NetworkAttachmentConfig{
							{Target: networkID},
						},
					},
				},
			},
		},
		networks: map[string]types.NetworkResource{
			networkID: {ID: networkID, Name: "my-network"},
		},
	}

	result, err := getSwarmNetworkServices(ctx, cli, networkID)
	if err != nil {
		t.Fatalf("getSwarmNetworkServices failed: %v", err)
	}

	if len(result) != 2 {
		t.Fatalf("expected 2 attached services, got %d", len(result))
	}

	// Should be sorted by name
	if result[0].ServiceName != "database" {
		t.Errorf("expected first service to be 'database', got %s", result[0].ServiceName)
	}
	if result[1].ServiceName != "web" {
		t.Errorf("expected second service to be 'web', got %s", result[1].ServiceName)
	}
}

func TestGetSwarmNetworkServices_MatchesByNetworkName(t *testing.T) {
	ctx := context.Background()
	networkID := "net-123"
	networkName := "my-overlay"

	cli := &fakeNetworkConnectionsClient{
		services: []swarm.Service{
			{
				ID: "svc-1",
				Spec: swarm.ServiceSpec{
					Annotations: swarm.Annotations{Name: "web"},
					TaskTemplate: swarm.TaskSpec{
						Networks: []swarm.NetworkAttachmentConfig{
							{Target: networkName},
						},
					},
				},
			},
		},
		networks: map[string]types.NetworkResource{
			networkID: {ID: networkID, Name: networkName},
		},
	}

	result, err := getSwarmNetworkServices(ctx, cli, networkID)
	if err != nil {
		t.Fatalf("getSwarmNetworkServices failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 attached service (matched by name), got %d", len(result))
	}
}

func TestGetSwarmNetworkServices_EmptyServices(t *testing.T) {
	ctx := context.Background()

	cli := &fakeNetworkConnectionsClient{
		services: []swarm.Service{},
	}

	result, err := getSwarmNetworkServices(ctx, cli, "net-123")
	if err != nil {
		t.Fatalf("getSwarmNetworkServices failed: %v", err)
	}

	if len(result) != 0 {
		t.Fatalf("expected 0 services, got %d", len(result))
	}
}

func TestGetSwarmNetworkContainers_ReturnsAttachedTasks(t *testing.T) {
	ctx := context.Background()
	networkID := "net-123"

	cli := &fakeNetworkConnectionsClient{
		tasks: []swarm.Task{
			{
				ID:        "task-1",
				ServiceID: "svc-1",
				NodeID:    "node-1",
				Status:    swarm.TaskStatus{State: swarm.TaskStateRunning},
				NetworksAttachments: []swarm.NetworkAttachment{
					{Network: swarm.Network{ID: networkID}},
				},
			},
			{
				ID:        "task-2",
				ServiceID: "svc-2",
				NodeID:    "node-1",
				Status:    swarm.TaskStatus{State: swarm.TaskStateRunning},
				NetworksAttachments: []swarm.NetworkAttachment{
					{Network: swarm.Network{ID: "other-net"}},
				},
			},
		},
		services: []swarm.Service{
			{ID: "svc-1", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "web"}}},
			{ID: "svc-2", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "api"}}},
		},
		nodes: []swarm.Node{
			{ID: "node-1", Description: swarm.NodeDescription{Hostname: "worker-1"}},
		},
	}

	result, err := getSwarmNetworkContainers(ctx, cli, networkID)
	if err != nil {
		t.Fatalf("getSwarmNetworkContainers failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 attached task, got %d", len(result))
	}

	if result[0].ID != "task-1" {
		t.Errorf("expected task-1, got %s", result[0].ID)
	}
	if result[0].ServiceName != "web" {
		t.Errorf("expected service name 'web', got %s", result[0].ServiceName)
	}
	if result[0].NodeName != "worker-1" {
		t.Errorf("expected node name 'worker-1', got %s", result[0].NodeName)
	}
}

func TestGetSwarmNetworkContainers_EmptyTasks(t *testing.T) {
	ctx := context.Background()

	cli := &fakeNetworkConnectionsClient{
		tasks: []swarm.Task{},
	}

	result, err := getSwarmNetworkContainers(ctx, cli, "net-123")
	if err != nil {
		t.Fatalf("getSwarmNetworkContainers failed: %v", err)
	}

	if len(result) != 0 {
		t.Fatalf("expected 0 tasks, got %d", len(result))
	}
}

func TestGetSwarmNetworkContainers_SortsByServiceNameThenID(t *testing.T) {
	ctx := context.Background()
	networkID := "net-123"

	cli := &fakeNetworkConnectionsClient{
		tasks: []swarm.Task{
			{
				ID:        "task-c",
				ServiceID: "svc-1",
				NetworksAttachments: []swarm.NetworkAttachment{
					{Network: swarm.Network{ID: networkID}},
				},
			},
			{
				ID:        "task-a",
				ServiceID: "svc-1",
				NetworksAttachments: []swarm.NetworkAttachment{
					{Network: swarm.Network{ID: networkID}},
				},
			},
			{
				ID:        "task-b",
				ServiceID: "svc-2",
				NetworksAttachments: []swarm.NetworkAttachment{
					{Network: swarm.Network{ID: networkID}},
				},
			},
		},
		services: []swarm.Service{
			{ID: "svc-1", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "web"}}},
			{ID: "svc-2", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "api"}}},
		},
	}

	result, err := getSwarmNetworkContainers(ctx, cli, networkID)
	if err != nil {
		t.Fatalf("getSwarmNetworkContainers failed: %v", err)
	}

	if len(result) != 3 {
		t.Fatalf("expected 3 tasks, got %d", len(result))
	}

	// api < web, so task-b should be first
	if result[0].ID != "task-b" {
		t.Errorf("expected first task to be 'task-b' (api service), got %s", result[0].ID)
	}
	// Then web service tasks sorted by ID
	if result[1].ID != "task-a" {
		t.Errorf("expected second task to be 'task-a', got %s", result[1].ID)
	}
	if result[2].ID != "task-c" {
		t.Errorf("expected third task to be 'task-c', got %s", result[2].ID)
	}
}

func TestGetSwarmNetworkInspectJSON_ReturnsJSON(t *testing.T) {
	ctx := context.Background()
	networkID := "net-123"

	cli := &fakeNetworkConnectionsClient{
		networks: map[string]types.NetworkResource{
			networkID: {
				ID:     networkID,
				Name:   "my-network",
				Driver: "overlay",
				Scope:  "swarm",
				IPAM: network.IPAM{
					Config: []network.IPAMConfig{
						{Subnet: "10.0.0.0/24"},
					},
				},
			},
		},
	}

	result, err := getSwarmNetworkInspectJSON(ctx, cli, networkID)
	if err != nil {
		t.Fatalf("getSwarmNetworkInspectJSON failed: %v", err)
	}

	if result == "" {
		t.Fatal("expected non-empty JSON")
	}

	// Check that it contains expected fields
	if !contains(result, "my-network") {
		t.Error("expected JSON to contain network name")
	}
	if !contains(result, "overlay") {
		t.Error("expected JSON to contain driver")
	}
	if !contains(result, "10.0.0.0/24") {
		t.Error("expected JSON to contain subnet")
	}
}

func contains(s, substr string) bool {
	return len(s) > 0 && len(substr) > 0 && s != substr && s != "" && indexOf(s, substr) >= 0
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
