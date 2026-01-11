package topology

import (
	"context"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
)

type swarmTopologyClient interface {
	ServiceList(context.Context, types.ServiceListOptions) ([]swarm.Service, error)
	TaskList(context.Context, types.TaskListOptions) ([]swarm.Task, error)
	NodeList(context.Context, types.NodeListOptions) ([]swarm.Node, error)
}

// BuildClusterTopology aggregates Swarm nodes/services/tasks into a bipartite graph.
// It is best-effort and safe to call on a polling loop.
func BuildClusterTopology(ctx context.Context, cli swarmTopologyClient) (ClusterTopology, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return ClusterTopology{}, err
	}
	tasks, err := cli.TaskList(ctx, types.TaskListOptions{})
	if err != nil {
		return ClusterTopology{}, err
	}
	nodes, err := cli.NodeList(ctx, types.NodeListOptions{})
	if err != nil {
		return ClusterTopology{}, err
	}

	// Node lookup
	nodeHost := make(map[string]string, len(nodes))
	outNodes := make([]TopologyNode, 0, len(nodes))
	for _, n := range nodes {
		host := n.Description.Hostname
		nodeHost[n.ID] = host
		outNodes = append(outNodes, TopologyNode{
			ID:       n.ID,
			Hostname: host,
			Role:     string(n.Spec.Role),
			State:    string(n.Status.State),
		})
	}

	// Service lookup
	outServices := make([]TopologyService, 0, len(services))
	serviceName := make(map[string]string, len(services))
	serviceMode := make(map[string]string, len(services))
	serviceDesired := make(map[string]int, len(services))
	for _, s := range services {
		name := s.Spec.Annotations.Name
		serviceName[s.ID] = name

		mode := "replicated"
		desired := 0
		if s.Spec.Mode.Global != nil {
			mode = "global"
		} else if s.Spec.Mode.Replicated != nil && s.Spec.Mode.Replicated.Replicas != nil {
			desired = int(*s.Spec.Mode.Replicated.Replicas)
		}
		serviceMode[s.ID] = mode
		serviceDesired[s.ID] = desired

		outServices = append(outServices, TopologyService{
			ID:              s.ID,
			Name:            name,
			Mode:            mode,
			DesiredReplicas: desired,
		})
	}

	// Counts
	nodeTaskCount := map[string]int{}
	svcTaskCount := map[string]int{}
	svcRunningCount := map[string]int{}
	pairRunning := map[string]int{} // serviceID|nodeID -> running tasks

	for _, t := range tasks {
		if t.NodeID != "" {
			nodeTaskCount[t.NodeID]++
		}
		if t.ServiceID != "" {
			svcTaskCount[t.ServiceID]++
		}
		if t.Status.State == swarm.TaskStateRunning {
			if t.ServiceID != "" {
				svcRunningCount[t.ServiceID]++
			}
			if t.ServiceID != "" && t.NodeID != "" {
				key := t.ServiceID + "|" + t.NodeID
				pairRunning[key]++
			}
		}
	}

	// Merge counts into outputs.
	for i := range outNodes {
		outNodes[i].TaskCount = nodeTaskCount[outNodes[i].ID]
	}
	for i := range outServices {
		sid := outServices[i].ID
		outServices[i].TaskCount = svcTaskCount[sid]
		outServices[i].RunningTasks = svcRunningCount[sid]
		if outServices[i].Mode == "global" {
			// For global services, desired replicas is typically per-node; keep 0 here.
			outServices[i].DesiredReplicas = serviceDesired[sid]
		}
	}

	links := make([]TopologyLink, 0, len(pairRunning))
	for key, w := range pairRunning {
		if w <= 0 {
			continue
		}
		// key is service|node
		sep := -1
		for i := 0; i < len(key); i++ {
			if key[i] == '|' {
				sep = i
				break
			}
		}
		if sep <= 0 || sep >= len(key)-1 {
			continue
		}
		sid := key[:sep]
		nid := key[sep+1:]
		if _, ok := serviceName[sid]; !ok {
			continue
		}
		if _, ok := nodeHost[nid]; !ok {
			continue
		}
		links = append(links, TopologyLink{From: sid, To: nid, Type: "runs_on", Weight: w})
	}

	return ClusterTopology{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Nodes:     outNodes,
		Services:  outServices,
		Links:     links,
	}, nil
}
