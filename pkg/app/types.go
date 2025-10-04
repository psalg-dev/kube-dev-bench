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
	Namespace string `json:"namespace"`
	Restarts  int32  `json:"restarts"`
	Uptime    string `json:"uptime"`
	StartTime string `json:"startTime"`
	// Container ports exposed by this pod (unique, across containers)
	Ports  []int  `json:"ports"`
	Status string `json:"status"`
}

// PodStatusCounts provides counts of pods by phase for a namespace
// Colors in UI:
// - Running -> green
// - Pending/Creating -> yellow (frontend maps label to "Creating")
// - Failed -> red
// - Succeeded/Unknown -> neutral grey
type PodStatusCounts struct {
	Running   int `json:"running"`
	Pending   int `json:"pending"`
	Failed    int `json:"failed"`
	Succeeded int `json:"succeeded"`
	Unknown   int `json:"unknown"`
	Total     int `json:"total"`
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
	Ports     []int             `json:"ports"`
}

// PortForwardInfo describes an active port-forward session for UI updates
type PortForwardInfo struct {
	Namespace string `json:"namespace"`
	Pod       string `json:"pod"`
	Local     int    `json:"local"`
	Remote    int    `json:"remote"`
}

// VolumeInfo describes a pod volume and its source details
type VolumeInfo struct {
	Name                    string   `json:"name"`
	Type                    string   `json:"type"`
	SecretName              string   `json:"secretName,omitempty"`
	ConfigMapName           string   `json:"configMapName,omitempty"`
	PersistentVolumeClaim   string   `json:"pvc,omitempty"`
	HostPath                string   `json:"hostPath,omitempty"`
	EmptyDir                bool     `json:"emptyDir,omitempty"`
	ProjectedSecretNames    []string `json:"projectedSecretNames,omitempty"`
	ProjectedConfigMapNames []string `json:"projectedConfigMapNames,omitempty"`
}

// MountInfo connects a container path to a volume
type MountInfo struct {
	Name      string `json:"name"` // volume name
	MountPath string `json:"mountPath"`
	ReadOnly  bool   `json:"readOnly"`
	SubPath   string `json:"subPath,omitempty"`
}

// ContainerMountInfo lists mounts per (init-)container
type ContainerMountInfo struct {
	Container string      `json:"container"`
	IsInit    bool        `json:"isInit"`
	Mounts    []MountInfo `json:"mounts"`
}

// PodMounts is the aggregated view of volumes and their usage in containers
type PodMounts struct {
	Volumes    []VolumeInfo         `json:"volumes"`
	Containers []ContainerMountInfo `json:"containers"`
}

// DeploymentInfo describes a deployment's basic info
type DeploymentInfo struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Replicas  int32             `json:"replicas"`
	Ready     int32             `json:"ready"`
	Available int32             `json:"available"`
	Age       string            `json:"age"`
	Image     string            `json:"image"`
	Labels    map[string]string `json:"labels"` // Added: union of deployment metadata labels (preferred) or pod template labels fallback
}

// JobInfo describes a job's basic info
type JobInfo struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Completions int32             `json:"completions"`
	Succeeded   int32             `json:"succeeded"`
	Active      int32             `json:"active"`
	Failed      int32             `json:"failed"`
	Age         string            `json:"age"`
	Image       string            `json:"image"`
	Duration    string            `json:"duration"`
	Labels      map[string]string `json:"labels"` // Added
}

// CronJobInfo describes a cronjob's basic info
type CronJobInfo struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Schedule  string            `json:"schedule"`
	Suspend   bool              `json:"suspend"`
	Age       string            `json:"age"`
	Image     string            `json:"image"`
	NextRun   string            `json:"nextRun"`
	Labels    map[string]string `json:"labels"` // Added
}

// DaemonSetInfo describes a daemonset's basic info
type DaemonSetInfo struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Desired   int32             `json:"desired"`
	Current   int32             `json:"current"`
	Age       string            `json:"age"`
	Image     string            `json:"image"`
	Labels    map[string]string `json:"labels"` // Added
}

// StatefulSetInfo describes a statefulset's basic info
type StatefulSetInfo struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Replicas  int32             `json:"replicas"`
	Ready     int32             `json:"ready"`
	Age       string            `json:"age"`
	Image     string            `json:"image"`
	Labels    map[string]string `json:"labels"` // Added
}

// ReplicaSetInfo describes a replicaset's basic info
type ReplicaSetInfo struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Replicas  int32             `json:"replicas"`
	Ready     int32             `json:"ready"`
	Age       string            `json:"age"`
	Image     string            `json:"image"`
	Labels    map[string]string `json:"labels"` // Added
}

// ConfigMapInfo describes a configmap's basic info
type ConfigMapInfo struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Age       string            `json:"age"`
	Keys      int               `json:"keys"`
	Size      string            `json:"size"`
	Labels    map[string]string `json:"labels"` // Added
}

// IngressInfo describes an ingress's basic info
type IngressInfo struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Class     string            `json:"class"`
	Hosts     []string          `json:"hosts"`
	Address   string            `json:"address"`
	Ports     string            `json:"ports"`
	Age       string            `json:"age"`
	Labels    map[string]string `json:"labels"` // Added
}

// PersistentVolumeClaimInfo describes a PVC's basic info
type PersistentVolumeClaimInfo struct {
	Name         string            `json:"name"`
	Namespace    string            `json:"namespace"`
	Status       string            `json:"status"`
	Volume       string            `json:"volume"`
	Capacity     string            `json:"capacity"`
	AccessModes  string            `json:"accessModes"`
	StorageClass string            `json:"storageClass"`
	Age          string            `json:"age"`
	Labels       map[string]string `json:"labels"` // Added
}

// PersistentVolumeInfo describes a persistent volume in the cluster
type PersistentVolumeInfo struct {
	Name          string            `json:"name"`
	Capacity      string            `json:"capacity"`
	AccessModes   string            `json:"accessModes"`
	ReclaimPolicy string            `json:"reclaimPolicy"`
	Status        string            `json:"status"`
	Claim         string            `json:"claim"`
	StorageClass  string            `json:"storageClass"`
	VolumeType    string            `json:"volumeType"`
	Reason        string            `json:"reason"`     // Added: status reason if present
	VolumeMode    string            `json:"volumeMode"` // Added: Filesystem/Block if specified
	Age           string            `json:"age"`
	Labels        map[string]string `json:"labels"`      // Added
	Annotations   map[string]string `json:"annotations"` // New: expose annotations
}
