package docker

import (
	"context"
	"testing"
	"time"

	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/api/types/system"
)

func Test_getSwarmNodes_listsAndConverts(t *testing.T) {
	ctx := context.Background()

	node := swarm.Node{ID: "n1", Spec: swarm.NodeSpec{Role: swarm.NodeRoleWorker}, Description: swarm.NodeDescription{Hostname: "h1"}}
	cli := &fakeDockerClient{NodeListFn: func(context.Context, swarm.NodeListOptions) ([]swarm.Node, error) { return []swarm.Node{node}, nil }}

	items, err := getSwarmNodes(ctx, cli)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 1 || items[0].Hostname != "h1" {
		t.Fatalf("unexpected items: %+v", items)
	}
	if items[0].Labels == nil {
		t.Fatalf("expected labels non-nil")
	}
}

func Test_updateSwarmNodeAvailability_updatesSpec(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		NodeInspectWithRawFn: func(context.Context, string) (swarm.Node, []byte, error) {
			return swarm.Node{ID: "n1", Meta: swarm.Meta{Version: swarm.Version{Index: 1}}, Spec: swarm.NodeSpec{Availability: swarm.NodeAvailabilityActive}}, nil, nil
		},
		NodeUpdateFn: func(_ context.Context, _ string, _ swarm.Version, spec swarm.NodeSpec) error {
			if spec.Availability != swarm.NodeAvailabilityDrain {
				t.Fatalf("expected drain, got %q", spec.Availability)
			}
			return nil
		},
	}

	if err := updateSwarmNodeAvailability(ctx, cli, "n1", "drain"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func Test_updateSwarmNodeRole_updatesSpec(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		NodeInspectWithRawFn: func(context.Context, string) (swarm.Node, []byte, error) {
			return swarm.Node{ID: "n1", Meta: swarm.Meta{Version: swarm.Version{Index: 1}}, Spec: swarm.NodeSpec{Role: swarm.NodeRoleWorker}}, nil, nil
		},
		NodeUpdateFn: func(_ context.Context, _ string, _ swarm.Version, spec swarm.NodeSpec) error {
			if spec.Role != swarm.NodeRoleManager {
				t.Fatalf("expected manager, got %q", spec.Role)
			}
			return nil
		},
	}

	if err := updateSwarmNodeRole(ctx, cli, "n1", "manager"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func Test_updateSwarmNodeLabels_updatesSpec(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		NodeInspectWithRawFn: func(context.Context, string) (swarm.Node, []byte, error) {
			return swarm.Node{ID: "n1", Meta: swarm.Meta{Version: swarm.Version{Index: 1}}, Spec: swarm.NodeSpec{Annotations: swarm.Annotations{Labels: map[string]string{"a": "b"}}}}, nil, nil
		},
		NodeUpdateFn: func(_ context.Context, _ string, _ swarm.Version, spec swarm.NodeSpec) error {
			if spec.Labels["x"] != "y" {
				t.Fatalf("expected labels to be updated")
			}
			return nil
		},
	}

	if err := updateSwarmNodeLabels(ctx, cli, "n1", map[string]string{"x": "y"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func Test_removeSwarmNode_callsRemoveWithForce(t *testing.T) {
	ctx := context.Background()

	var gotForce bool
	cli := &fakeDockerClient{NodeRemoveFn: func(_ context.Context, _ string, opts swarm.NodeRemoveOptions) error {
		gotForce = opts.Force
		return nil
	}}

	if err := removeSwarmNode(ctx, cli, "n1", true); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !gotForce {
		t.Fatalf("expected force=true")
	}
}

func Test_getSwarmNodeTasks_usesNodeFilter(t *testing.T) {
	ctx := context.Background()

	var gotFiltersLen int
	cli := &fakeDockerClient{
		TaskListFn: func(_ context.Context, opts swarm.TaskListOptions) ([]swarm.Task, error) {
			gotFiltersLen = opts.Filters.Len()
			values := opts.Filters.Get("node")
			if len(values) != 1 || values[0] != "n1" {
				t.Fatalf("expected node filter n1, got %v", values)
			}
			return []swarm.Task{{ID: "t1", ServiceID: "s1", NodeID: "n1", Meta: swarm.Meta{CreatedAt: time.Unix(1, 0), UpdatedAt: time.Unix(2, 0)}}}, nil
		},
		ServiceListFn: func(context.Context, swarm.ServiceListOptions) ([]swarm.Service, error) {
			return []swarm.Service{{ID: "s1", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "svc"}}}}, nil
		},
		NodeListFn: func(context.Context, swarm.NodeListOptions) ([]swarm.Node, error) {
			return []swarm.Node{{ID: "n1", Description: swarm.NodeDescription{Hostname: "h"}}}, nil
		},
	}

	items, err := getSwarmNodeTasks(ctx, cli, "n1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotFiltersLen == 0 {
		t.Fatalf("expected filters to be set")
	}
	if len(items) != 1 || items[0].ID != "t1" {
		t.Fatalf("unexpected items: %+v", items)
	}
}

func Test_formatNodeAge_zeroIsDash(t *testing.T) {
	if got := formatNodeAge(time.Time{}); got != "-" {
		t.Fatalf("expected '-', got %q", got)
	}
}

func Test_getSwarmNode_returnsConvertedNode(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{NodeInspectWithRawFn: func(context.Context, string) (swarm.Node, []byte, error) {
		return swarm.Node{ID: "n1", Description: swarm.NodeDescription{Hostname: "h1"}, Spec: swarm.NodeSpec{Role: swarm.NodeRoleWorker}}, nil, nil
	}}

	item, err := getSwarmNode(ctx, cli, "n1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if item == nil || item.Hostname != "h1" {
		t.Fatalf("unexpected item: %+v", item)
	}
}

func Test_formatNodeAge_formatsNonZero(t *testing.T) {
	created := time.Now().Add(-2 * time.Minute)
	if got := formatNodeAge(created); got == "-" {
		t.Fatalf("expected non-dash")
	}
}

// fakeSwarmJoinTokensClient implements swarmJoinTokensClient for testing
type fakeSwarmJoinTokensClient struct {
	swarmInfo swarm.Swarm
	swarmErr  error
	info      system.Info
	infoErr   error
}

func (f *fakeSwarmJoinTokensClient) SwarmInspect(context.Context) (swarm.Swarm, error) {
	if f.swarmErr != nil {
		return swarm.Swarm{}, f.swarmErr
	}
	return f.swarmInfo, nil
}

func (f *fakeSwarmJoinTokensClient) Info(context.Context) (system.Info, error) {
	if f.infoErr != nil {
		return system.Info{}, f.infoErr
	}
	return f.info, nil
}

func Test_getSwarmJoinTokens_returnsTokensAndCommands(t *testing.T) {
	ctx := context.Background()

	cli := &fakeSwarmJoinTokensClient{
		swarmInfo: swarm.Swarm{
			JoinTokens: swarm.JoinTokens{
				Worker:  "SWMTKN-worker-token",
				Manager: "SWMTKN-manager-token",
			},
		},
		info: system.Info{
			Swarm: swarm.Info{
				RemoteManagers: []swarm.Peer{
					{Addr: "192.168.1.1:2377"},
				},
			},
		},
	}

	tokens, err := getSwarmJoinTokens(ctx, cli)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if tokens.Worker != "SWMTKN-worker-token" {
		t.Errorf("expected worker token, got %q", tokens.Worker)
	}
	if tokens.Manager != "SWMTKN-manager-token" {
		t.Errorf("expected manager token, got %q", tokens.Manager)
	}
	if tokens.Addr != "192.168.1.1:2377" {
		t.Errorf("expected manager addr, got %q", tokens.Addr)
	}
	if tokens.Commands.Worker != "docker swarm join --token SWMTKN-worker-token 192.168.1.1:2377" {
		t.Errorf("unexpected worker command: %q", tokens.Commands.Worker)
	}
	if tokens.Commands.Manager != "docker swarm join --token SWMTKN-manager-token 192.168.1.1:2377" {
		t.Errorf("unexpected manager command: %q", tokens.Commands.Manager)
	}
}

func Test_getSwarmJoinTokens_handlesNoRemoteManagers(t *testing.T) {
	ctx := context.Background()

	cli := &fakeSwarmJoinTokensClient{
		swarmInfo: swarm.Swarm{
			JoinTokens: swarm.JoinTokens{
				Worker:  "SWMTKN-worker-token",
				Manager: "SWMTKN-manager-token",
			},
		},
		info: system.Info{
			Swarm: swarm.Info{
				RemoteManagers: []swarm.Peer{}, // empty
			},
		},
	}

	tokens, err := getSwarmJoinTokens(ctx, cli)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if tokens.Worker != "SWMTKN-worker-token" {
		t.Errorf("expected worker token, got %q", tokens.Worker)
	}
	if tokens.Addr != "" {
		t.Errorf("expected empty addr, got %q", tokens.Addr)
	}
	if tokens.Commands.Worker != "" {
		t.Errorf("expected empty worker command, got %q", tokens.Commands.Worker)
	}
}

func Test_getSwarmJoinTokens_propagatesSwarmError(t *testing.T) {
	ctx := context.Background()

	cli := &fakeSwarmJoinTokensClient{
		swarmErr: context.DeadlineExceeded,
	}

	_, err := getSwarmJoinTokens(ctx, cli)
	if err != context.DeadlineExceeded {
		t.Fatalf("expected DeadlineExceeded, got %v", err)
	}
}

func Test_getSwarmJoinTokens_propagatesInfoError(t *testing.T) {
	ctx := context.Background()

	cli := &fakeSwarmJoinTokensClient{
		swarmInfo: swarm.Swarm{},
		infoErr:   context.DeadlineExceeded,
	}

	_, err := getSwarmJoinTokens(ctx, cli)
	if err != context.DeadlineExceeded {
		t.Fatalf("expected DeadlineExceeded, got %v", err)
	}
}

// Note: The public wrapper functions (GetSwarmNodes, GetSwarmNode, UpdateSwarmNodeAvailability, etc.)
// that accept *client.Client cannot be easily unit tested since they require a real Docker client.
// These wrappers are thin delegates to the internal functions (getSwarmNodes, getSwarmNode, etc.)
// which are already comprehensively tested above.
