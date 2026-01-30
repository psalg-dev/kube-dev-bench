package docker

import (
	"math"
	"testing"

	"github.com/docker/docker/api/types/container"
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
