package app

import (
	"fmt"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// buildDeploymentInfo constructs a DeploymentInfo from a Deployment
func buildDeploymentInfo(d *appsv1.Deployment, now time.Time) DeploymentInfo {
	age := "-"
	if !d.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(d.CreationTimestamp.Time))
	}

	return DeploymentInfo{
		Name:      d.Name,
		Namespace: d.Namespace,
		Replicas:  SafeReplicaCount(d.Spec.Replicas),
		Ready:     d.Status.ReadyReplicas,
		Available: d.Status.AvailableReplicas,
		Age:       age,
		Image:     ExtractFirstContainerImage(d.Spec.Template.Spec),
		Labels:    MergeLabels(SafeLabels(d.Labels), SafeLabels(d.Spec.Template.Labels)),
	}
}

// GetDeployments returns all deployments in a namespace
func (a *App) GetDeployments(namespace string) ([]DeploymentInfo, error) {
	var clientset kubernetes.Interface
	var err error
	if a.testClientset != nil {
		clientset = a.testClientset.(kubernetes.Interface)
	} else {
		clientset, err = a.getKubernetesClient()
		if err != nil {
			return nil, err
		}
	}
	deployments, err := clientset.AppsV1().Deployments(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]DeploymentInfo, 0, len(deployments.Items))
	for _, deployment := range deployments.Items {
		result = append(result, buildDeploymentInfo(&deployment, now))
	}

	return result, nil
}

// formatDuration formats a duration into a human-readable string
func formatDuration(d time.Duration) string {
	// Guard against negative durations (can happen with slight clock skew between host & cluster)
	if d < 0 {
		// Treat future timestamps as 0s old instead of showing a negative age
		d = 0
	}
	days := int(d.Hours() / 24)
	hours := int(d.Hours()) % 24
	minutes := int(d.Minutes()) % 60

	if days > 0 {
		return fmt.Sprintf("%dd", days)
	} else if hours > 0 {
		return fmt.Sprintf("%dh", hours)
	} else if minutes > 0 {
		return fmt.Sprintf("%dm", minutes)
	} else {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
}

// StartDeploymentPolling emits deployments:update events every second with the current deployment list
func (a *App) StartDeploymentPolling() {
	startResourcePolling(a, ResourcePollingConfig[DeploymentInfo]{
		EventName: "deployments:update",
		FetchFn:   a.GetDeployments,
	})
}
