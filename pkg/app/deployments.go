package app

import (
	"fmt"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// GetDeployments returns all deployments in a namespace
func (a *App) GetDeployments(namespace string) ([]DeploymentInfo, error) {
	clientset, err := a.getClientsetForResource()
	if err != nil {
		return nil, err
	}

	deployments, err := clientset.AppsV1().Deployments(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var result []DeploymentInfo
	now := time.Now()

	for _, deployment := range deployments.Items {
		deploymentInfo := a.buildDeploymentInfo(deployment, now)
		result = append(result, deploymentInfo)
	}

	return result, nil
}

// getClientsetForResource returns a kubernetes clientset for resource queries
func (a *App) getClientsetForResource() (kubernetes.Interface, error) {
	if a.testClientset != nil {
		return a.testClientset.(kubernetes.Interface), nil
	}
	return a.getKubernetesClient()
}

// buildDeploymentInfo builds DeploymentInfo from a deployment resource
func (a *App) buildDeploymentInfo(deployment appsv1.Deployment, now time.Time) DeploymentInfo {
	age := "-"
	if deployment.CreationTimestamp.Time != (time.Time{}) {
		age = formatDuration(now.Sub(deployment.CreationTimestamp.Time))
	}

	// Get the first container image from the deployment spec
	image := ""
	if len(deployment.Spec.Template.Spec.Containers) > 0 {
		image = deployment.Spec.Template.Spec.Containers[0].Image
	}

	replicas := int32(0)
	if deployment.Spec.Replicas != nil {
		replicas = *deployment.Spec.Replicas
	}

	deploymentInfo := DeploymentInfo{
		Name:      deployment.Name,
		Namespace: deployment.Namespace,
		Replicas:  replicas,
		Ready:     deployment.Status.ReadyReplicas,
		Available: deployment.Status.AvailableReplicas,
		Age:       age,
		Image:     image,
		Labels:    mergeDeploymentLabels(deployment),
	}

	return deploymentInfo
}

// mergeDeploymentLabels merges deployment and template labels
func mergeDeploymentLabels(deployment appsv1.Deployment) map[string]string {
	labels := map[string]string{}

	// Add deployment labels first
	for k, v := range deployment.Labels {
		labels[k] = v
	}

	// Add template labels (without overwriting existing)
	if deployment.Spec.Template.Labels != nil {
		for k, v := range deployment.Spec.Template.Labels {
			if _, exists := labels[k]; !exists {
				labels[k] = v
			}
		}
	}

	return labels
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
	go func() {
		for {
			time.Sleep(time.Second)
			if a.ctx == nil {
				continue
			}
			nsList := a.preferredNamespaces
			if len(nsList) == 0 && a.currentNamespace != "" {
				nsList = []string{a.currentNamespace}
			}
			if len(nsList) == 0 {
				continue
			}
			var all []DeploymentInfo
			for _, ns := range nsList {
				deploys, err := a.GetDeployments(ns)
				if err != nil {
					continue
				}
				all = append(all, deploys...)
			}
			emitEvent(a.ctx, "deployments:update", all)
		}
	}()
}
