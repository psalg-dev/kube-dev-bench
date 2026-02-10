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
	return DeploymentInfo{
		Name:      d.Name,
		Namespace: d.Namespace,
		Replicas:  SafeReplicaCount(d.Spec.Replicas),
		Ready:     d.Status.ReadyReplicas,
		Available: d.Status.AvailableReplicas,
		Age:       FormatAge(d.CreationTimestamp, now),
		Image:     ExtractFirstContainerImage(d.Spec.Template.Spec),
		Labels:    MergeLabels(d.Labels, d.Spec.Template.Labels),
	}
}

// GetDeployments returns all deployments in a namespace
func (a *App) GetDeployments(namespace string) ([]DeploymentInfo, error) {
	return listResources(a, namespace,
		func(cs kubernetes.Interface, ns string, opts metav1.ListOptions) ([]appsv1.Deployment, error) {
			list, err := cs.AppsV1().Deployments(ns).List(a.ctx, opts)
			if err != nil {
				return nil, err
			}
			return list.Items, nil
		},
		buildDeploymentInfo,
	)
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
