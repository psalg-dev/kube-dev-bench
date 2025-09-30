package app

import "time"

// OverviewInfo contains counts of resources for a namespace
type OverviewInfo struct {
	Pods        int `json:"pods"`
	Deployments int `json:"deployments"`
	Jobs        int `json:"jobs"`
}

// PodInfo describes a running pod's basic info
type PodInfo struct {
	Name      string `json:"name"`
	Restarts  int32  `json:"restarts"`
	Uptime    string `json:"uptime"`
	StartTime string `json:"startTime"`
	// Container ports exposed by this pod (unique, across containers)
	Ports  []int  `json:"ports"`
	Status string `json:"status"`
}

// KubeConfigInfo represents information about a kubeconfig file
type KubeConfigInfo struct {
	Path     string   `json:"path"`
	Name     string   `json:"name"`
	Contexts []string `json:"contexts"`
}

// EventInfo is a simplified event record for UI display
type EventInfo struct {
	Type           string    `json:"type"`
	Reason         string    `json:"reason"`
	Message        string    `json:"message"`
	Count          int32     `json:"count"`
	FirstTimestamp time.Time `json:"firstTimestamp"`
	LastTimestamp  time.Time `json:"lastTimestamp"`
	Source         string    `json:"source"`
}

// PodSummary returns basic properties for a pod
type PodSummary struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Created   time.Time         `json:"created"`
	Labels    map[string]string `json:"labels"`
	Status    string            `json:"status"`
}

// PortForwardInfo describes an active port-forward session for UI updates
type PortForwardInfo struct {
	Namespace string `json:"namespace"`
	Pod       string `json:"pod"`
	Local     int    `json:"local"`
	Remote    int    `json:"remote"`
}
