package app

import (
	"context"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/metrics/pkg/client/clientset/versioned"
)

// GetPodLogsPrevious retrieves logs from the previous container instance of a pod.
// This is useful when a container has crashed or been restarted.
func (a *App) GetPodLogsPrevious(namespace, podName, containerName string, lines int) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}

	var tailLines *int64
	if lines > 0 {
		v := int64(lines)
		tailLines = &v
	}

	previous := true
	logOptions := &corev1.PodLogOptions{
		TailLines: tailLines,
		Previous:  previous,
	}
	if containerName != "" {
		logOptions.Container = containerName
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	logCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()

	req := clientset.CoreV1().Pods(namespace).GetLogs(podName, logOptions)
	logs, err := req.DoRaw(logCtx)
	if err != nil {
		return "", fmt.Errorf("failed to get previous logs: %w", err)
	}

	return string(logs), nil
}

// PodMetrics represents CPU and memory usage for a pod
type PodMetrics struct {
	Namespace  string              `json:"namespace"`
	Name       string              `json:"name"`
	Containers []ContainerMetrics  `json:"containers"`
	CPU        string              `json:"cpu"`
	Memory     string              `json:"memory"`
}

// ContainerMetrics represents CPU and memory usage for a container
type ContainerMetrics struct {
	Name   string `json:"name"`
	CPU    string `json:"cpu"`
	Memory string `json:"memory"`
}

// NodeMetrics represents CPU and memory usage for a node
type NodeMetrics struct {
	Name   string `json:"name"`
	CPU    string `json:"cpu"`
	Memory string `json:"memory"`
}

// TopPods retrieves CPU and memory metrics for pods in a namespace
func (a *App) TopPods(namespace string) ([]PodMetrics, error) {
	// Get metrics clientset
	config, err := a.getRESTConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get kubernetes config: %w", err)
	}

	metricsClient, err := versioned.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create metrics client: %w", err)
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	podMetricsList, err := metricsClient.MetricsV1beta1().PodMetricses(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get pod metrics: %w", err)
	}

	result := make([]PodMetrics, 0, len(podMetricsList.Items))
	for _, pm := range podMetricsList.Items {
		podMetric := PodMetrics{
			Namespace:  pm.Namespace,
			Name:       pm.Name,
			Containers: make([]ContainerMetrics, 0, len(pm.Containers)),
		}

		var totalCPU, totalMemory int64
		for _, container := range pm.Containers {
			cpu := container.Usage.Cpu().MilliValue()
			memory := container.Usage.Memory().Value()
			
			totalCPU += cpu
			totalMemory += memory

			podMetric.Containers = append(podMetric.Containers, ContainerMetrics{
				Name:   container.Name,
				CPU:    formatCPU(cpu),
				Memory: formatMemory(memory),
			})
		}

		podMetric.CPU = formatCPU(totalCPU)
		podMetric.Memory = formatMemory(totalMemory)
		result = append(result, podMetric)
	}

	return result, nil
}

// TopNodes retrieves CPU and memory metrics for all nodes
func (a *App) TopNodes() ([]NodeMetrics, error) {
	// Get metrics clientset
	config, err := a.getRESTConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get kubernetes config: %w", err)
	}

	metricsClient, err := versioned.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create metrics client: %w", err)
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	nodeMetricsList, err := metricsClient.MetricsV1beta1().NodeMetricses().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get node metrics: %w", err)
	}

	result := make([]NodeMetrics, 0, len(nodeMetricsList.Items))
	for _, nm := range nodeMetricsList.Items {
		cpu := nm.Usage.Cpu().MilliValue()
		memory := nm.Usage.Memory().Value()

		result = append(result, NodeMetrics{
			Name:   nm.Name,
			CPU:    formatCPU(cpu),
			Memory: formatMemory(memory),
		})
	}

	return result, nil
}

// RolloutStatus represents the status of a deployment rollout
type RolloutStatus struct {
	Kind              string `json:"kind"`
	Name              string `json:"name"`
	Namespace         string `json:"namespace"`
	Status            string `json:"status"` // "in_progress", "complete", "failed", "unknown"
	Replicas          int32  `json:"replicas"`
	UpdatedReplicas   int32  `json:"updatedReplicas"`
	ReadyReplicas     int32  `json:"readyReplicas"`
	AvailableReplicas int32  `json:"availableReplicas"`
	Message           string `json:"message"`
}

// GetRolloutStatus returns the rollout status for a Deployment, StatefulSet, or DaemonSet
func (a *App) GetRolloutStatus(kind, namespace, name string) (*RolloutStatus, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	status := &RolloutStatus{
		Kind:      kind,
		Name:      name,
		Namespace: namespace,
		Status:    "unknown",
	}

	switch kind {
	case "Deployment":
		dep, err := clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to get deployment: %w", err)
		}

		status.Replicas = *dep.Spec.Replicas
		status.UpdatedReplicas = dep.Status.UpdatedReplicas
		status.ReadyReplicas = dep.Status.ReadyReplicas
		status.AvailableReplicas = dep.Status.AvailableReplicas

		// Check rollout status
		if dep.Status.ObservedGeneration < dep.Generation {
			status.Status = "in_progress"
			status.Message = "Waiting for deployment spec update to be observed"
		} else if dep.Status.UpdatedReplicas < *dep.Spec.Replicas {
			status.Status = "in_progress"
			status.Message = fmt.Sprintf("Waiting for replicas to be updated (%d/%d)", dep.Status.UpdatedReplicas, *dep.Spec.Replicas)
		} else if dep.Status.Replicas > dep.Status.UpdatedReplicas {
			status.Status = "in_progress"
			status.Message = "Waiting for old replicas to be terminated"
		} else if dep.Status.AvailableReplicas < dep.Status.UpdatedReplicas {
			status.Status = "in_progress"
			status.Message = fmt.Sprintf("Waiting for replicas to be available (%d/%d)", dep.Status.AvailableReplicas, dep.Status.UpdatedReplicas)
		} else {
			status.Status = "complete"
			status.Message = "Deployment successfully rolled out"
		}

		// Check for failed conditions
		for _, cond := range dep.Status.Conditions {
			if cond.Type == "Progressing" && cond.Status == corev1.ConditionFalse {
				status.Status = "failed"
				status.Message = cond.Message
				break
			}
		}

	case "StatefulSet":
		sts, err := clientset.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to get statefulset: %w", err)
		}

		status.Replicas = *sts.Spec.Replicas
		status.UpdatedReplicas = sts.Status.UpdatedReplicas
		status.ReadyReplicas = sts.Status.ReadyReplicas
		status.AvailableReplicas = sts.Status.AvailableReplicas

		if sts.Status.ObservedGeneration < sts.Generation {
			status.Status = "in_progress"
			status.Message = "Waiting for statefulset spec update to be observed"
		} else if sts.Status.UpdatedReplicas < *sts.Spec.Replicas {
			status.Status = "in_progress"
			status.Message = fmt.Sprintf("Waiting for replicas to be updated (%d/%d)", sts.Status.UpdatedReplicas, *sts.Spec.Replicas)
		} else if sts.Status.CurrentReplicas > sts.Status.UpdatedReplicas {
			status.Status = "in_progress"
			status.Message = "Waiting for old replicas to be terminated"
		} else if sts.Status.ReadyReplicas < *sts.Spec.Replicas {
			status.Status = "in_progress"
			status.Message = fmt.Sprintf("Waiting for replicas to be ready (%d/%d)", sts.Status.ReadyReplicas, *sts.Spec.Replicas)
		} else {
			status.Status = "complete"
			status.Message = "StatefulSet successfully rolled out"
		}

	case "DaemonSet":
		ds, err := clientset.AppsV1().DaemonSets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to get daemonset: %w", err)
		}

		status.Replicas = ds.Status.DesiredNumberScheduled
		status.UpdatedReplicas = ds.Status.UpdatedNumberScheduled
		status.ReadyReplicas = ds.Status.NumberReady
		status.AvailableReplicas = ds.Status.NumberAvailable

		if ds.Status.ObservedGeneration < ds.Generation {
			status.Status = "in_progress"
			status.Message = "Waiting for daemonset spec update to be observed"
		} else if ds.Status.UpdatedNumberScheduled < ds.Status.DesiredNumberScheduled {
			status.Status = "in_progress"
			status.Message = fmt.Sprintf("Waiting for daemon pods to be updated (%d/%d)", ds.Status.UpdatedNumberScheduled, ds.Status.DesiredNumberScheduled)
		} else if ds.Status.NumberAvailable < ds.Status.DesiredNumberScheduled {
			status.Status = "in_progress"
			status.Message = fmt.Sprintf("Waiting for daemon pods to be available (%d/%d)", ds.Status.NumberAvailable, ds.Status.DesiredNumberScheduled)
		} else {
			status.Status = "complete"
			status.Message = "DaemonSet successfully rolled out"
		}

	default:
		return nil, fmt.Errorf("unsupported kind: %s (must be Deployment, StatefulSet, or DaemonSet)", kind)
	}

	return status, nil
}

// RolloutHistoryRevision represents a single revision in rollout history
type RolloutHistoryRevision struct {
	Revision       int64  `json:"revision"`
	ChangeReason   string `json:"changeReason,omitempty"`
	CreationTime   string `json:"creationTime"`
	PodTemplate    string `json:"podTemplate,omitempty"`
}

// RolloutHistory represents the rollout history for a resource
type RolloutHistory struct {
	Kind       string                   `json:"kind"`
	Name       string                   `json:"name"`
	Namespace  string                   `json:"namespace"`
	Revisions  []RolloutHistoryRevision `json:"revisions"`
}

// GetRolloutHistory returns the rollout history for a Deployment, StatefulSet, or DaemonSet
func (a *App) GetRolloutHistory(kind, namespace, name string) (*RolloutHistory, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	history := &RolloutHistory{
		Kind:      kind,
		Name:      name,
		Namespace: namespace,
		Revisions: []RolloutHistoryRevision{},
	}

	switch kind {
	case "Deployment":
		// Get all ReplicaSets for this deployment
		dep, err := clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to get deployment: %w", err)
		}

		rsList, err := clientset.AppsV1().ReplicaSets(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list replicasets: %w", err)
		}

		// Filter ReplicaSets owned by this deployment
		for _, rs := range rsList.Items {
			if isOwnedByUID(&rs, dep.UID) {
				revision := getRevisionNumber(&rs)
				if revision > 0 {
					history.Revisions = append(history.Revisions, RolloutHistoryRevision{
						Revision:     revision,
						ChangeReason: rs.Annotations["kubernetes.io/change-cause"],
						CreationTime: rs.CreationTimestamp.Format(time.RFC3339),
					})
				}
			}
		}

	case "StatefulSet":
		// StatefulSets use ControllerRevisions
		sts, err := clientset.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to get statefulset: %w", err)
		}

		revList, err := clientset.AppsV1().ControllerRevisions(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list controller revisions: %w", err)
		}

		for _, rev := range revList.Items {
			if isOwnedByUID(&rev, sts.UID) {
				history.Revisions = append(history.Revisions, RolloutHistoryRevision{
					Revision:     rev.Revision,
					ChangeReason: rev.Annotations["kubernetes.io/change-cause"],
					CreationTime: rev.CreationTimestamp.Format(time.RFC3339),
				})
			}
		}

	case "DaemonSet":
		// DaemonSets use ControllerRevisions
		ds, err := clientset.AppsV1().DaemonSets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to get daemonset: %w", err)
		}

		revList, err := clientset.AppsV1().ControllerRevisions(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list controller revisions: %w", err)
		}

		for _, rev := range revList.Items {
			if isOwnedByUID(&rev, ds.UID) {
				history.Revisions = append(history.Revisions, RolloutHistoryRevision{
					Revision:     rev.Revision,
					ChangeReason: rev.Annotations["kubernetes.io/change-cause"],
					CreationTime: rev.CreationTimestamp.Format(time.RFC3339),
				})
			}
		}

	default:
		return nil, fmt.Errorf("unsupported kind: %s (must be Deployment, StatefulSet, or DaemonSet)", kind)
	}

	return history, nil
}

// Helper functions

func formatCPU(milliCPU int64) string {
	if milliCPU < 1000 {
		return fmt.Sprintf("%dm", milliCPU)
	}
	return fmt.Sprintf("%.2f", float64(milliCPU)/1000.0)
}

func formatMemory(bytes int64) string {
	const (
		KB = 1024
		MB = 1024 * KB
		GB = 1024 * MB
	)

	if bytes < KB {
		return fmt.Sprintf("%dB", bytes)
	} else if bytes < MB {
		return fmt.Sprintf("%dKi", bytes/KB)
	} else if bytes < GB {
		return fmt.Sprintf("%dMi", bytes/MB)
	}
	return fmt.Sprintf("%.2fGi", float64(bytes)/float64(GB))
}

func isOwnedByUID(obj metav1.Object, uid interface{}) bool {
	for _, owner := range obj.GetOwnerReferences() {
		if owner.UID == uid {
			return true
		}
	}
	return false
}

func getRevisionNumber(rs metav1.Object) int64 {
	if rev, ok := rs.GetAnnotations()["deployment.kubernetes.io/revision"]; ok {
		var revision int64
		fmt.Sscanf(rev, "%d", &revision)
		return revision
	}
	return 0
}
