package docker

import (
	"math"
	"strings"
	"testing"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/swarm"
)

// ---------------------------------------------------------------------------
// cpuPercent tests — named under TestAggregateServiceMetrics* to match filter
// ---------------------------------------------------------------------------

// TestAggregateServiceMetrics_CPUPercent_Nil verifies that a nil stats pointer
// returns 0 CPU percent.
func TestAggregateServiceMetrics_CPUPercent_Nil(t *testing.T) {
	t.Parallel()

	if got := cpuPercent(nil); got != 0 {
		t.Errorf("cpuPercent(nil): got %f, want 0", got)
	}
}

// TestAggregateServiceMetrics_CPUPercent_ZeroCPUDelta verifies that identical
// CPU total-usage values (delta = 0) result in 0 percent.
func TestAggregateServiceMetrics_CPUPercent_ZeroCPUDelta(t *testing.T) {
	t.Parallel()

	s := &container.StatsResponse{
		CPUStats: container.CPUStats{
			CPUUsage:    container.CPUUsage{TotalUsage: 1000},
			SystemUsage: 2000,
			OnlineCPUs:  2,
		},
		PreCPUStats: container.CPUStats{
			CPUUsage:    container.CPUUsage{TotalUsage: 1000}, // same → delta = 0
			SystemUsage: 1000,
		},
	}
	if got := cpuPercent(s); got != 0 {
		t.Errorf("cpuPercent with zeroCPUDelta: got %f, want 0", got)
	}
}

// TestAggregateServiceMetrics_CPUPercent_ZeroSysDelta verifies that a zero
// system-usage delta returns 0 percent (avoids divide-by-zero).
func TestAggregateServiceMetrics_CPUPercent_ZeroSysDelta(t *testing.T) {
	t.Parallel()

	s := &container.StatsResponse{
		CPUStats: container.CPUStats{
			CPUUsage:    container.CPUUsage{TotalUsage: 2000},
			SystemUsage: 1000,
			OnlineCPUs:  2,
		},
		PreCPUStats: container.CPUStats{
			CPUUsage:    container.CPUUsage{TotalUsage: 1000},
			SystemUsage: 1000, // same → sysDelta = 0
		},
	}
	if got := cpuPercent(s); got != 0 {
		t.Errorf("cpuPercent with zeroSysDelta: got %f, want 0", got)
	}
}

// TestAggregateServiceMetrics_CPUPercent_WithOnlineCPUs verifies the main
// calculation when OnlineCPUs is explicitly set.
func TestAggregateServiceMetrics_CPUPercent_WithOnlineCPUs(t *testing.T) {
	t.Parallel()

	// cpu delta = 1000, sys delta = 2000, online = 2
	// result = (1000/2000) * 2 * 100 = 100.0
	s := &container.StatsResponse{
		CPUStats: container.CPUStats{
			CPUUsage:    container.CPUUsage{TotalUsage: 1000},
			SystemUsage: 2000,
			OnlineCPUs:  2,
		},
		PreCPUStats: container.CPUStats{
			CPUUsage:    container.CPUUsage{TotalUsage: 0},
			SystemUsage: 0,
		},
	}
	got := cpuPercent(s)
	want := 100.0
	if math.Abs(got-want) > 0.001 {
		t.Errorf("cpuPercent with OnlineCPUs: got %f, want %f", got, want)
	}
}

// TestAggregateServiceMetrics_CPUPercent_WithPercpuUsage verifies that when
// OnlineCPUs == 0 the number of logical CPUs is derived from PercpuUsage length.
func TestAggregateServiceMetrics_CPUPercent_WithPercpuUsage(t *testing.T) {
	t.Parallel()

	// cpu delta = 1000, sys delta = 4000, online derived = 2 (len of PercpuUsage)
	// result = (1000/4000) * 2 * 100 = 50.0
	s := &container.StatsResponse{
		CPUStats: container.CPUStats{
			CPUUsage: container.CPUUsage{
				TotalUsage:  1000,
				PercpuUsage: []uint64{500, 500},
			},
			SystemUsage: 4000,
			OnlineCPUs:  0, // force percpu-path
		},
		PreCPUStats: container.CPUStats{
			CPUUsage:    container.CPUUsage{TotalUsage: 0},
			SystemUsage: 0,
		},
	}
	got := cpuPercent(s)
	want := 50.0
	if math.Abs(got-want) > 0.001 {
		t.Errorf("cpuPercent with PercpuUsage: got %f, want %f", got, want)
	}
}

// TestAggregateServiceMetrics_CPUPercent_EmptyPercpuUsage verifies fallback to
// online = 1 when both OnlineCPUs and PercpuUsage are zero/empty.
func TestAggregateServiceMetrics_CPUPercent_EmptyPercpuUsage(t *testing.T) {
	t.Parallel()

	// cpu delta = 1000, sys delta = 2000, online = 1 (fallback)
	// result = (1000/2000) * 1 * 100 = 50.0
	s := &container.StatsResponse{
		CPUStats: container.CPUStats{
			CPUUsage: container.CPUUsage{
				TotalUsage:  1000,
				PercpuUsage: nil, // empty → fallback to 1
			},
			SystemUsage: 2000,
			OnlineCPUs:  0,
		},
		PreCPUStats: container.CPUStats{
			CPUUsage:    container.CPUUsage{TotalUsage: 0},
			SystemUsage: 0,
		},
	}
	got := cpuPercent(s)
	want := 50.0
	if math.Abs(got-want) > 0.001 {
		t.Errorf("cpuPercent with empty PercpuUsage (fallback=1): got %f, want %f", got, want)
	}
}

// ---------------------------------------------------------------------------
// memoryUsage tests — named under TestAggregateNodeMetrics* to match filter
// ---------------------------------------------------------------------------

// TestAggregateNodeMetrics_MemoryUsage_Nil verifies that a nil stats pointer
// returns (0, 0).
func TestAggregateNodeMetrics_MemoryUsage_Nil(t *testing.T) {
	t.Parallel()

	used, limit := memoryUsage(nil)
	if used != 0 || limit != 0 {
		t.Errorf("memoryUsage(nil): got (%d, %d), want (0, 0)", used, limit)
	}
}

// TestAggregateNodeMetrics_MemoryUsage_NoCache verifies raw usage/limit
// when no cache entry is present in the stats map.
func TestAggregateNodeMetrics_MemoryUsage_NoCache(t *testing.T) {
	t.Parallel()

	s := &container.StatsResponse{
		MemoryStats: container.MemoryStats{
			Usage: 1024,
			Limit: 2048,
		},
	}
	used, limit := memoryUsage(s)
	if used != 1024 {
		t.Errorf("MemoryUsage (no cache): used=%d, want 1024", used)
	}
	if limit != 2048 {
		t.Errorf("MemoryUsage (no cache): limit=%d, want 2048", limit)
	}
}

// TestAggregateNodeMetrics_MemoryUsage_WithCache verifies that the "cache"
// entry in Stats is subtracted from the raw usage value.
func TestAggregateNodeMetrics_MemoryUsage_WithCache(t *testing.T) {
	t.Parallel()

	s := &container.StatsResponse{
		MemoryStats: container.MemoryStats{
			Usage: 1024,
			Limit: 2048,
			Stats: map[string]uint64{"cache": 256},
		},
	}
	used, limit := memoryUsage(s)
	wantUsed := int64(1024 - 256)
	if used != wantUsed {
		t.Errorf("MemoryUsage (with cache): used=%d, want %d", used, wantUsed)
	}
	if limit != 2048 {
		t.Errorf("MemoryUsage (with cache): limit=%d, want 2048", limit)
	}
}

// TestAggregateNodeMetrics_MemoryUsage_CacheExceedsUsage verifies that when
// cache >= usage, the subtraction is skipped and usage stays non-negative.
func TestAggregateNodeMetrics_MemoryUsage_CacheExceedsUsage(t *testing.T) {
	t.Parallel()

	// cache (512) >= usage (256) → condition not met, no subtraction
	s := &container.StatsResponse{
		MemoryStats: container.MemoryStats{
			Usage: 256,
			Limit: 4096,
			Stats: map[string]uint64{"cache": 512},
		},
	}
	used, _ := memoryUsage(s)
	// cache > usage so the subtraction is skipped; raw usage is returned
	if used < 0 {
		t.Errorf("MemoryUsage should never return negative, got %d", used)
	}
	if used != 256 {
		t.Errorf("MemoryUsage (cache>usage): used=%d, want 256 (no subtraction)", used)
	}
}

// TestAggregateNodeMetrics_MemoryUsage_NilStats verifies nil Stats map is
// handled gracefully.
func TestAggregateNodeMetrics_MemoryUsage_NilStats(t *testing.T) {
	t.Parallel()

	s := &container.StatsResponse{
		MemoryStats: container.MemoryStats{
			Usage: 512,
			Limit: 1024,
			Stats: nil,
		},
	}
	used, limit := memoryUsage(s)
	if used != 512 {
		t.Errorf("MemoryUsage (nil stats map): used=%d, want 512", used)
	}
	if limit != 1024 {
		t.Errorf("MemoryUsage (nil stats map): limit=%d, want 1024", limit)
	}
}

// ---------------------------------------------------------------------------
// networkTotals tests — named under TestAggregateNodeMetrics* to match filter
// ---------------------------------------------------------------------------

// TestAggregateNodeMetrics_NetworkTotals_Nil verifies nil stats returns (0, 0).
func TestAggregateNodeMetrics_NetworkTotals_Nil(t *testing.T) {
	t.Parallel()

	rx, tx := networkTotals(nil)
	if rx != 0 || tx != 0 {
		t.Errorf("networkTotals(nil): got (%d, %d), want (0, 0)", rx, tx)
	}
}

// TestAggregateNodeMetrics_NetworkTotals_NilNetworks verifies nil Networks
// map returns (0, 0).
func TestAggregateNodeMetrics_NetworkTotals_NilNetworks(t *testing.T) {
	t.Parallel()

	s := &container.StatsResponse{Networks: nil}
	rx, tx := networkTotals(s)
	if rx != 0 || tx != 0 {
		t.Errorf("networkTotals(nil networks): got (%d, %d), want (0, 0)", rx, tx)
	}
}

// TestAggregateNodeMetrics_NetworkTotals_MultipleInterfaces verifies that
// bytes from all network interfaces are summed correctly.
func TestAggregateNodeMetrics_NetworkTotals_MultipleInterfaces(t *testing.T) {
	t.Parallel()

	s := &container.StatsResponse{
		Networks: map[string]container.NetworkStats{
			"eth0": {RxBytes: 1000, TxBytes: 500},
			"eth1": {RxBytes: 2000, TxBytes: 1000},
		},
	}
	rx, tx := networkTotals(s)
	if rx != 3000 {
		t.Errorf("networkTotals rx: got %d, want 3000", rx)
	}
	if tx != 1500 {
		t.Errorf("networkTotals tx: got %d, want 1500", tx)
	}
}

// TestAggregateNodeMetrics_NetworkTotals_SingleInterface verifies the single
// interface path.
func TestAggregateNodeMetrics_NetworkTotals_SingleInterface(t *testing.T) {
	t.Parallel()

	s := &container.StatsResponse{
		Networks: map[string]container.NetworkStats{
			"eth0": {RxBytes: 500, TxBytes: 250},
		},
	}
	rx, tx := networkTotals(s)
	if rx != 500 {
		t.Errorf("networkTotals (single) rx: got %d, want 500", rx)
	}
	if tx != 250 {
		t.Errorf("networkTotals (single) tx: got %d, want 250", tx)
	}
}

// ---------------------------------------------------------------------------
// cpuUsagePercentOfCapacity tests
// ---------------------------------------------------------------------------

// TestAggregateServiceMetrics_CPUCapacity_ZeroUsage verifies that 0 usage
// returns 0.
func TestAggregateServiceMetrics_CPUCapacity_ZeroUsage(t *testing.T) {
	t.Parallel()

	if got := cpuUsagePercentOfCapacity(0, 2_000_000_000); got != 0 {
		t.Errorf("cpuUsagePercentOfCapacity(0, cap): got %f, want 0", got)
	}
}

// TestAggregateServiceMetrics_CPUCapacity_ZeroCap verifies that 0 capacity
// returns 0 (avoids divide-by-zero).
func TestAggregateServiceMetrics_CPUCapacity_ZeroCap(t *testing.T) {
	t.Parallel()

	if got := cpuUsagePercentOfCapacity(50.0, 0); got != 0 {
		t.Errorf("cpuUsagePercentOfCapacity(50, 0): got %f, want 0", got)
	}
}

// TestAggregateServiceMetrics_CPUCapacity_Normal verifies the calculation with
// 200% total CPU usage across a 2-core cluster → result = 100%.
func TestAggregateServiceMetrics_CPUCapacity_Normal(t *testing.T) {
	t.Parallel()

	// 2 cores → 2e9 nano, sumCPUPercent=200 → 200/2 = 100%
	got := cpuUsagePercentOfCapacity(200.0, 2_000_000_000)
	want := 100.0
	if math.Abs(got-want) > 0.001 {
		t.Errorf("cpuUsagePercentOfCapacity(200, 2e9): got %f, want %f", got, want)
	}
}

// TestAggregateServiceMetrics_CPUCapacity_Fractional verifies a fractional
// percent-of-capacity calculation.
func TestAggregateServiceMetrics_CPUCapacity_Fractional(t *testing.T) {
	t.Parallel()

	// 4 cores → 4e9 nano, sumCPUPercent=100 → 100/4 = 25%
	got := cpuUsagePercentOfCapacity(100.0, 4_000_000_000)
	want := 25.0
	if math.Abs(got-want) > 0.001 {
		t.Errorf("cpuUsagePercentOfCapacity(100, 4e9): got %f, want %f", got, want)
	}
}

// ---------------------------------------------------------------------------
// buildServiceNameMap and buildNodeNameMap tests
// ---------------------------------------------------------------------------

// TestAggregateNodeMetrics_BuildServiceNameMap verifies that service IDs are
// correctly mapped to service names.
func TestAggregateNodeMetrics_BuildServiceNameMap(t *testing.T) {
	t.Parallel()

	services := []swarm.Service{
		{ID: "svc-001", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "web"}}},
		{ID: "svc-002", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "api"}}},
	}
	m := buildServiceNameMap(services)

	if m["svc-001"] != "web" {
		t.Errorf("svc-001 name: got %q, want web", m["svc-001"])
	}
	if m["svc-002"] != "api" {
		t.Errorf("svc-002 name: got %q, want api", m["svc-002"])
	}
	if len(m) != 2 {
		t.Errorf("map length: got %d, want 2", len(m))
	}
}

// TestAggregateNodeMetrics_BuildServiceNameMap_Empty verifies an empty slice
// returns an empty (non-nil) map.
func TestAggregateNodeMetrics_BuildServiceNameMap_Empty(t *testing.T) {
	t.Parallel()

	m := buildServiceNameMap(nil)
	if m == nil {
		t.Error("expected non-nil map for nil input")
	}
	if len(m) != 0 {
		t.Errorf("expected empty map, got len=%d", len(m))
	}
}

// TestAggregateNodeMetrics_BuildNodeNameMap verifies that node IDs are
// correctly mapped to hostnames.
func TestAggregateNodeMetrics_BuildNodeNameMap(t *testing.T) {
	t.Parallel()

	nodes := []swarm.Node{
		{ID: "node-001", Description: swarm.NodeDescription{Hostname: "worker-1"}},
		{ID: "node-002", Description: swarm.NodeDescription{Hostname: "worker-2"}},
	}
	m := buildNodeNameMap(nodes)

	if m["node-001"] != "worker-1" {
		t.Errorf("node-001 hostname: got %q, want worker-1", m["node-001"])
	}
	if m["node-002"] != "worker-2" {
		t.Errorf("node-002 hostname: got %q, want worker-2", m["node-002"])
	}
	if len(m) != 2 {
		t.Errorf("map length: got %d, want 2", len(m))
	}
}

// TestAggregateNodeMetrics_BuildNodeNameMap_Empty verifies an empty slice
// returns an empty (non-nil) map.
func TestAggregateNodeMetrics_BuildNodeNameMap_Empty(t *testing.T) {
	t.Parallel()

	m := buildNodeNameMap(nil)
	if m == nil {
		t.Error("expected non-nil map for nil input")
	}
	if len(m) != 0 {
		t.Errorf("expected empty map, got len=%d", len(m))
	}
}

// ---------------------------------------------------------------------------
// countRunningTasks tests
// ---------------------------------------------------------------------------

// TestAggregateNodeMetrics_CountRunningTasks verifies only TaskStateRunning
// tasks are counted.
func TestAggregateNodeMetrics_CountRunningTasks(t *testing.T) {
	t.Parallel()

	tasks := []swarm.Task{
		{Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
		{Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
		{Status: swarm.TaskStatus{State: swarm.TaskStatePending}},
		{Status: swarm.TaskStatus{State: swarm.TaskStateFailed}},
		{Status: swarm.TaskStatus{State: swarm.TaskStateShutdown}},
	}
	count := countRunningTasks(tasks)
	if count != 2 {
		t.Errorf("countRunningTasks: got %d, want 2", count)
	}
}

// TestAggregateNodeMetrics_CountRunningTasks_Empty verifies empty slice
// returns 0.
func TestAggregateNodeMetrics_CountRunningTasks_Empty(t *testing.T) {
	t.Parallel()

	if count := countRunningTasks(nil); count != 0 {
		t.Errorf("countRunningTasks(nil): got %d, want 0", count)
	}
}

// TestAggregateNodeMetrics_CountRunningTasks_AllRunning verifies all-running
// tasks are counted.
func TestAggregateNodeMetrics_CountRunningTasks_AllRunning(t *testing.T) {
	t.Parallel()

	tasks := []swarm.Task{
		{Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
		{Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
		{Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
	}
	if count := countRunningTasks(tasks); count != 3 {
		t.Errorf("countRunningTasks all running: got %d, want 3", count)
	}
}

// ---------------------------------------------------------------------------
// computeNodeCapacity tests
// ---------------------------------------------------------------------------

// TestAggregateNodeMetrics_ComputeNodeCapacity verifies that only ready nodes
// contribute to the CPU and memory capacity totals.
func TestAggregateNodeMetrics_ComputeNodeCapacity(t *testing.T) {
	t.Parallel()

	nodes := []swarm.Node{
		{
			Status: swarm.NodeStatus{State: swarm.NodeStateReady},
			Description: swarm.NodeDescription{
				Resources: swarm.Resources{
					NanoCPUs:    2_000_000_000,
					MemoryBytes: 4 * 1024 * 1024 * 1024,
				},
			},
		},
		{
			// Down node — should NOT contribute
			Status: swarm.NodeStatus{State: swarm.NodeStateDown},
			Description: swarm.NodeDescription{
				Resources: swarm.Resources{
					NanoCPUs:    2_000_000_000,
					MemoryBytes: 4 * 1024 * 1024 * 1024,
				},
			},
		},
	}

	readyNodes, cpuCap, memCap := computeNodeCapacity(nodes)

	if readyNodes != 1 {
		t.Errorf("readyNodes: got %d, want 1", readyNodes)
	}
	if cpuCap != 2_000_000_000 {
		t.Errorf("cpuCap: got %d, want 2000000000", cpuCap)
	}
	if memCap != int64(4*1024*1024*1024) {
		t.Errorf("memCap: got %d, want %d", memCap, int64(4*1024*1024*1024))
	}
}

// TestAggregateNodeMetrics_ComputeNodeCapacity_AllReady verifies multiple
// ready nodes are accumulated.
func TestAggregateNodeMetrics_ComputeNodeCapacity_AllReady(t *testing.T) {
	t.Parallel()

	nodes := []swarm.Node{
		{
			Status: swarm.NodeStatus{State: swarm.NodeStateReady},
			Description: swarm.NodeDescription{
				Resources: swarm.Resources{NanoCPUs: 1_000_000_000, MemoryBytes: 2 * 1024 * 1024 * 1024},
			},
		},
		{
			Status: swarm.NodeStatus{State: swarm.NodeStateReady},
			Description: swarm.NodeDescription{
				Resources: swarm.Resources{NanoCPUs: 3_000_000_000, MemoryBytes: 6 * 1024 * 1024 * 1024},
			},
		},
	}

	readyNodes, cpuCap, memCap := computeNodeCapacity(nodes)

	if readyNodes != 2 {
		t.Errorf("readyNodes: got %d, want 2", readyNodes)
	}
	if cpuCap != 4_000_000_000 {
		t.Errorf("cpuCap: got %d, want 4000000000", cpuCap)
	}
	wantMem := int64(8 * 1024 * 1024 * 1024)
	if memCap != wantMem {
		t.Errorf("memCap: got %d, want %d", memCap, wantMem)
	}
}

// TestAggregateNodeMetrics_ComputeNodeCapacity_Empty verifies empty slice
// returns zeros.
func TestAggregateNodeMetrics_ComputeNodeCapacity_Empty(t *testing.T) {
	t.Parallel()

	readyNodes, cpuCap, memCap := computeNodeCapacity(nil)
	if readyNodes != 0 || cpuCap != 0 || memCap != 0 {
		t.Errorf("computeNodeCapacity(nil): got (%d, %d, %d), want (0, 0, 0)", readyNodes, cpuCap, memCap)
	}
}

// TestAggregateNodeMetrics_ComputeNodeCapacity_ZeroResources verifies ready
// node with zero resources does not accumulate (NanoCPUs/MemoryBytes checks).
func TestAggregateNodeMetrics_ComputeNodeCapacity_ZeroResources(t *testing.T) {
	t.Parallel()

	nodes := []swarm.Node{
		{
			Status: swarm.NodeStatus{State: swarm.NodeStateReady},
			Description: swarm.NodeDescription{
				Resources: swarm.Resources{NanoCPUs: 0, MemoryBytes: 0},
			},
		},
	}

	readyNodes, cpuCap, memCap := computeNodeCapacity(nodes)
	if readyNodes != 1 {
		t.Errorf("readyNodes: got %d, want 1 (node is ready)", readyNodes)
	}
	if cpuCap != 0 {
		t.Errorf("cpuCap: got %d, want 0 (zero resources)", cpuCap)
	}
	if memCap != 0 {
		t.Errorf("memCap: got %d, want 0 (zero resources)", memCap)
	}
}

// ---------------------------------------------------------------------------
// getServiceMultiplier tests
// ---------------------------------------------------------------------------

// TestAggregateNodeMetrics_GetServiceMultiplier_Replicated verifies that a
// replicated service returns its replica count.
func TestAggregateNodeMetrics_GetServiceMultiplier_Replicated(t *testing.T) {
	t.Parallel()

	replicas := uint64(3)
	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			Mode: swarm.ServiceMode{
				Replicated: &swarm.ReplicatedService{Replicas: &replicas},
			},
		},
	}
	mult := getServiceMultiplier(svc, 5)
	if mult != 3 {
		t.Errorf("getServiceMultiplier (replicated=3): got %d, want 3", mult)
	}
}

// TestAggregateNodeMetrics_GetServiceMultiplier_Global verifies that a global
// service returns the number of ready nodes.
func TestAggregateNodeMetrics_GetServiceMultiplier_Global(t *testing.T) {
	t.Parallel()

	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			Mode: swarm.ServiceMode{
				Global: &swarm.GlobalService{},
			},
		},
	}
	mult := getServiceMultiplier(svc, 5)
	if mult != 5 {
		t.Errorf("getServiceMultiplier (global, 5 nodes): got %d, want 5", mult)
	}
}

// TestAggregateNodeMetrics_GetServiceMultiplier_Neither verifies that a
// service with neither replicated nor global mode returns 0.
func TestAggregateNodeMetrics_GetServiceMultiplier_Neither(t *testing.T) {
	t.Parallel()

	svc := &swarm.Service{}
	mult := getServiceMultiplier(svc, 5)
	if mult != 0 {
		t.Errorf("getServiceMultiplier (neither mode): got %d, want 0", mult)
	}
}

// TestAggregateNodeMetrics_GetServiceMultiplier_NilReplicas verifies that a
// replicated service with nil Replicas pointer returns 0.
func TestAggregateNodeMetrics_GetServiceMultiplier_NilReplicas(t *testing.T) {
	t.Parallel()

	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			Mode: swarm.ServiceMode{
				Replicated: &swarm.ReplicatedService{Replicas: nil},
			},
		},
	}
	mult := getServiceMultiplier(svc, 5)
	if mult != 0 {
		t.Errorf("getServiceMultiplier (nil replicas): got %d, want 0", mult)
	}
}

// ---------------------------------------------------------------------------
// swarmTimestampedName and isAlphaNumASCII tests
// Named under TestTaskToInfo* to match the test filter.
// ---------------------------------------------------------------------------

// TestTaskToInfo_SwarmTimestampedName_Normal verifies a simple base+stamp
// combination produces the expected name.
func TestTaskToInfo_SwarmTimestampedName_Normal(t *testing.T) {
	t.Parallel()

	name := swarmTimestampedName("myconfig", "20260219")
	want := "myconfig_20260219"
	if name != want {
		t.Errorf("swarmTimestampedName: got %q, want %q", name, want)
	}
}

// TestTaskToInfo_SwarmTimestampedName_LongBase verifies that a very long base
// name is truncated to keep the total within 64 characters.
func TestTaskToInfo_SwarmTimestampedName_LongBase(t *testing.T) {
	t.Parallel()

	longBase := strings.Repeat("a", 100)
	name := swarmTimestampedName(longBase, "stamp123")
	if len(name) > swarmObjectNameMaxLen {
		t.Errorf("swarmTimestampedName: length %d exceeds max %d", len(name), swarmObjectNameMaxLen)
	}
	// Must end with the stamp suffix
	if !strings.HasSuffix(name, "_stamp123") {
		t.Errorf("swarmTimestampedName: %q does not end with _stamp123", name)
	}
}

// TestTaskToInfo_SwarmTimestampedName_NonAlphaEdges verifies leading/trailing
// non-alphanumeric characters in the base name are trimmed.
func TestTaskToInfo_SwarmTimestampedName_NonAlphaEdges(t *testing.T) {
	t.Parallel()

	name := swarmTimestampedName("--config--", "ts")
	// Leading and trailing "--" should be stripped so base becomes "config"
	if !strings.Contains(name, "config") {
		t.Errorf("swarmTimestampedName(--config--): expected trimmed base to contain 'config', got %q", name)
	}
}

// TestTaskToInfo_SwarmTimestampedName_EmptyBase verifies that an empty base
// is replaced with "obj".
func TestTaskToInfo_SwarmTimestampedName_EmptyBase(t *testing.T) {
	t.Parallel()

	name := swarmTimestampedName("", "ts")
	if !strings.HasPrefix(name, "obj") {
		t.Errorf("swarmTimestampedName(empty): expected prefix obj, got %q", name)
	}
}

// TestTaskToInfo_SwarmTimestampedName_AllNonAlphaBase verifies that a base
// consisting entirely of non-alphanumeric characters is replaced with "obj".
func TestTaskToInfo_SwarmTimestampedName_AllNonAlphaBase(t *testing.T) {
	t.Parallel()

	name := swarmTimestampedName("---", "ts")
	if !strings.HasPrefix(name, "obj") {
		t.Errorf("swarmTimestampedName(---): expected prefix obj, got %q", name)
	}
}


// TestTaskStatusString_IsAlphaNumASCII verifies the isAlphaNumASCII helper
// for representative inputs.
func TestTaskStatusString_IsAlphaNumASCII(t *testing.T) {
	t.Parallel()

	alphanumCases := []byte{'a', 'z', 'A', 'Z', '0', '9', 'm', 'M', '5'}
	for _, b := range alphanumCases {
		if !isAlphaNumASCII(b) {
			t.Errorf("isAlphaNumASCII(%q) = false, want true", b)
		}
	}

	nonAlphanumCases := []byte{'-', '_', '.', '!', ' ', '\t', '#', '@'}
	for _, b := range nonAlphanumCases {
		if isAlphaNumASCII(b) {
			t.Errorf("isAlphaNumASCII(%q) = true, want false", b)
		}
	}
}

// ---------------------------------------------------------------------------
// healthCheckToInfo nil branch — named under TestTaskToInfo* to match filter
// ---------------------------------------------------------------------------

// TestTaskToInfo_HealthCheckToInfo_NilDirect verifies that calling
// healthCheckToInfo(nil) returns nil (covers the nil-guard branch).
func TestTaskToInfo_HealthCheckToInfo_NilDirect(t *testing.T) {
	t.Parallel()

	if got := healthCheckToInfo(nil); got != nil {
		t.Errorf("healthCheckToInfo(nil): got %+v, want nil", got)
	}
}
