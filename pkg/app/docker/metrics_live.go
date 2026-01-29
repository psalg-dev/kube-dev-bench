package docker

import (
	"context"
	"encoding/json"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

func CollectSwarmMetricsWithBreakdown(ctx context.Context, cli *client.Client) (SwarmMetricsPoint, SwarmMetricsBreakdown, error) {
	return collectSwarmMetricsWithBreakdown(ctx, cli)
}

func collectSwarmMetricsWithBreakdown(ctx context.Context, cli *client.Client) (SwarmMetricsPoint, SwarmMetricsBreakdown, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return SwarmMetricsPoint{}, SwarmMetricsBreakdown{}, err
	}
	tasks, err := cli.TaskList(ctx, types.TaskListOptions{})
	if err != nil {
		return SwarmMetricsPoint{}, SwarmMetricsBreakdown{}, err
	}
	nodes, err := cli.NodeList(ctx, types.NodeListOptions{})
	if err != nil {
		return SwarmMetricsPoint{}, SwarmMetricsBreakdown{}, err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	
	// Calculate base metrics
	readyNodes, cpuCap, memCap := calculateNodeCapacity(nodes)
	runningTasks := countRunningTasks(tasks)
	cpuRes, memRes, cpuLim, memLim := calculateServiceResources(services, readyNodes)

	// Build base metrics point
	point := SwarmMetricsPoint{
		Timestamp:               now,
		Services:                len(services),
		Tasks:                   len(tasks),
		RunningTasks:            runningTasks,
		Nodes:                   len(nodes),
		ReadyNodes:              readyNodes,
		CpuCapacityNano:         cpuCap,
		MemoryCapacityBytes:     memCap,
		CpuReservationsNano:     cpuRes,
		MemoryReservationsBytes: memRes,
		CpuLimitsNano:           cpuLim,
		MemoryLimitsBytes:       memLim,
	}

	// Build name maps
	serviceNames := buildServiceNamesMap(services)
	nodeNames := buildNodeNamesMap(nodes)

	// Collect container stats and build breakdown
	breakdown, containerStats := collectContainerStatsBreakdown(ctx, cli, tasks, now, serviceNames, nodeNames)

	// Update point with container stats
	point.RunningContainers = containerStats.containers
	point.MemoryUsedBytes = containerStats.sumMemUsed
	point.NetworkRxBytes = containerStats.sumNetRx
	point.NetworkTxBytes = containerStats.sumNetTx
	point.CpuUsagePercent = cpuUsagePercentOfCapacity(containerStats.sumCpuPercent, cpuCap)

	appendSwarmMetricsPoint(point)

	return point, breakdown, nil
}

// calculateNodeCapacity calculates total ready nodes and their CPU/memory capacity
func calculateNodeCapacity(nodes []swarm.Node) (readyNodes int, cpuCap int64, memCap int64) {
	for _, n := range nodes {
		if n.Status.State == swarm.NodeStateReady {
			readyNodes++
			if n.Description.Resources.NanoCPUs > 0 {
				cpuCap += n.Description.Resources.NanoCPUs
			}
			if n.Description.Resources.MemoryBytes > 0 {
				memCap += n.Description.Resources.MemoryBytes
			}
		}
	}
	return readyNodes, cpuCap, memCap
}

// countRunningTasks counts tasks in running state
func countRunningTasks(tasks []swarm.Task) int {
	count := 0
	for _, t := range tasks {
		if t.Status.State == swarm.TaskStateRunning {
			count++
		}
	}
	return count
}

// calculateServiceResources calculates total CPU/memory reservations and limits
func calculateServiceResources(services []swarm.Service, readyNodes int) (cpuRes int64, memRes int64, cpuLim int64, memLim int64) {
	for _, s := range services {
		mult := int64(0)
		if s.Spec.Mode.Replicated != nil {
			if s.Spec.Mode.Replicated.Replicas != nil {
				mult = int64(*s.Spec.Mode.Replicated.Replicas)
			}
		} else if s.Spec.Mode.Global != nil {
			mult = int64(readyNodes)
		}
		if mult <= 0 {
			continue
		}

		req := s.Spec.TaskTemplate.Resources
		if req == nil {
			continue
		}
		if req.Reservations != nil {
			cpuRes += req.Reservations.NanoCPUs * mult
			memRes += req.Reservations.MemoryBytes * mult
		}
		if req.Limits != nil {
			cpuLim += req.Limits.NanoCPUs * mult
			memLim += req.Limits.MemoryBytes * mult
		}
	}
	return cpuRes, memRes, cpuLim, memLim
}

// buildServiceNamesMap creates a map of service IDs to names
func buildServiceNamesMap(services []swarm.Service) map[string]string {
	serviceNames := make(map[string]string, len(services))
	for _, s := range services {
		serviceNames[s.ID] = s.Spec.Name
	}
	return serviceNames
}

// buildNodeNamesMap creates a map of node IDs to hostnames
func buildNodeNamesMap(nodes []swarm.Node) map[string]string {
	nodeNames := make(map[string]string, len(nodes))
	for _, n := range nodes {
		nodeNames[n.ID] = n.Description.Hostname
	}
	return nodeNames
}

// containerStatsAggregates holds aggregated container statistics
type containerStatsAggregates struct {
	containers    int
	sumCpuPercent float64
	sumMemUsed    int64
	sumNetRx      int64
	sumNetTx      int64
}

// collectContainerStatsBreakdown collects container stats for running tasks
func collectContainerStatsBreakdown(ctx context.Context, cli *client.Client, tasks []swarm.Task, timestamp string, serviceNames, nodeNames map[string]string) (SwarmMetricsBreakdown, containerStatsAggregates) {
	servicesAgg := map[string]*svcAgg{}
	nodesAgg := map[string]*nodeAgg{}
	agg := containerStatsAggregates{}

	for _, t := range tasks {
		if t.Status.State != swarm.TaskStateRunning {
			continue
		}
		if t.Status.ContainerStatus == nil || t.Status.ContainerStatus.ContainerID == "" {
			continue
		}

		stats, ok := fetchContainerStats(ctx, cli, t.Status.ContainerStatus.ContainerID)
		if !ok {
			continue
		}

		agg.containers++
		agg.sumCpuPercent += stats.cpuPercent
		agg.sumMemUsed += stats.memUsed
		agg.sumNetRx += stats.netRx
		agg.sumNetTx += stats.netTx

		// Aggregate by service
		aggregateServiceStats(servicesAgg, t.ServiceID, serviceNames, timestamp, stats)

		// Aggregate by node
		aggregateNodeStats(nodesAgg, t.NodeID, nodeNames, timestamp, stats)
	}

	breakdown := SwarmMetricsBreakdown{Timestamp: timestamp}
	breakdown.Services = make([]SwarmServiceMetrics, 0, len(servicesAgg))
	for _, v := range servicesAgg {
		breakdown.Services = append(breakdown.Services, v.m)
	}
	breakdown.Nodes = make([]SwarmNodeMetrics, 0, len(nodesAgg))
	for _, v := range nodesAgg {
		breakdown.Nodes = append(breakdown.Nodes, v.m)
	}

	return breakdown, agg
}

// containerStats holds parsed container statistics
type containerStats struct {
	cpuPercent float64
	memUsed    int64
	memLimit   int64
	netRx      int64
	netTx      int64
}

// fetchContainerStats fetches and parses container statistics
func fetchContainerStats(ctx context.Context, cli *client.Client, containerID string) (containerStats, bool) {
	statsResp, err := cli.ContainerStats(ctx, containerID, false)
	if err != nil {
		return containerStats{}, false
	}
	defer statsResp.Body.Close()

	var sj types.StatsJSON
	err = json.NewDecoder(statsResp.Body).Decode(&sj)
	if err != nil {
		return containerStats{}, false
	}

	cpuP := cpuPercent(&sj)
	memUsed, memLimit := memoryUsage(&sj)
	rx, tx := networkTotals(&sj)

	return containerStats{
		cpuPercent: cpuP,
		memUsed:    memUsed,
		memLimit:   memLimit,
		netRx:      rx,
		netTx:      tx,
	}, true
}

// aggregateServiceStats aggregates statistics for a service
func aggregateServiceStats(servicesAgg map[string]*svcAgg, serviceID string, serviceNames map[string]string, timestamp string, stats containerStats) {
	if serviceID == "" {
		return
	}

	agg := servicesAgg[serviceID]
	if agg == nil {
		agg = &svcAgg{m: SwarmServiceMetrics{Timestamp: timestamp, ServiceID: serviceID, ServiceName: serviceNames[serviceID]}}
		servicesAgg[serviceID] = agg
	}
	agg.m.RunningTasks++
	agg.m.Containers++
	agg.m.CpuPercent += stats.cpuPercent
	agg.m.MemoryUsedBytes += stats.memUsed
	agg.m.MemoryLimitBytes += stats.memLimit
	agg.m.NetworkRxBytes += stats.netRx
	agg.m.NetworkTxBytes += stats.netTx
}

// aggregateNodeStats aggregates statistics for a node
func aggregateNodeStats(nodesAgg map[string]*nodeAgg, nodeID string, nodeNames map[string]string, timestamp string, stats containerStats) {
	if nodeID == "" {
		return
	}

	agg := nodesAgg[nodeID]
	if agg == nil {
		agg = &nodeAgg{m: SwarmNodeMetrics{Timestamp: timestamp, NodeID: nodeID, Hostname: nodeNames[nodeID]}}
		nodesAgg[nodeID] = agg
	}
	agg.m.RunningTasks++
	agg.m.Containers++
	agg.m.CpuPercent += stats.cpuPercent
	agg.m.MemoryUsedBytes += stats.memUsed
	agg.m.NetworkRxBytes += stats.netRx
	agg.m.NetworkTxBytes += stats.netTx
}

// svcAgg is a wrapper for service metrics aggregation
type svcAgg struct {
	m SwarmServiceMetrics
}

// nodeAgg is a wrapper for node metrics aggregation
type nodeAgg struct {
	m SwarmNodeMetrics
}

func cpuPercent(s *types.StatsJSON) float64 {
	if s == nil {
		return 0
	}
	cpuDelta := float64(s.CPUStats.CPUUsage.TotalUsage - s.PreCPUStats.CPUUsage.TotalUsage)
	sysDelta := float64(s.CPUStats.SystemUsage - s.PreCPUStats.SystemUsage)
	if cpuDelta <= 0 || sysDelta <= 0 {
		return 0
	}
	online := float64(s.CPUStats.OnlineCPUs)
	if online <= 0 {
		if n := len(s.CPUStats.CPUUsage.PercpuUsage); n > 0 {
			online = float64(n)
		} else {
			online = 1
		}
	}
	return (cpuDelta / sysDelta) * online * 100.0
}

func memoryUsage(s *types.StatsJSON) (used int64, limit int64) {
	if s == nil {
		return 0, 0
	}
	usage := int64(s.MemoryStats.Usage)
	limit = int64(s.MemoryStats.Limit)
	cache := int64(0)
	if s.MemoryStats.Stats != nil {
		if v, ok := s.MemoryStats.Stats["cache"]; ok {
			cache = int64(v)
		}
	}
	if cache > 0 && usage > cache {
		usage = usage - cache
	}
	if usage < 0 {
		usage = 0
	}
	return usage, limit
}

func networkTotals(s *types.StatsJSON) (rx int64, tx int64) {
	if s == nil {
		return 0, 0
	}
	if s.Networks == nil {
		return 0, 0
	}
	for _, v := range s.Networks {
		rx += int64(v.RxBytes)
		tx += int64(v.TxBytes)
	}
	return rx, tx
}

func cpuUsagePercentOfCapacity(sumCpuPercent float64, cpuCapNano int64) float64 {
	if sumCpuPercent <= 0 {
		return 0
	}
	capCores := float64(cpuCapNano) / 1e9
	if capCores <= 0 {
		return 0
	}
	// sumCpuPercent is already in the "can exceed 100" space; divide by core-count to normalize.
	return sumCpuPercent / capCores
}
