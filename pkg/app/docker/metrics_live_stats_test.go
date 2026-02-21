package docker

import (
	"math"
	"testing"
)

// TestAggregateServiceMetrics_ThreeNodes verifies that aggregateServiceMetrics
// correctly sums metrics from 3 containers belonging to the same service,
// producing the correct running task count and resource totals.
func TestAggregateServiceMetrics_ThreeNodes(t *testing.T) {
	t.Parallel()

	agg := map[string]*SwarmServiceMetrics{}
	const now = "2026-02-19T12:00:00Z"

	// Simulate 3 running containers for service "svc1"
	stats := []*containerStatsResult{
		{cpuP: 10.0, memUsed: 100 * 1024 * 1024, memLimit: 512 * 1024 * 1024, rx: 1000, tx: 500},
		{cpuP: 20.0, memUsed: 200 * 1024 * 1024, memLimit: 512 * 1024 * 1024, rx: 2000, tx: 1000},
		{cpuP: 30.0, memUsed: 300 * 1024 * 1024, memLimit: 512 * 1024 * 1024, rx: 3000, tx: 1500},
	}

	for _, s := range stats {
		aggregateServiceMetrics(agg, "svc1", "web-service", now, s)
	}

	m, ok := agg["svc1"]
	if !ok {
		t.Fatal("expected entry for svc1 in aggregation map")
	}

	// RunningTasks and Containers must both equal 3
	if m.RunningTasks != 3 {
		t.Errorf("RunningTasks: got %d, want 3", m.RunningTasks)
	}
	if m.Containers != 3 {
		t.Errorf("Containers: got %d, want 3", m.Containers)
	}

	// CpuPercent should be 10.0 + 20.0 + 30.0 = 60.0
	wantCPU := 60.0
	if math.Abs(m.CpuPercent-wantCPU) > 0.001 {
		t.Errorf("CpuPercent: got %.4f, want %.4f", m.CpuPercent, wantCPU)
	}

	// MemoryUsedBytes should be 600 MB
	wantMem := int64(600 * 1024 * 1024)
	if m.MemoryUsedBytes != wantMem {
		t.Errorf("MemoryUsedBytes: got %d, want %d", m.MemoryUsedBytes, wantMem)
	}

	// MemoryLimitBytes should be 3 * 512 MB = 1536 MB
	wantMemLimit := int64(3 * 512 * 1024 * 1024)
	if m.MemoryLimitBytes != wantMemLimit {
		t.Errorf("MemoryLimitBytes: got %d, want %d", m.MemoryLimitBytes, wantMemLimit)
	}

	// NetworkRxBytes should be 1000 + 2000 + 3000 = 6000
	if m.NetworkRxBytes != 6000 {
		t.Errorf("NetworkRxBytes: got %d, want 6000", m.NetworkRxBytes)
	}

	// NetworkTxBytes should be 500 + 1000 + 1500 = 3000
	if m.NetworkTxBytes != 3000 {
		t.Errorf("NetworkTxBytes: got %d, want 3000", m.NetworkTxBytes)
	}

	// ServiceID and ServiceName metadata
	if m.ServiceID != "svc1" {
		t.Errorf("ServiceID: got %q, want svc1", m.ServiceID)
	}
	if m.ServiceName != "web-service" {
		t.Errorf("ServiceName: got %q, want web-service", m.ServiceName)
	}
	if m.Timestamp != now {
		t.Errorf("Timestamp: got %q, want %q", m.Timestamp, now)
	}
}

// TestAggregateServiceMetrics_MultipleServices verifies that metrics for
// different services are kept separate.
func TestAggregateServiceMetrics_MultipleServices(t *testing.T) {
	t.Parallel()

	agg := map[string]*SwarmServiceMetrics{}
	const now = "2026-02-19T12:00:00Z"

	s1 := &containerStatsResult{cpuP: 15.0, memUsed: 150, memLimit: 512, rx: 100, tx: 50}
	s2 := &containerStatsResult{cpuP: 25.0, memUsed: 250, memLimit: 512, rx: 200, tx: 100}

	aggregateServiceMetrics(agg, "svcA", "api", now, s1)
	aggregateServiceMetrics(agg, "svcB", "worker", now, s2)
	aggregateServiceMetrics(agg, "svcA", "api", now, s2)

	if agg["svcA"].RunningTasks != 2 {
		t.Errorf("svcA RunningTasks: got %d, want 2", agg["svcA"].RunningTasks)
	}
	if agg["svcB"].RunningTasks != 1 {
		t.Errorf("svcB RunningTasks: got %d, want 1", agg["svcB"].RunningTasks)
	}

	wantSvcACPU := 40.0 // 15 + 25
	if math.Abs(agg["svcA"].CpuPercent-wantSvcACPU) > 0.001 {
		t.Errorf("svcA CpuPercent: got %.4f, want %.4f", agg["svcA"].CpuPercent, wantSvcACPU)
	}

	if math.Abs(agg["svcB"].CpuPercent-25.0) > 0.001 {
		t.Errorf("svcB CpuPercent: got %.4f, want 25.0000", agg["svcB"].CpuPercent)
	}
}

// TestAggregateServiceMetrics_SingleEntry verifies first-time entry creation.
func TestAggregateServiceMetrics_SingleEntry(t *testing.T) {
	t.Parallel()

	agg := map[string]*SwarmServiceMetrics{}
	const now = "2026-02-19T12:00:00Z"

	stats := &containerStatsResult{cpuP: 5.5, memUsed: 64, memLimit: 128, rx: 10, tx: 5}
	aggregateServiceMetrics(agg, "solo-svc", "standalone", now, stats)

	m := agg["solo-svc"]
	if m == nil {
		t.Fatal("expected entry created on first call")
	}
	if m.RunningTasks != 1 {
		t.Errorf("RunningTasks: got %d, want 1", m.RunningTasks)
	}
	if math.Abs(m.CpuPercent-5.5) > 0.001 {
		t.Errorf("CpuPercent: got %.4f, want 5.5000", m.CpuPercent)
	}
	if m.NetworkRxBytes != 10 {
		t.Errorf("NetworkRxBytes: got %d, want 10", m.NetworkRxBytes)
	}
}

// TestAggregateNodeMetrics_ThreeContainers verifies that aggregateNodeMetrics
// correctly sums metrics from 3 containers on the same node.
func TestAggregateNodeMetrics_ThreeContainers(t *testing.T) {
	t.Parallel()

	agg := map[string]*SwarmNodeMetrics{}
	const now = "2026-02-19T12:00:00Z"

	// Simulate 3 running containers on node "node1"
	inputs := []*containerStatsResult{
		{cpuP: 12.5, memUsed: 128 * 1024 * 1024, rx: 500, tx: 250},
		{cpuP: 25.0, memUsed: 256 * 1024 * 1024, rx: 1000, tx: 500},
		{cpuP: 37.5, memUsed: 384 * 1024 * 1024, rx: 1500, tx: 750},
	}

	for _, s := range inputs {
		aggregateNodeMetrics(agg, "node1", "worker-alpha", now, s)
	}

	m, ok := agg["node1"]
	if !ok {
		t.Fatal("expected entry for node1 in aggregation map")
	}

	// RunningTasks and Containers must both equal 3
	if m.RunningTasks != 3 {
		t.Errorf("RunningTasks: got %d, want 3", m.RunningTasks)
	}
	if m.Containers != 3 {
		t.Errorf("Containers: got %d, want 3", m.Containers)
	}

	// CpuPercent: 12.5 + 25.0 + 37.5 = 75.0
	wantCPU := 75.0
	if math.Abs(m.CpuPercent-wantCPU) > 0.001 {
		t.Errorf("CpuPercent: got %.4f, want %.4f", m.CpuPercent, wantCPU)
	}

	// MemoryUsedBytes: 128 + 256 + 384 = 768 MB
	wantMem := int64(768 * 1024 * 1024)
	if m.MemoryUsedBytes != wantMem {
		t.Errorf("MemoryUsedBytes: got %d, want %d", m.MemoryUsedBytes, wantMem)
	}

	// NetworkRxBytes: 500 + 1000 + 1500 = 3000
	if m.NetworkRxBytes != 3000 {
		t.Errorf("NetworkRxBytes: got %d, want 3000", m.NetworkRxBytes)
	}

	// NetworkTxBytes: 250 + 500 + 750 = 1500
	if m.NetworkTxBytes != 1500 {
		t.Errorf("NetworkTxBytes: got %d, want 1500", m.NetworkTxBytes)
	}

	// Metadata fields
	if m.NodeID != "node1" {
		t.Errorf("NodeID: got %q, want node1", m.NodeID)
	}
	if m.Hostname != "worker-alpha" {
		t.Errorf("Hostname: got %q, want worker-alpha", m.Hostname)
	}
	if m.Timestamp != now {
		t.Errorf("Timestamp: got %q, want %q", m.Timestamp, now)
	}
}

// TestAggregateNodeMetrics_MultipleNodes verifies that metrics for
// different nodes are kept separate.
func TestAggregateNodeMetrics_MultipleNodes(t *testing.T) {
	t.Parallel()

	agg := map[string]*SwarmNodeMetrics{}
	const now = "2026-02-19T12:00:00Z"

	sN1 := &containerStatsResult{cpuP: 10.0, memUsed: 100, rx: 50, tx: 25}
	sN2 := &containerStatsResult{cpuP: 20.0, memUsed: 200, rx: 100, tx: 50}

	aggregateNodeMetrics(agg, "node-1", "host-a", now, sN1)
	aggregateNodeMetrics(agg, "node-2", "host-b", now, sN2)
	aggregateNodeMetrics(agg, "node-1", "host-a", now, sN2)

	if agg["node-1"].RunningTasks != 2 {
		t.Errorf("node-1 RunningTasks: got %d, want 2", agg["node-1"].RunningTasks)
	}
	if agg["node-2"].RunningTasks != 1 {
		t.Errorf("node-2 RunningTasks: got %d, want 1", agg["node-2"].RunningTasks)
	}

	wantN1CPU := 30.0 // 10.0 + 20.0
	if math.Abs(agg["node-1"].CpuPercent-wantN1CPU) > 0.001 {
		t.Errorf("node-1 CpuPercent: got %.4f, want %.4f", agg["node-1"].CpuPercent, wantN1CPU)
	}
	if math.Abs(agg["node-2"].CpuPercent-20.0) > 0.001 {
		t.Errorf("node-2 CpuPercent: got %.4f, want 20.0000", agg["node-2"].CpuPercent)
	}

	if agg["node-1"].Hostname != "host-a" {
		t.Errorf("node-1 Hostname: got %q, want host-a", agg["node-1"].Hostname)
	}
	if agg["node-2"].Hostname != "host-b" {
		t.Errorf("node-2 Hostname: got %q, want host-b", agg["node-2"].Hostname)
	}
}

// TestAggregateNodeMetrics_SingleEntry verifies first-time entry creation.
func TestAggregateNodeMetrics_SingleEntry(t *testing.T) {
	t.Parallel()

	agg := map[string]*SwarmNodeMetrics{}
	const now = "2026-02-19T12:00:00Z"

	stats := &containerStatsResult{cpuP: 3.14, memUsed: 32, rx: 7, tx: 3}
	aggregateNodeMetrics(agg, "sole-node", "lonely-host", now, stats)

	m := agg["sole-node"]
	if m == nil {
		t.Fatal("expected entry created on first aggregateNodeMetrics call")
	}
	if m.RunningTasks != 1 {
		t.Errorf("RunningTasks: got %d, want 1", m.RunningTasks)
	}
	if m.Containers != 1 {
		t.Errorf("Containers: got %d, want 1", m.Containers)
	}
	if math.Abs(m.CpuPercent-3.14) > 0.001 {
		t.Errorf("CpuPercent: got %.4f, want 3.1400", m.CpuPercent)
	}
	if m.NetworkTxBytes != 3 {
		t.Errorf("NetworkTxBytes: got %d, want 3", m.NetworkTxBytes)
	}
}

// TestAggregateServiceMetrics_EmptyStats verifies aggregation with zero-value stats.
func TestAggregateServiceMetrics_ZeroStats(t *testing.T) {
	t.Parallel()

	agg := map[string]*SwarmServiceMetrics{}
	const now = "2026-02-19T12:00:00Z"

	stats := &containerStatsResult{cpuP: 0, memUsed: 0, memLimit: 0, rx: 0, tx: 0}
	aggregateServiceMetrics(agg, "zero-svc", "quiet", now, stats)
	aggregateServiceMetrics(agg, "zero-svc", "quiet", now, stats)

	m := agg["zero-svc"]
	if m.RunningTasks != 2 {
		t.Errorf("RunningTasks: got %d, want 2", m.RunningTasks)
	}
	if m.CpuPercent != 0 {
		t.Errorf("CpuPercent: got %f, want 0", m.CpuPercent)
	}
}

// TestAggregateNodeMetrics_ZeroStats verifies aggregation with zero-value stats.
func TestAggregateNodeMetrics_ZeroStats(t *testing.T) {
	t.Parallel()

	agg := map[string]*SwarmNodeMetrics{}
	const now = "2026-02-19T12:00:00Z"

	stats := &containerStatsResult{cpuP: 0, memUsed: 0, rx: 0, tx: 0}
	aggregateNodeMetrics(agg, "quiet-node", "idle-host", now, stats)

	m := agg["quiet-node"]
	if m.RunningTasks != 1 {
		t.Errorf("RunningTasks: got %d, want 1", m.RunningTasks)
	}
	if m.CpuPercent != 0 {
		t.Errorf("CpuPercent: got %f, want 0", m.CpuPercent)
	}
}
