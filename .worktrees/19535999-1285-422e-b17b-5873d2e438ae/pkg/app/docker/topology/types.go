package topology

//revive:disable:var-naming

// TopologyNode represents a Swarm node in the topology view.
type TopologyNode struct { //nolint:revive
	ID       string `json:"id"`
	Hostname string `json:"hostname"`
	Role     string `json:"role"`  // manager/worker
	State    string `json:"state"` // ready/down/...

	TaskCount int `json:"taskCount"`
}

// TopologyService represents a Swarm service in the topology view.
type TopologyService struct { //nolint:revive
	ID   string `json:"id"`
	Name string `json:"name"`
	Mode string `json:"mode"` // replicated/global

	DesiredReplicas int `json:"desiredReplicas"`
	TaskCount       int `json:"taskCount"`    // total tasks
	RunningTasks    int `json:"runningTasks"` // running tasks
}

// TopologyLink connects a service to a node with a weight (task count).
type TopologyLink struct { //nolint:revive
	From   string `json:"from"`
	To     string `json:"to"`
	Type   string `json:"type"` // e.g. runs_on
	Weight int    `json:"weight"`
}

// ClusterTopology is the payload returned to the frontend.
type ClusterTopology struct {
	Timestamp string `json:"timestamp"`

	Nodes    []TopologyNode    `json:"nodes"`
	Services []TopologyService `json:"services"`
	Links    []TopologyLink    `json:"links"`
}

//revive:enable:var-naming
