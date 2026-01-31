package app

import (
	"fmt"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// getDeploymentImage returns the first container image from the deployment spec
func getDeploymentImage(d *appsv1.Deployment) string {
	if len(d.Spec.Template.Spec.Containers) > 0 {
		return d.Spec.Template.Spec.Containers[0].Image
	}
	return ""
}

// getDeploymentReplicas returns the desired replica count
func getDeploymentReplicas(d *appsv1.Deployment) int32 {
	if d.Spec.Replicas != nil {
		return *d.Spec.Replicas
	}
	return 0
}

// mergeDeploymentLabels merges deployment and template labels, with deployment labels taking precedence
func mergeDeploymentLabels(d *appsv1.Deployment) map[string]string {
	labels := make(map[string]string)
	for k, v := range d.Labels {
		labels[k] = v
	}
	if tpl := d.Spec.Template; tpl.Labels != nil {
		for k, v := range tpl.Labels {
			if _, exists := labels[k]; !exists {
				labels[k] = v
			}
		}
	}
	return labels
}

// buildDeploymentInfo constructs a DeploymentInfo from a Deployment
func buildDeploymentInfo(d *appsv1.Deployment, now time.Time) DeploymentInfo {
	age := "-"
	if !d.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(d.CreationTimestamp.Time))
	}

	return DeploymentInfo{
		Name:      d.Name,
		Namespace: d.Namespace,
		Replicas:  getDeploymentReplicas(d),
		Ready:     d.Status.ReadyReplicas,
		Available: d.Status.AvailableReplicas,
		Age:       age,
		Image:     getDeploymentImage(d),
		Labels:    mergeDeploymentLabels(d),
	}
}

// GetDeployments returns all deployments in a namespace
func (a *App) GetDeployments(namespace string) ([]DeploymentInfo, error) {
	clientset, err := a.getClient()
	if err != nil {
		return nil, err
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
	go func() {
		for {
			time.Sleep(time.Second)
			if a.ctx == nil {
				continue
			}
			if nsList := a.getPollingNamespaces(); len(nsList) > 0 {
				all := a.collectDeployments(nsList)
				emitEvent(a.ctx, "deployments:update", all)
			}
		}
	}()
}

func (a *App) collectDeployments(nsList []string) []DeploymentInfo {
	var all []DeploymentInfo
	for _, ns := range nsList {
		if deploys, err := a.GetDeployments(ns); err == nil {
			all = append(all, deploys...)
		}
	}
	return all
}
