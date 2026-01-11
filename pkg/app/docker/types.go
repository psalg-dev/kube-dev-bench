package docker

// SwarmServiceInfo describes a Swarm service
type SwarmServiceInfo struct {
	ID                   string                 `json:"id"`
	Name                 string                 `json:"name"`
	Image                string                 `json:"image"`
	ImageUpdateAvailable bool                   `json:"imageUpdateAvailable"`
	ImageLocalDigest     string                 `json:"imageLocalDigest"`
	ImageRemoteDigest    string                 `json:"imageRemoteDigest"`
	ImageCheckedAt       string                 `json:"imageCheckedAt"`
	Replicas             uint64                 `json:"replicas"`
	RunningTasks         uint64                 `json:"runningTasks"`
	Mode                 string                 `json:"mode"` // "replicated" or "global"
	Ports                []SwarmPortInfo        `json:"ports"`
	Env                  []string               `json:"env"`
	Mounts               []SwarmMountInfo       `json:"mounts"`
	UpdateConfig         *SwarmUpdateConfigInfo `json:"updateConfig"`
	Resources            *SwarmResourcesInfo    `json:"resources"`
	Placement            *SwarmPlacementInfo    `json:"placement"`
	Labels               map[string]string      `json:"labels"`
	CreatedAt            string                 `json:"createdAt"`
	UpdatedAt            string                 `json:"updatedAt"`
}

// ImageUpdateInfo describes the outcome of checking an image tag/digest in a registry.
// This is used by the Swarm "Image Update Detection" feature.
type ImageUpdateInfo struct {
	Image           string `json:"image"`
	UpdateAvailable bool   `json:"updateAvailable"`
	LocalDigest     string `json:"localDigest"`
	RemoteDigest    string `json:"remoteDigest"`
	CheckedAt       string `json:"checkedAt"`
	Error           string `json:"error"`
}

type SwarmMountInfo struct {
	Type     string `json:"type"`
	Source   string `json:"source"`
	Target   string `json:"target"`
	ReadOnly bool   `json:"readOnly"`
}

type SwarmUpdateConfigInfo struct {
	Parallelism     uint64  `json:"parallelism"`
	Delay           string  `json:"delay"`
	FailureAction   string  `json:"failureAction"`
	Monitor         string  `json:"monitor"`
	MaxFailureRatio float64 `json:"maxFailureRatio"`
	Order           string  `json:"order"`
}

type SwarmResourceLimitsInfo struct {
	NanoCPUs    int64 `json:"nanoCpus"`
	MemoryBytes int64 `json:"memoryBytes"`
}

type SwarmResourcesInfo struct {
	Limits       *SwarmResourceLimitsInfo `json:"limits"`
	Reservations *SwarmResourceLimitsInfo `json:"reservations"`
}

type SwarmPlacementInfo struct {
	Constraints []string `json:"constraints"`
	Preferences []string `json:"preferences"`
	MaxReplicas uint64   `json:"maxReplicas"`
}

// SwarmPortInfo describes a published port
type SwarmPortInfo struct {
	Protocol      string `json:"protocol"`
	TargetPort    uint32 `json:"targetPort"`
	PublishedPort uint32 `json:"publishedPort"`
	PublishMode   string `json:"publishMode"`
}

// SwarmTaskInfo describes a Swarm task (container instance)
type SwarmTaskInfo struct {
	ID           string                 `json:"id"`
	ServiceID    string                 `json:"serviceId"`
	ServiceName  string                 `json:"serviceName"`
	NodeID       string                 `json:"nodeId"`
	NodeName     string                 `json:"nodeName"`
	Slot         int                    `json:"slot"`
	State        string                 `json:"state"` // running, pending, failed, etc.
	DesiredState string                 `json:"desiredState"`
	ContainerID  string                 `json:"containerId"`
	HealthStatus string                 `json:"healthStatus"` // starting, healthy, unhealthy, none
	HealthCheck  *SwarmHealthCheckInfo  `json:"healthCheck"`
	Image        string                 `json:"image"`
	Mounts       []SwarmMountInfo       `json:"mounts"`
	Networks     []SwarmTaskNetworkInfo `json:"networks"`
	Error        string                 `json:"error"`
	CreatedAt    string                 `json:"createdAt"`
	UpdatedAt    string                 `json:"updatedAt"`
}

// SwarmHealthCheckInfo describes container healthcheck configuration.
// Values mirror Docker healthcheck fields but are encoded for frontend display.
type SwarmHealthCheckInfo struct {
	Test        []string `json:"test"`
	Interval    string   `json:"interval"`
	Timeout     string   `json:"timeout"`
	Retries     int      `json:"retries"`
	StartPeriod string   `json:"startPeriod"`
}

// SwarmHealthLogEntry describes a single healthcheck execution result.
type SwarmHealthLogEntry struct {
	Start    string `json:"start"`
	End      string `json:"end"`
	ExitCode int    `json:"exitCode"`
	Output   string `json:"output"`
}

type SwarmTaskNetworkInfo struct {
	NetworkID string   `json:"networkId"`
	Addresses []string `json:"addresses"`
}

// SwarmNodeInfo describes a Swarm node
type SwarmNodeInfo struct {
	ID            string            `json:"id"`
	Hostname      string            `json:"hostname"`
	Role          string            `json:"role"`         // "manager" or "worker"
	Availability  string            `json:"availability"` // "active", "pause", "drain"
	State         string            `json:"state"`        // "ready", "down", etc.
	Address       string            `json:"address"`
	EngineVersion string            `json:"engineVersion"`
	OS            string            `json:"os"`
	Arch          string            `json:"arch"`
	NanoCPUs      int64             `json:"nanoCpus"`
	MemoryBytes   int64             `json:"memoryBytes"`
	Labels        map[string]string `json:"labels"`
	Leader        bool              `json:"leader"`
	TLS           *SwarmTLSInfo     `json:"tls"`
}

type SwarmTLSInfo struct {
	TrustRoot           string `json:"trustRoot"`
	CertIssuerSubject   string `json:"certIssuerSubject"`
	CertIssuerPublicKey string `json:"certIssuerPublicKey"`
}

// SwarmNetworkInfo describes a Swarm network
type SwarmNetworkInfo struct {
	ID         string                   `json:"id"`
	Name       string                   `json:"name"`
	Driver     string                   `json:"driver"`
	Scope      string                   `json:"scope"` // "swarm", "local"
	Attachable bool                     `json:"attachable"`
	Internal   bool                     `json:"internal"`
	Labels     map[string]string        `json:"labels"`
	Options    map[string]string        `json:"options"`
	IPAM       []SwarmNetworkIPAMConfig `json:"ipam"`
	CreatedAt  string                   `json:"createdAt"`
}

type SwarmNetworkIPAMConfig struct {
	Subnet       string            `json:"subnet"`
	Gateway      string            `json:"gateway"`
	IPRange      string            `json:"ipRange"`
	AuxAddresses map[string]string `json:"auxAddresses"`
}

// SwarmConfigInfo describes a Swarm config
type SwarmConfigInfo struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	CreatedAt string            `json:"createdAt"`
	UpdatedAt string            `json:"updatedAt"`
	DataSize  int               `json:"dataSize"` // Size in bytes
	Labels    map[string]string `json:"labels"`
}

// SwarmServiceRef is a lightweight reference to a Swarm service.
// Used by "Used By" sections for configs/secrets/volumes.
type SwarmServiceRef struct {
	ServiceID   string `json:"serviceId"`
	ServiceName string `json:"serviceName"`
}

// SwarmConfigUpdateResult describes the outcome of a config "edit" operation.
// Note: Swarm configs are immutable; editing creates a new config and migrates services.
type SwarmConfigUpdateResult struct {
	OldConfigID   string            `json:"oldConfigId"`
	OldConfigName string            `json:"oldConfigName"`
	NewConfigID   string            `json:"newConfigId"`
	NewConfigName string            `json:"newConfigName"`
	Updated       []SwarmServiceRef `json:"updated"`
}

// SwarmSecretUpdateResult describes the outcome of a secret "edit" operation.
// Note: Swarm secrets are immutable; editing creates a new secret and migrates services.
type SwarmSecretUpdateResult struct {
	OldSecretID   string            `json:"oldSecretId"`
	OldSecretName string            `json:"oldSecretName"`
	NewSecretID   string            `json:"newSecretId"`
	NewSecretName string            `json:"newSecretName"`
	Updated       []SwarmServiceRef `json:"updated"`
}

// SwarmSecretInfo describes a Swarm secret
type SwarmSecretInfo struct {
	ID            string            `json:"id"`
	Name          string            `json:"name"`
	CreatedAt     string            `json:"createdAt"`
	UpdatedAt     string            `json:"updatedAt"`
	Labels        map[string]string `json:"labels"`
	DriverName    string            `json:"driverName"`
	DriverOptions map[string]string `json:"driverOptions"`
}

// SwarmStackInfo describes a Docker Stack
type SwarmStackInfo struct {
	Name         string `json:"name"`
	Services     int    `json:"services"`
	Orchestrator string `json:"orchestrator"` // "Swarm"
}

// SwarmResourceCounts for sidebar display
type SwarmResourceCounts struct {
	Services int `json:"services"`
	Tasks    int `json:"tasks"`
	Nodes    int `json:"nodes"`
	Networks int `json:"networks"`
	Configs  int `json:"configs"`
	Secrets  int `json:"secrets"`
	Stacks   int `json:"stacks"`
	Volumes  int `json:"volumes"`
}

// SwarmMetricsPoint is a single point-in-time snapshot used by the Swarm Metrics Dashboard.
type SwarmMetricsPoint struct {
	Timestamp string `json:"timestamp"`

	Services     int `json:"services"`
	Tasks        int `json:"tasks"`
	RunningTasks int `json:"runningTasks"`
	Nodes        int `json:"nodes"`
	ReadyNodes   int `json:"readyNodes"`

	CpuCapacityNano         int64 `json:"cpuCapacityNano"`
	MemoryCapacityBytes     int64 `json:"memoryCapacityBytes"`
	CpuReservationsNano     int64 `json:"cpuReservationsNano"`
	MemoryReservationsBytes int64 `json:"memoryReservationsBytes"`
	CpuLimitsNano           int64 `json:"cpuLimitsNano"`
	MemoryLimitsBytes       int64 `json:"memoryLimitsBytes"`

	// Best-effort live usage derived from container stats on the connected Docker Engine.
	// Values may be zero if stats cannot be collected.
	CpuUsagePercent   float64 `json:"cpuUsagePercent"` // Percent of cluster capacity (approx)
	MemoryUsedBytes   int64   `json:"memoryUsedBytes"`
	NetworkRxBytes    int64   `json:"networkRxBytes"`
	NetworkTxBytes    int64   `json:"networkTxBytes"`
	RunningContainers int     `json:"runningContainers"`
}

// DockerConnectionStatus for connection state
type DockerConnectionStatus struct {
	Connected     bool   `json:"connected"`
	SwarmActive   bool   `json:"swarmActive"`
	NodeID        string `json:"nodeId"`
	IsManager     bool   `json:"isManager"`
	ServerVersion string `json:"serverVersion"`
	Error         string `json:"error"`
}

// DockerConfig holds Docker connection configuration
type DockerConfig struct {
	Host       string `json:"host"`       // unix:///var/run/docker.sock or tcp://host:port or npipe:////./pipe/docker_engine
	TLSEnabled bool   `json:"tlsEnabled"` // Whether to use TLS
	TLSCert    string `json:"tlsCert"`    // Path to TLS certificate
	TLSKey     string `json:"tlsKey"`     // Path to TLS key
	TLSCA      string `json:"tlsCA"`      // Path to CA certificate
	TLSVerify  bool   `json:"tlsVerify"`  // Whether to verify TLS certificates
}

// SwarmVolumeInfo describes a Swarm volume
type SwarmVolumeInfo struct {
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Scope      string            `json:"scope"` // "local" or "global"
	Mountpoint string            `json:"mountpoint"`
	Labels     map[string]string `json:"labels"`
	CreatedAt  string            `json:"createdAt"`
}

// PruneSwarmVolumesResult describes the outcome of pruning unused volumes.
// Wails supports returning a single struct more reliably than multiple values.
type PruneSwarmVolumesResult struct {
	VolumesDeleted []string `json:"volumesDeleted"`
	SpaceReclaimed uint64   `json:"spaceReclaimed"`
}
