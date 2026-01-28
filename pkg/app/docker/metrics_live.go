package docker

import (
	"context"
	"encoding/json"
	"time"

	"gowails/pkg/app/internal/safeconv"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

func CollectSwarmMetricsWithBreakdown(ctx context.Context, cli *client.Client) (SwarmMetricsPoint, SwarmMetricsBreakdown, error) {
	return collectSwarmMetricsWithBreakdown(ctx, cli)
}

type swarmLists struct {
	services []swarm.Service
	tasks    []swarm.Task
	nodes    []swarm.Node
}

type swarmStatsTotals struct {
	containers     int
	sumCpuPercent  float64
	sumMemUsed     int64
	sumNetRx       int64
	sumNetTx       int64
	serviceMetrics map[string]*SwarmServiceMetrics
	nodeMetrics    map[string]*SwarmNodeMetrics
}

func listSwarmEntities(ctx context.Context, cli *client.Client) (swarmLists, error) {
	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return swarmLists{}, err
	}
	tasks, err := cli.TaskList(ctx, types.TaskListOptions{})
	if err != nil {
		return swarmLists{}, err
	}
	nodes, err := cli.NodeList(ctx, types.NodeListOptions{})
	if err != nil {
		return swarmLists{}, err
	}
	return swarmLists{services: services, tasks: tasks, nodes: nodes}, nil
}

func swarmCapacity(nodes []swarm.Node) (ready int, cpuCap int64, memCap int64) {
	for _, n := range nodes {
		if n.Status.State != swarm.NodeStateReady {
			continue
		}
		ready++
		if n.Description.Resources.NanoCPUs > 0 {
			cpuCap += n.Description.Resources.NanoCPUs
		}
		if n.Description.Resources.MemoryBytes > 0 {
			memCap += n.Description.Resources.MemoryBytes
		}
	}
	return ready, cpuCap, memCap
}

func runningTasksCount(tasks []swarm.Task) int {
	count := 0
	for _, t := range tasks {
		if t.Status.State == swarm.TaskStateRunning {
			count++
		}
	}
	return count
}

func swarmReservations(services []swarm.Service, readyNodes int) (cpuRes int64, memRes int64, cpuLim int64, memLim int64) {
	for _, s := range services {
		mult := int64(0)
		if s.Spec.Mode.Replicated != nil {
			if s.Spec.Mode.Replicated.Replicas != nil {
				rep, err := safeconv.Uint64ToInt64(*s.Spec.Mode.Replicated.Replicas)
				if err != nil {
					continue
				}
				mult = rep
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

func buildNameMaps(services []swarm.Service, nodes []swarm.Node) (map[string]string, map[string]string) {
	serviceNames := make(map[string]string, len(services))
	for _, s := range services {
		serviceNames[s.ID] = s.Spec.Name
	}
	nodeNames := make(map[string]string, len(nodes))
	for _, n := range nodes {
		nodeNames[n.ID] = n.Description.Hostname
	}
	return serviceNames, nodeNames
}

func aggregateSwarmStats(ctx context.Context, cli *client.Client, tasks []swarm.Task, serviceNames map[string]string, nodeNames map[string]string, timestamp string) swarmStatsTotals {
	totals := swarmStatsTotals{
		serviceMetrics: map[string]*SwarmServiceMetrics{},
		nodeMetrics:    map[string]*SwarmNodeMetrics{},
	}

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
		var sj types.StatsJSON
		err = json.NewDecoder(statsResp.Body).Decode(&sj)
		_ = statsResp.Body.Close()
		if err != nil {
			continue
		}

		cpuP := cpuPercent(&sj)
		memUsed, memLimit := memoryUsage(&sj)
		rx, tx := networkTotals(&sj)

		totals.containers++
		totals.sumCpuPercent += cpuP
		totals.sumMemUsed += memUsed
		totals.sumNetRx += rx
		totals.sumNetTx += tx

		sid := t.ServiceID
		if sid != "" {
			agg := totals.serviceMetrics[sid]
			if agg == nil {
				agg = &SwarmServiceMetrics{Timestamp: timestamp, ServiceID: sid, ServiceName: serviceNames[sid]}
				totals.serviceMetrics[sid] = agg
			}
			agg.RunningTasks++
			agg.Containers++
			agg.CpuPercent += cpuP
			agg.MemoryUsedBytes += memUsed
			agg.MemoryLimitBytes += memLimit
			agg.NetworkRxBytes += rx
			agg.NetworkTxBytes += tx
		}

		nid := t.NodeID
		if nid != "" {
			agg := totals.nodeMetrics[nid]
			if agg == nil {
				agg = &SwarmNodeMetrics{Timestamp: timestamp, NodeID: nid, Hostname: nodeNames[nid]}
				totals.nodeMetrics[nid] = agg
			}
			agg.RunningTasks++
			agg.Containers++
			agg.CpuPercent += cpuP
			agg.MemoryUsedBytes += memUsed
			agg.NetworkRxBytes += rx
			agg.NetworkTxBytes += tx
		}
	}

	return totals
}

func collectSwarmMetricsWithBreakdown(ctx context.Context, cli *client.Client) (SwarmMetricsPoint, SwarmMetricsBreakdown, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	lists, err := listSwarmEntities(ctx, cli)
	if err != nil {
		return SwarmMetricsPoint{}, SwarmMetricsBreakdown{}, err
	}

	// Base point (counts + capacity/reservations/limits) and store append.
	// We re-use the same logic as collectSwarmMetrics, but avoid re-listing by inlining.
	readyNodes, cpuCap, memCap := swarmCapacity(lists.nodes)
	runningTasks := runningTasksCount(lists.tasks)
	cpuRes, memRes, cpuLim, memLim := swarmReservations(lists.services, readyNodes)

	now := time.Now().UTC().Format(time.RFC3339)
	point := SwarmMetricsPoint{
		Timestamp:               now,
		Services:                len(lists.services),
		Tasks:                   len(lists.tasks),
		RunningTasks:            runningTasks,
		Nodes:                   len(lists.nodes),
		ReadyNodes:              readyNodes,
		CpuCapacityNano:         cpuCap,
		MemoryCapacityBytes:     memCap,
		CpuReservationsNano:     cpuRes,
		MemoryReservationsBytes: memRes,
		CpuLimitsNano:           cpuLim,
		MemoryLimitsBytes:       memLim,
	}

	serviceNames, nodeNames := buildNameMaps(lists.services, lists.nodes)
	totals := aggregateSwarmStats(ctx, cli, lists.tasks, serviceNames, nodeNames, now)

	point.RunningContainers = totals.containers
	point.MemoryUsedBytes = totals.sumMemUsed
	point.NetworkRxBytes = totals.sumNetRx
	point.NetworkTxBytes = totals.sumNetTx
	point.CpuUsagePercent = cpuUsagePercentOfCapacity(totals.sumCpuPercent, cpuCap)

	appendSwarmMetricsPoint(point)

	breakdown := SwarmMetricsBreakdown{Timestamp: now}
	breakdown.Services = make([]SwarmServiceMetrics, 0, len(totals.serviceMetrics))
	for _, v := range totals.serviceMetrics {
		breakdown.Services = append(breakdown.Services, *v)
	}
	breakdown.Nodes = make([]SwarmNodeMetrics, 0, len(totals.nodeMetrics))
	for _, v := range totals.nodeMetrics {
		breakdown.Nodes = append(breakdown.Nodes, *v)
	}

	return point, breakdown, nil
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
	usage, err := safeconv.Uint64ToInt64(s.MemoryStats.Usage)
	if err != nil {
		return 0, 0
	}
	limit, err = safeconv.Uint64ToInt64(s.MemoryStats.Limit)
	if err != nil {
		return 0, 0
	}
	cache := int64(0)
	if s.MemoryStats.Stats != nil {
		if v, ok := s.MemoryStats.Stats["cache"]; ok {
			cache, err = safeconv.Uint64ToInt64(v)
			if err != nil {
				cache = 0
			}
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
		rxBytes, err := safeconv.Uint64ToInt64(v.RxBytes)
		if err == nil {
			rx += rxBytes
		}
		txBytes, err := safeconv.Uint64ToInt64(v.TxBytes)
		if err == nil {
			tx += txBytes
		}
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
