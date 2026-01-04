package docker

// SwarmServiceInfo describes a Swarm service
type SwarmServiceInfo struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Image        string            `json:"image"`
	Replicas     uint64            `json:"replicas"`
	RunningTasks uint64            `json:"runningTasks"`
	Mode         string            `json:"mode"` // "replicated" or "global"
	Ports        []SwarmPortInfo   `json:"ports"`
	Labels       map[string]string `json:"labels"`
	CreatedAt    string            `json:"createdAt"`
	UpdatedAt    string            `json:"updatedAt"`
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
	ID           string `json:"id"`
	ServiceID    string `json:"serviceId"`
	ServiceName  string `json:"serviceName"`
	NodeID       string `json:"nodeId"`
	NodeName     string `json:"nodeName"`
	Slot         int    `json:"slot"`
	State        string `json:"state"` // running, pending, failed, etc.
	DesiredState string `json:"desiredState"`
	ContainerID  string `json:"containerId"`
	Error        string `json:"error"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
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
	Labels        map[string]string `json:"labels"`
	Leader        bool              `json:"leader"`
}

// SwarmNetworkInfo describes a Swarm network
type SwarmNetworkInfo struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Scope      string            `json:"scope"` // "swarm", "local"
	Attachable bool              `json:"attachable"`
	Internal   bool              `json:"internal"`
	Labels     map[string]string `json:"labels"`
	CreatedAt  string            `json:"createdAt"`
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

// SwarmSecretInfo describes a Swarm secret
type SwarmSecretInfo struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	CreatedAt string            `json:"createdAt"`
	UpdatedAt string            `json:"updatedAt"`
	Labels    map[string]string `json:"labels"`
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
