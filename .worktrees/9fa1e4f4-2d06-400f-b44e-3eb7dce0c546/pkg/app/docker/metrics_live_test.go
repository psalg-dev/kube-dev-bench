package docker

import (
	"math"
	"testing"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/swarm"
)

func TestMetrics_CPUPercent(t *testing.T) {
	s := &container.StatsResponse{}
	s.PreCPUStats.CPUUsage.TotalUsage = 1_000_000_000
	s.CPUStats.CPUUsage.TotalUsage = 2_000_000_000
	s.PreCPUStats.SystemUsage = 10_000_000_000
	s.CPUStats.SystemUsage = 20_000_000_000
	s.CPUStats.OnlineCPUs = 2

	got := cpuPercent(s)
	want := 20.0
	if math.Abs(got-want) > 0.0001 {
		t.Fatalf("expected cpuPercent %.4f, got %.4f", want, got)
	}
}

func TestMetrics_MemoryUsage_SubtractsCache(t *testing.T) {
	s := &container.StatsResponse{}
	s.MemoryStats.Usage = 1000
	s.MemoryStats.Limit = 2000
	s.MemoryStats.Stats = map[string]uint64{"cache": 200}

	used, limit := memoryUsage(s)
	if used != 800 {
		t.Fatalf("expected used=800, got %d", used)
	}
	if limit != 2000 {
		t.Fatalf("expected limit=2000, got %d", limit)
	}
}

func TestMetrics_NetworkTotals_SumsInterfaces(t *testing.T) {
	s := &container.StatsResponse{}
	s.Networks = map[string]container.NetworkStats{
		"eth0": {RxBytes: 10, TxBytes: 7},
		"eth1": {RxBytes: 3, TxBytes: 5},
	}

	rx, tx := networkTotals(s)
	if rx != 13 {
		t.Fatalf("expected rx=13, got %d", rx)
	}
	if tx != 12 {
		t.Fatalf("expected tx=12, got %d", tx)
	}
}

func TestMetrics_CPUUsagePercentOfCapacity_Normalizes(t *testing.T) {
	got := cpuUsagePercentOfCapacity(200, 2_000_000_000) // 200% total on 2 cores => 100% of capacity
	want := 100.0
	if math.Abs(got-want) > 0.0001 {
		t.Fatalf("expected %.4f, got %.4f", want, got)
	}
}

func TestMetrics_ComputeNodeCapacity_ReadyNodesOnly(t *testing.T) {
	nodes := []swarm.Node{
		{
			ID:     "n1",
			Status: swarm.NodeStatus{State: swarm.NodeStateReady},
			Description: swarm.NodeDescription{
				Resources: swarm.Resources{NanoCPUs: 2_000_000_000, MemoryBytes: 4_096},
			},
		},
		{
			ID:     "n2",
			Status: swarm.NodeStatus{State: swarm.NodeStateDown},
			Description: swarm.NodeDescription{
				Resources: swarm.Resources{NanoCPUs: 4_000_000_000, MemoryBytes: 8_192},
			},
		},
		{
			ID:     "n3",
			Status: swarm.NodeStatus{State: swarm.NodeStateReady},
			Description: swarm.NodeDescription{
				Resources: swarm.Resources{NanoCPUs: 1_000_000_000, MemoryBytes: 2_048},
			},
		},
	}

	ready, cpuCap, memCap := computeNodeCapacity(nodes)
	if ready != 2 {
		t.Fatalf("expected 2 ready nodes, got %d", ready)
	}
	if cpuCap != 3_000_000_000 {
		t.Fatalf("expected cpu capacity 3000000000, got %d", cpuCap)
	}
	if memCap != 6_144 {
		t.Fatalf("expected memory capacity 6144, got %d", memCap)
	}
}

func TestMetrics_CountRunningTasks(t *testing.T) {
	tasks := []swarm.Task{
		{Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
		{Status: swarm.TaskStatus{State: swarm.TaskStatePending}},
		{Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
	}

	if got := countRunningTasks(tasks); got != 2 {
		t.Fatalf("expected 2 running tasks, got %d", got)
	}
}

func TestMetrics_ComputeResourceUsage_MixedServiceModes(t *testing.T) {
	replicas := uint64(3)
	services := []swarm.Service{
		{
			Spec: swarm.ServiceSpec{
				Mode: swarm.ServiceMode{Replicated: &swarm.ReplicatedService{Replicas: &replicas}},
				TaskTemplate: swarm.TaskSpec{Resources: &swarm.ResourceRequirements{
					Reservations: &swarm.Resources{NanoCPUs: 100, MemoryBytes: 200},
					Limits:       &swarm.Limit{NanoCPUs: 300, MemoryBytes: 400},
				}},
			},
		},
		{
			Spec: swarm.ServiceSpec{
				Mode: swarm.ServiceMode{Global: &swarm.GlobalService{}},
				TaskTemplate: swarm.TaskSpec{Resources: &swarm.ResourceRequirements{
					Reservations: &swarm.Resources{NanoCPUs: 10, MemoryBytes: 20},
					Limits:       &swarm.Limit{NanoCPUs: 30, MemoryBytes: 40},
				}},
			},
		},
		{
			Spec: swarm.ServiceSpec{
				Mode:         swarm.ServiceMode{},
				TaskTemplate: swarm.TaskSpec{},
			},
		},
	}

	cpuRes, memRes, cpuLim, memLim := computeResourceUsage(services, 2)
	if cpuRes != 320 || memRes != 640 || cpuLim != 960 || memLim != 1_280 {
		t.Fatalf("unexpected usage totals: cpuRes=%d memRes=%d cpuLim=%d memLim=%d", cpuRes, memRes, cpuLim, memLim)
	}
}

func TestMetrics_GetServiceMultiplier(t *testing.T) {
	replicas := uint64(5)
	rep := &swarm.Service{Spec: swarm.ServiceSpec{Mode: swarm.ServiceMode{Replicated: &swarm.ReplicatedService{Replicas: &replicas}}}}
	if got := getServiceMultiplier(rep, 3); got != 5 {
		t.Fatalf("expected replicated multiplier 5, got %d", got)
	}

	glob := &swarm.Service{Spec: swarm.ServiceSpec{Mode: swarm.ServiceMode{Global: &swarm.GlobalService{}}}}
	if got := getServiceMultiplier(glob, 3); got != 3 {
		t.Fatalf("expected global multiplier 3, got %d", got)
	}

	none := &swarm.Service{}
	if got := getServiceMultiplier(none, 3); got != 0 {
		t.Fatalf("expected default multiplier 0, got %d", got)
	}
}

func TestMetrics_BuildNameMapsAndAggregations(t *testing.T) {
	serviceMap := buildServiceNameMap([]swarm.Service{{ID: "s1", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "web"}}}})
	if serviceMap["s1"] != "web" {
		t.Fatalf("unexpected service map: %#v", serviceMap)
	}

	nodeMap := buildNodeNameMap([]swarm.Node{{ID: "n1", Description: swarm.NodeDescription{Hostname: "node-a"}}})
	if nodeMap["n1"] != "node-a" {
		t.Fatalf("unexpected node map: %#v", nodeMap)
	}

	stats := &containerStatsResult{cpuP: 12.5, memUsed: 128, memLimit: 256, rx: 10, tx: 20}
	servicesAgg := map[string]*SwarmServiceMetrics{}
	nodesAgg := map[string]*SwarmNodeMetrics{}

	aggregateServiceMetrics(servicesAgg, "s1", "web", "2026-02-14T00:00:00Z", stats)
	aggregateServiceMetrics(servicesAgg, "s1", "web", "2026-02-14T00:00:00Z", stats)
	if servicesAgg["s1"].RunningTasks != 2 || servicesAgg["s1"].Containers != 2 || servicesAgg["s1"].MemoryUsedBytes != 256 {
		t.Fatalf("unexpected service aggregation: %+v", servicesAgg["s1"])
	}

	aggregateNodeMetrics(nodesAgg, "n1", "node-a", "2026-02-14T00:00:00Z", stats)
	aggregateNodeMetrics(nodesAgg, "n1", "node-a", "2026-02-14T00:00:00Z", stats)
	if nodesAgg["n1"].RunningTasks != 2 || nodesAgg["n1"].Containers != 2 || nodesAgg["n1"].NetworkTxBytes != 40 {
		t.Fatalf("unexpected node aggregation: %+v", nodesAgg["n1"])
	}
}

func TestMetrics_NilInputGuards(t *testing.T) {
	if got := cpuPercent(nil); got != 0 {
		t.Fatalf("expected cpuPercent(nil)=0, got %f", got)
	}
	if used, limit := memoryUsage(nil); used != 0 || limit != 0 {
		t.Fatalf("expected memoryUsage(nil)=(0,0), got (%d,%d)", used, limit)
	}
	if rx, tx := networkTotals(nil); rx != 0 || tx != 0 {
		t.Fatalf("expected networkTotals(nil)=(0,0), got (%d,%d)", rx, tx)
	}
	if got := cpuUsagePercentOfCapacity(10, 0); got != 0 {
		t.Fatalf("expected cpuUsagePercentOfCapacity with zero capacity to be 0, got %f", got)
	}
}
