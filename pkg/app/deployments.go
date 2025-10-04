package app

import (
	"fmt"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GetDeployments returns all deployments in a namespace
func (a *App) GetDeployments(namespace string) ([]DeploymentInfo, error) {
	clientset, err := a.getKubernetesClient()
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
			Labels:    map[string]string{},
		}
		// Merge labels: deployment metadata first, then template labels (without overwriting existing)
		if len(deployment.Labels) > 0 {
			for k, v := range deployment.Labels {
				deploymentInfo.Labels[k] = v
			}
		}
		if tpl := deployment.Spec.Template; tpl.Labels != nil {
			for k, v := range tpl.Labels {
				if _, exists := deploymentInfo.Labels[k]; !exists { // keep deployment-level value precedence
					deploymentInfo.Labels[k] = v
				}
			}
		}
		result = append(result, deploymentInfo)
	}

	return result, nil
}

// formatDuration formats a duration into a human-readable string
func formatDuration(d time.Duration) string {
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
			wailsRuntime.EventsEmit(a.ctx, "deployments:update", all)
		}
	}()
}
