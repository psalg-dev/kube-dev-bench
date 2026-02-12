package app

import (
	"time"

	jobs "gowails/pkg/app/jobs"
)

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
	UID    string `json:"uid"`
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

// KindClusterResult describes the outcome of creating a KinD cluster.
type KindClusterResult struct {
	Name           string `json:"name"`
	KubeconfigPath string `json:"kubeconfigPath"`
	Context        string `json:"context"`
	Created        bool   `json:"created"`
}

// KindProgressUpdate reports KinD cluster setup progress for the UI.
type KindProgressUpdate struct {
	Percent int    `json:"percent"`
	Message string `json:"message"`
	Stage   string `json:"stage"`
	Done    bool   `json:"done"`
}

// EventInfo is a simplified event record for UI display
type EventInfo struct {
	Type           string `json:"type"`
	Reason         string `json:"reason"`
	Message        string `json:"message"`
	Count          int32  `json:"count"`
	FirstTimestamp string `json:"firstTimestamp"`
	LastTimestamp  string `json:"lastTimestamp"`
	Source         string `json:"source"`
}

// PodSummary returns basic properties for a pod
type PodSummary struct {
	Name           string              `json:"name"`
	Namespace      string              `json:"namespace"`
	Created        string              `json:"created"`
	Labels         map[string]string   `json:"labels"`
	Status         string              `json:"status"`
	Ports          []int               `json:"ports"`
	InitContainers []InitContainerInfo `json:"initContainers,omitempty"`
}

// InitContainerInfo provides info about an init container and its status
type InitContainerInfo struct {
	Name         string `json:"name"`
	Image        string `json:"image"`
	State        string `json:"state"`        // Waiting, Running, Terminated
	StateReason  string `json:"stateReason"`  // e.g. "PodInitializing", "Completed", "Error"
	StateMessage string `json:"stateMessage"` // detailed message if any
	Ready        bool   `json:"ready"`
	RestartCount int32  `json:"restartCount"`
	ExitCode     *int32 `json:"exitCode,omitempty"` // for terminated containers
	StartedAt    string `json:"startedAt,omitempty"`
	FinishedAt   string `json:"finishedAt,omitempty"`
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

// ServiceInfo describes a Kubernetes Service's basic info
type ServiceInfo struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Type      string            `json:"type"`
	ClusterIP string            `json:"clusterIP"`
	Ports     string            `json:"ports"`
	Age       string            `json:"age"`
	Labels    map[string]string `json:"labels,omitempty"`
	Selector  map[string]string `json:"selector,omitempty"`
}

// JobInfo describes a job's basic info — reuse the type from the jobs package to avoid duplication
type JobInfo = jobs.JobInfo

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

// HorizontalPodAutoscalerInfo describes an HPA's basic info
type HorizontalPodAutoscalerInfo struct {
	Name            string `json:"name"`
	Namespace       string `json:"namespace"`
	TargetKind      string `json:"targetKind"`
	TargetName      string `json:"targetName"`
	MinReplicas     int32  `json:"minReplicas"`
	MaxReplicas     int32  `json:"maxReplicas"`
	CurrentReplicas int32  `json:"currentReplicas"`
	DesiredReplicas int32  `json:"desiredReplicas"`
	CurrentCPU      string `json:"currentCPU,omitempty"`
	CurrentMemory   string `json:"currentMemory,omitempty"`
	TargetCPU       string `json:"targetCPU,omitempty"`
	TargetMemory    string `json:"targetMemory,omitempty"`
	Age             string `json:"age"`
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

// PodFileEntry represents a single file or directory in a pod container filesystem
// Extended with IsSymlink + LinkTarget for PVC browsing feature.
type PodFileEntry struct {
	Name       string `json:"name"`
	Path       string `json:"path"`
	IsDir      bool   `json:"isDir"`
	Size       int64  `json:"size"`
	Mode       string `json:"mode,omitempty"`
	Modified   string `json:"modified,omitempty"`
	Created    int64  `json:"created,omitempty"`
	IsSymlink  bool   `json:"isSymlink,omitempty"`
	LinkTarget string `json:"linkTarget,omitempty"`
}

// PodFileContent holds the (possibly truncated) base64 encoded content of a file in a pod
// Base64 is always supplied to preserve binary safety; frontend can decide to decode
// IsBinary is a heuristic based on first bytes of content
// Size is full file size (if determinable), not size of returned content
// Truncated indicates returned content is limited by maxBytes param
// Path is absolute path inside container
type PodFileContent struct {
	Path      string `json:"path"`
	Base64    string `json:"base64"`
	Size      int64  `json:"size"`
	Truncated bool   `json:"truncated"`
	IsBinary  bool   `json:"isBinary"`
}

// ArchiveResult contains a base64‐encoded tar (optionally truncated)
// of a directory or single file for download.
type ArchiveResult struct {
	Path      string `json:"path"`
	Base64    string `json:"base64"`
	Truncated bool   `json:"truncated"`
	Size      int64  `json:"size"` // size of returned (decoded) tar data (may be truncated)
}

// ResourceCounts aggregates counts for all sidebar-listed resources across the currently
// selected (preferred) namespaces. PersistentVolumes are cluster-scoped.
// This is emitted periodically to the frontend (event: "resourcecounts:update").
type ResourceCounts struct {
	PodStatus              PodStatusCounts `json:"podStatus"`
	Services               int             `json:"services"`
	Deployments            int             `json:"deployments"`
	Jobs                   int             `json:"jobs"`
	CronJobs               int             `json:"cronjobs"`
	DaemonSets             int             `json:"daemonsets"`
	StatefulSets           int             `json:"statefulsets"`
	ReplicaSets            int             `json:"replicasets"`
	ConfigMaps             int             `json:"configmaps"`
	Secrets                int             `json:"secrets"`
	Ingresses              int             `json:"ingresses"`
	PersistentVolumeClaims int             `json:"persistentvolumeclaims"`
	PersistentVolumes      int             `json:"persistentvolumes"`
	HelmReleases           int             `json:"helmreleases"`

	Roles               int `json:"roles"`
	ClusterRoles        int `json:"clusterroles"`
	RoleBindings        int `json:"rolebindings"`
	ClusterRoleBindings int `json:"clusterrolebindings"`
}

// MonitorIssue represents a single warning or error detected in the cluster
type MonitorIssue struct {
	Type          string `json:"type"`          // "warning" or "error"
	Resource      string `json:"resource"`      // e.g., "Pod", "Deployment"
	Namespace     string `json:"namespace"`     // namespace of the resource
	Name          string `json:"name"`          // name of the resource
	Reason        string `json:"reason"`        // reason for the issue (e.g., "CrashLoopBackOff", "ImagePullBackOff")
	Message       string `json:"message"`       // detailed message
	ContainerName string `json:"containerName"` // container name (for container-specific issues)
	RestartCount  int32  `json:"restartCount"`  // number of restarts (for pods)
	Age           string `json:"age"`           // age of the resource or event
	PodPhase      string `json:"podPhase"`      // pod phase (for pod issues)
	OwnerKind     string `json:"ownerKind"`     // parent resource kind (e.g., "Deployment")
	OwnerName     string `json:"ownerName"`     // parent resource name
	NodeName      string `json:"nodeName"`      // node where pod is scheduled

	IssueID          string    `json:"issueID"`          // stable ID for tracking
	HolmesAnalyzed   bool      `json:"holmesAnalyzed"`   // whether Holmes analyzed this issue
	HolmesAnalysis   string    `json:"holmesAnalysis"`   // analysis text (markdown)
	HolmesAnalyzedAt time.Time `json:"holmesAnalyzedAt"` // when analyzed
	Dismissed        bool      `json:"dismissed"`        // user dismissed this issue
	DismissedAt      time.Time `json:"dismissedAt"`      // when dismissed
}

// MonitorInfo aggregates warnings and errors across monitored namespaces
// This is emitted periodically to the frontend (event: "monitor:update")
type MonitorInfo struct {
	WarningCount int            `json:"warningCount"`
	ErrorCount   int            `json:"errorCount"`
	Warnings     []MonitorIssue `json:"warnings"`
	Errors       []MonitorIssue `json:"errors"`
}

// HelmReleaseInfo describes a Helm release's basic info
type HelmReleaseInfo struct {
	Name         string            `json:"name"`
	Namespace    string            `json:"namespace"`
	Revision     int               `json:"revision"`
	Chart        string            `json:"chart"`
	ChartVersion string            `json:"chartVersion"`
	AppVersion   string            `json:"appVersion"`
	Status       string            `json:"status"`
	Age          string            `json:"age"`
	Updated      string            `json:"updated"`
	Labels       map[string]string `json:"labels"`
}

// HelmRepositoryInfo describes a Helm repository
type HelmRepositoryInfo struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

// HelmChartInfo describes a Helm chart available in a repository
type HelmChartInfo struct {
	Name        string   `json:"name"`
	Repo        string   `json:"repo"`
	Version     string   `json:"version"`
	AppVersion  string   `json:"appVersion"`
	Description string   `json:"description"`
	Versions    []string `json:"versions"`
}

// HelmChartVersionInfo describes a specific version of a Helm chart
type HelmChartVersionInfo struct {
	Version     string `json:"version"`
	AppVersion  string `json:"appVersion"`
	Description string `json:"description"`
	Created     string `json:"created"`
}

// HelmHistoryInfo describes a revision in Helm release history
type HelmHistoryInfo struct {
	Revision    int    `json:"revision"`
	Updated     string `json:"updated"`
	Status      string `json:"status"`
	Chart       string `json:"chart"`
	AppVersion  string `json:"appVersion"`
	Description string `json:"description"`
}

// HelmInstallRequest contains parameters for installing a Helm chart
type HelmInstallRequest struct {
	ReleaseName string                 `json:"releaseName"`
	Namespace   string                 `json:"namespace"`
	ChartRef    string                 `json:"chartRef"` // repo/chart format
	Version     string                 `json:"version"`
	Values      map[string]interface{} `json:"values"`
	CreateNs    bool                   `json:"createNamespace"`
	// Helm v4 options
	WaitStrategy string `json:"waitStrategy"` // "none", "legacy", "watcher" - defaults to "legacy"
	Timeout      int    `json:"timeout"`      // Wait timeout in seconds, defaults to 300
}

// HelmUpgradeRequest contains parameters for upgrading a Helm release
type HelmUpgradeRequest struct {
	ReleaseName string                 `json:"releaseName"`
	Namespace   string                 `json:"namespace"`
	ChartRef    string                 `json:"chartRef"`
	Version     string                 `json:"version"`
	Values      map[string]interface{} `json:"values"`
	ReuseValues bool                   `json:"reuseValues"`
	// Helm v4 options
	WaitStrategy string `json:"waitStrategy"` // "none", "legacy", "watcher" - defaults to "legacy"
	Timeout      int    `json:"timeout"`      // Wait timeout in seconds, defaults to 300
}
