package docker

import (
	"context"
	"encoding/json"
	"time"

	"github.com/docker/docker/api/types/container"
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

	services, err := cli.ServiceList(ctx, swarm.ServiceListOptions{})
	if err != nil {
		return SwarmMetricsPoint{}, SwarmMetricsBreakdown{}, err
	}
	tasks, err := cli.TaskList(ctx, swarm.TaskListOptions{})
	if err != nil {
		return SwarmMetricsPoint{}, SwarmMetricsBreakdown{}, err
	}
	nodes, err := cli.NodeList(ctx, swarm.NodeListOptions{})
	if err != nil {
		return SwarmMetricsPoint{}, SwarmMetricsBreakdown{}, err
	}

	// Compute node capacity metrics
	readyNodes, cpuCap, memCap := computeNodeCapacity(nodes)

	// Count running tasks
	runningTasks := countRunningTasks(tasks)

	// Compute resource reservations and limits
	cpuRes, memRes, cpuLim, memLim := computeResourceUsage(services, readyNodes)

	now := time.Now().UTC().Format(time.RFC3339)
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
	serviceNames := buildServiceNameMap(services)
	nodeNames := buildNodeNameMap(nodes)

	// Collect container stats and build breakdown
	breakdown, containers, sumCPUPercent, sumMemUsed, sumNetRx, sumNetTx := collectContainerStats(ctx, cli, tasks, serviceNames, nodeNames, now)

	point.RunningContainers = containers
	point.MemoryUsedBytes = sumMemUsed
	point.NetworkRxBytes = sumNetRx
	point.NetworkTxBytes = sumNetTx
	point.CpuUsagePercent = cpuUsagePercentOfCapacity(sumCPUPercent, cpuCap)

	appendSwarmMetricsPoint(point)

	return point, breakdown, nil
}

// computeNodeCapacity computes the total capacity from ready nodes
func computeNodeCapacity(nodes []swarm.Node) (readyNodes int, cpuCap, memCap int64) {
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
	return
}

// countRunningTasks counts the number of running tasks
func countRunningTasks(tasks []swarm.Task) int {
	count := 0
	for _, t := range tasks {
		if t.Status.State == swarm.TaskStateRunning {
			count++
		}
	}
	return count
}

// computeResourceUsage computes CPU and memory reservations/limits from services
func computeResourceUsage(services []swarm.Service, readyNodes int) (cpuRes, memRes, cpuLim, memLim int64) {
	for _, s := range services {
		mult := getServiceMultiplier(&s, readyNodes)
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
	return
}

// getServiceMultiplier returns the replica count for a service
func getServiceMultiplier(s *swarm.Service, readyNodes int) int64 {
	if s.Spec.Mode.Replicated != nil && s.Spec.Mode.Replicated.Replicas != nil {
		return safeInt64FromUint64(*s.Spec.Mode.Replicated.Replicas)
	}
	if s.Spec.Mode.Global != nil {
		return int64(readyNodes)
	}
	return 0
}

// buildServiceNameMap creates a map of service ID to name
func buildServiceNameMap(services []swarm.Service) map[string]string {
	m := make(map[string]string, len(services))
	for _, s := range services {
		m[s.ID] = s.Spec.Name
	}
	return m
}

// buildNodeNameMap creates a map of node ID to hostname
func buildNodeNameMap(nodes []swarm.Node) map[string]string {
	m := make(map[string]string, len(nodes))
	for _, n := range nodes {
		m[n.ID] = n.Description.Hostname
	}
	return m
}

// containerStatsResult holds aggregated container stats
type containerStatsResult struct {
	cpuP     float64
	memUsed  int64
	memLimit int64
	rx       int64
	tx       int64
}

// collectContainerStats collects stats from all running containers
func collectContainerStats(ctx context.Context, cli *client.Client, tasks []swarm.Task, serviceNames, nodeNames map[string]string, now string) (SwarmMetricsBreakdown, int, float64, int64, int64, int64) {
	servicesAgg := map[string]*SwarmServiceMetrics{}
	nodesAgg := map[string]*SwarmNodeMetrics{}

	var sumCPUPercent float64
	var sumMemUsed int64
	var sumNetRx int64
	var sumNetTx int64
	containers := 0

	for _, t := range tasks {
		if t.Status.State != swarm.TaskStateRunning {
			continue
		}
		if t.Status.ContainerStatus == nil || t.Status.ContainerStatus.ContainerID == "" {
			continue
		}

		stats := getContainerStats(ctx, cli, t.Status.ContainerStatus.ContainerID)
		if stats == nil {
			continue
		}

		containers++
		sumCPUPercent += stats.cpuP
		sumMemUsed += stats.memUsed
		sumNetRx += stats.rx
		sumNetTx += stats.tx

		// Aggregate by service
		if t.ServiceID != "" {
			aggregateServiceMetrics(servicesAgg, t.ServiceID, serviceNames[t.ServiceID], now, stats)
		}

		// Aggregate by node
		if t.NodeID != "" {
			aggregateNodeMetrics(nodesAgg, t.NodeID, nodeNames[t.NodeID], now, stats)
		}
	}

	breakdown := SwarmMetricsBreakdown{Timestamp: now}
	breakdown.Services = make([]SwarmServiceMetrics, 0, len(servicesAgg))
	for _, v := range servicesAgg {
		breakdown.Services = append(breakdown.Services, *v)
	}
	breakdown.Nodes = make([]SwarmNodeMetrics, 0, len(nodesAgg))
	for _, v := range nodesAgg {
		breakdown.Nodes = append(breakdown.Nodes, *v)
	}

	return breakdown, containers, sumCPUPercent, sumMemUsed, sumNetRx, sumNetTx
}

// getContainerStats fetches stats for a single container
func getContainerStats(ctx context.Context, cli *client.Client, cid string) *containerStatsResult {
	statsResp, err := cli.ContainerStats(ctx, cid, false)
	if err != nil {
		return nil
	}
	var sj container.StatsResponse
	err = json.NewDecoder(statsResp.Body).Decode(&sj)
	_ = statsResp.Body.Close()
	if err != nil {
		return nil
	}

	cpuP := cpuPercent(&sj)
	memUsed, memLimit := memoryUsage(&sj)
	rx, tx := networkTotals(&sj)

	return &containerStatsResult{
		cpuP:     cpuP,
		memUsed:  memUsed,
		memLimit: memLimit,
		rx:       rx,
		tx:       tx,
	}
}

// aggregateServiceMetrics adds container stats to service aggregation
func aggregateServiceMetrics(agg map[string]*SwarmServiceMetrics, sid, name, now string, stats *containerStatsResult) {
	m := agg[sid]
	if m == nil {
		m = &SwarmServiceMetrics{Timestamp: now, ServiceID: sid, ServiceName: name}
		agg[sid] = m
	}
	m.RunningTasks++
	m.Containers++
	m.CpuPercent += stats.cpuP
	m.MemoryUsedBytes += stats.memUsed
	m.MemoryLimitBytes += stats.memLimit
	m.NetworkRxBytes += stats.rx
	m.NetworkTxBytes += stats.tx
}

// aggregateNodeMetrics adds container stats to node aggregation
func aggregateNodeMetrics(agg map[string]*SwarmNodeMetrics, nid, hostname, now string, stats *containerStatsResult) {
	m := agg[nid]
	if m == nil {
		m = &SwarmNodeMetrics{Timestamp: now, NodeID: nid, Hostname: hostname}
		agg[nid] = m
	}
	m.RunningTasks++
	m.Containers++
	m.CpuPercent += stats.cpuP
	m.MemoryUsedBytes += stats.memUsed
	m.NetworkRxBytes += stats.rx
	m.NetworkTxBytes += stats.tx
}

func cpuPercent(s *container.StatsResponse) float64 {
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

func memoryUsage(s *container.StatsResponse) (used int64, limit int64) {
	if s == nil {
		return 0, 0
	}
	usage := safeInt64FromUint64(s.MemoryStats.Usage)
	limit = safeInt64FromUint64(s.MemoryStats.Limit)
	cache := int64(0)
	if s.MemoryStats.Stats != nil {
		if v, ok := s.MemoryStats.Stats["cache"]; ok {
			cache = safeInt64FromUint64(v)
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

func networkTotals(s *container.StatsResponse) (rx int64, tx int64) {
	if s == nil {
		return 0, 0
	}
	if s.Networks == nil {
		return 0, 0
	}
	for _, v := range s.Networks {
		rx += safeInt64FromUint64(v.RxBytes)
		tx += safeInt64FromUint64(v.TxBytes)
	}
	return rx, tx
}

func cpuUsagePercentOfCapacity(sumCPUPercent float64, cpuCapNano int64) float64 {
	if sumCPUPercent <= 0 {
		return 0
	}
	capCores := float64(cpuCapNano) / 1e9
	if capCores <= 0 {
		return 0
	}
	// sumCpuPercent is already in the "can exceed 100" space; divide by core-count to normalize.
	return sumCPUPercent / capCores
}
