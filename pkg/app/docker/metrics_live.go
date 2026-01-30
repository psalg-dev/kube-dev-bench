package docker

import (
	"context"
	"encoding/json"
	"time"

	"github.com/docker/docker/api/types"
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

	// Base point (counts + capacity/reservations/limits) and store append.
	// We re-use the same logic as collectSwarmMetrics, but avoid re-listing by inlining.
	readyNodes := 0
	var cpuCap int64
	var memCap int64
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

	runningTasks := 0
	for _, t := range tasks {
		if t.Status.State == swarm.TaskStateRunning {
			runningTasks++
		}
	}

	var cpuRes int64
	var memRes int64
	var cpuLim int64
	var memLim int64
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

	// Build name maps.
	serviceNames := make(map[string]string, len(services))
	for _, s := range services {
		serviceNames[s.ID] = s.Spec.Name
	}
	nodeNames := make(map[string]string, len(nodes))
	for _, n := range nodes {
		nodeNames[n.ID] = n.Description.Hostname
	}

	// Collect container stats for running tasks that have a container id.
	// This is best-effort; individual stat failures are skipped.
	type svcAgg struct {
		m SwarmServiceMetrics
	}
	type nodeAgg struct {
		m SwarmNodeMetrics
	}

	servicesAgg := map[string]*svcAgg{}
	nodesAgg := map[string]*nodeAgg{}

	var sumCpuPercent float64
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

		cid := t.Status.ContainerStatus.ContainerID
		statsResp, err := cli.ContainerStats(ctx, cid, false)
		if err != nil {
			continue
		}
		var sj container.StatsResponse
		err = json.NewDecoder(statsResp.Body).Decode(&sj)
		_ = statsResp.Body.Close()
		if err != nil {
			continue
		}

		cpuP := cpuPercent(&sj)
		memUsed, memLimit := memoryUsage(&sj)
		rx, tx := networkTotals(&sj)

		containers++
		sumCpuPercent += cpuP
		sumMemUsed += memUsed
		sumNetRx += rx
		sumNetTx += tx

		// Service aggregation.
		sid := t.ServiceID
		if sid != "" {
			agg := servicesAgg[sid]
			if agg == nil {
				agg = &svcAgg{m: SwarmServiceMetrics{Timestamp: now, ServiceID: sid, ServiceName: serviceNames[sid]}}
				servicesAgg[sid] = agg
			}
			agg.m.RunningTasks++
			agg.m.Containers++
			agg.m.CpuPercent += cpuP
			agg.m.MemoryUsedBytes += memUsed
			agg.m.MemoryLimitBytes += memLimit
			agg.m.NetworkRxBytes += rx
			agg.m.NetworkTxBytes += tx
		}

		// Node aggregation.
		nid := t.NodeID
		if nid != "" {
			agg := nodesAgg[nid]
			if agg == nil {
				agg = &nodeAgg{m: SwarmNodeMetrics{Timestamp: now, NodeID: nid, Hostname: nodeNames[nid]}}
				nodesAgg[nid] = agg
			}
			agg.m.RunningTasks++
			agg.m.Containers++
			agg.m.CpuPercent += cpuP
			agg.m.MemoryUsedBytes += memUsed
			agg.m.NetworkRxBytes += rx
			agg.m.NetworkTxBytes += tx
		}
	}

	point.RunningContainers = containers
	point.MemoryUsedBytes = sumMemUsed
	point.NetworkRxBytes = sumNetRx
	point.NetworkTxBytes = sumNetTx
	point.CpuUsagePercent = cpuUsagePercentOfCapacity(sumCpuPercent, cpuCap)

	appendSwarmMetricsPoint(point)

	breakdown := SwarmMetricsBreakdown{Timestamp: now}
	breakdown.Services = make([]SwarmServiceMetrics, 0, len(servicesAgg))
	for _, v := range servicesAgg {
		breakdown.Services = append(breakdown.Services, v.m)
	}
	breakdown.Nodes = make([]SwarmNodeMetrics, 0, len(nodesAgg))
	for _, v := range nodesAgg {
		breakdown.Nodes = append(breakdown.Nodes, v.m)
	}

	return point, breakdown, nil
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

func networkTotals(s *container.StatsResponse) (rx int64, tx int64) {
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
