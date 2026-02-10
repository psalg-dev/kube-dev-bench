package docker

//revive:disable:var-naming

// SwarmServiceMetrics is an aggregated, point-in-time view of resource usage for a Swarm service.
// Values are best-effort and are typically derived from local Engine container stats.
//
// Note: In real multi-node clusters, collecting per-node stats requires per-node Engine access.
// For local-dev Swarm (single Engine), this is sufficient and useful.
type SwarmServiceMetrics struct {
	Timestamp string `json:"timestamp"`

	ServiceID   string `json:"serviceId"`
	ServiceName string `json:"serviceName"`

	RunningTasks int `json:"runningTasks"`
	Containers   int `json:"containers"`

	CpuPercent       float64 `json:"cpuPercent"` // Sum of container CPU% (can exceed 100)
	MemoryUsedBytes  int64   `json:"memoryUsedBytes"`
	MemoryLimitBytes int64   `json:"memoryLimitBytes"` // Sum of container limits (best-effort)
	NetworkRxBytes   int64   `json:"networkRxBytes"`
	NetworkTxBytes   int64   `json:"networkTxBytes"`
}

// SwarmNodeMetrics is an aggregated, point-in-time view of resource usage for a Swarm node.
// Values are best-effort and are typically derived from local Engine container stats.
type SwarmNodeMetrics struct {
	Timestamp string `json:"timestamp"`

	NodeID   string `json:"nodeId"`
	Hostname string `json:"hostname"`

	RunningTasks int `json:"runningTasks"`
	Containers   int `json:"containers"`

	CpuPercent      float64 `json:"cpuPercent"` // Sum of container CPU% (can exceed 100)
	MemoryUsedBytes int64   `json:"memoryUsedBytes"`
	NetworkRxBytes  int64   `json:"networkRxBytes"`
	NetworkTxBytes  int64   `json:"networkTxBytes"`
}

// SwarmMetricsBreakdown is an optional payload emitted alongside swarm:metrics:update
// to provide service/node rollups without changing the legacy event.
type SwarmMetricsBreakdown struct {
	Timestamp string `json:"timestamp"`

	Services []SwarmServiceMetrics `json:"services"`
	Nodes    []SwarmNodeMetrics    `json:"nodes"`
}

//revive:enable:var-naming
