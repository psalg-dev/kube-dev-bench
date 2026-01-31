package topology

import (
	"context"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
)

type swarmTopologyClient interface {
	ServiceList(context.Context, types.ServiceListOptions) ([]swarm.Service, error)
	TaskList(context.Context, types.TaskListOptions) ([]swarm.Task, error)
	NodeList(context.Context, types.NodeListOptions) ([]swarm.Node, error)
}

// buildNodeLookup creates a map of node IDs to hostnames and a slice of TopologyNodes
func buildNodeLookup(nodes []swarm.Node) (map[string]string, []TopologyNode) {
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
	return nodeHost, outNodes
}

// getServiceModeAndDesired determines the mode and desired replicas for a service
func getServiceModeAndDesired(s swarm.Service) (string, int) {
	if s.Spec.Mode.Global != nil {
		return "global", 0
	}
	if s.Spec.Mode.Replicated != nil && s.Spec.Mode.Replicated.Replicas != nil {
		return "replicated", int(*s.Spec.Mode.Replicated.Replicas)
	}
	return "replicated", 0
}

// buildServiceLookup creates service maps and a slice of TopologyServices
func buildServiceLookup(services []swarm.Service) (map[string]string, map[string]string, map[string]int, []TopologyService) {
	serviceName := make(map[string]string, len(services))
	serviceMode := make(map[string]string, len(services))
	serviceDesired := make(map[string]int, len(services))
	outServices := make([]TopologyService, 0, len(services))

	for _, s := range services {
		name := s.Spec.Annotations.Name
		serviceName[s.ID] = name
		mode, desired := getServiceModeAndDesired(s)
		serviceMode[s.ID] = mode
		serviceDesired[s.ID] = desired

		outServices = append(outServices, TopologyService{
			ID:              s.ID,
			Name:            name,
			Mode:            mode,
			DesiredReplicas: desired,
		})
	}
	return serviceName, serviceMode, serviceDesired, outServices
}

// taskCounts holds the aggregated counts from tasks
type taskCounts struct {
	nodeTaskCount   map[string]int
	svcTaskCount    map[string]int
	svcRunningCount map[string]int
	pairRunning     map[string]int // serviceID|nodeID -> running tasks
}

// aggregateTaskCounts counts tasks by node, service, and running pairs
func aggregateTaskCounts(tasks []swarm.Task) taskCounts {
	counts := taskCounts{
		nodeTaskCount:   make(map[string]int),
		svcTaskCount:    make(map[string]int),
		svcRunningCount: make(map[string]int),
		pairRunning:     make(map[string]int),
	}

	for _, t := range tasks {
		if t.NodeID != "" {
			counts.nodeTaskCount[t.NodeID]++
		}
		if t.ServiceID != "" {
			counts.svcTaskCount[t.ServiceID]++
		}
		if t.Status.State == swarm.TaskStateRunning {
			if t.ServiceID != "" {
				counts.svcRunningCount[t.ServiceID]++
			}
			if t.ServiceID != "" && t.NodeID != "" {
				key := t.ServiceID + "|" + t.NodeID
				counts.pairRunning[key]++
			}
		}
	}
	return counts
}

// mergeNodeCounts updates node task counts in place
func mergeNodeCounts(outNodes []TopologyNode, nodeTaskCount map[string]int) {
	for i := range outNodes {
		outNodes[i].TaskCount = nodeTaskCount[outNodes[i].ID]
	}
}

// mergeServiceCounts updates service task counts in place
func mergeServiceCounts(outServices []TopologyService, counts taskCounts, serviceDesired map[string]int) {
	for i := range outServices {
		sid := outServices[i].ID
		outServices[i].TaskCount = counts.svcTaskCount[sid]
		outServices[i].RunningTasks = counts.svcRunningCount[sid]
		if outServices[i].Mode == "global" {
			outServices[i].DesiredReplicas = serviceDesired[sid]
		}
	}
}

// buildTopologyLinks creates links from the pair running counts
func buildTopologyLinks(pairRunning map[string]int, serviceName, nodeHost map[string]string) []TopologyLink {
	links := make([]TopologyLink, 0, len(pairRunning))
	for key, w := range pairRunning {
		if w <= 0 {
			continue
		}
		parts := strings.SplitN(key, "|", 2)
		if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
			continue
		}
		sid, nid := parts[0], parts[1]
		if _, ok := serviceName[sid]; !ok {
			continue
		}
		if _, ok := nodeHost[nid]; !ok {
			continue
		}
		links = append(links, TopologyLink{From: sid, To: nid, Type: "runs_on", Weight: w})
	}
	return links
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

	nodeHost, outNodes := buildNodeLookup(nodes)
	serviceName, _, serviceDesired, outServices := buildServiceLookup(services)
	counts := aggregateTaskCounts(tasks)

	mergeNodeCounts(outNodes, counts.nodeTaskCount)
	mergeServiceCounts(outServices, counts, serviceDesired)
	links := buildTopologyLinks(counts.pairRunning, serviceName, nodeHost)

	return ClusterTopology{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Nodes:     outNodes,
		Services:  outServices,
		Links:     links,
	}, nil
}
