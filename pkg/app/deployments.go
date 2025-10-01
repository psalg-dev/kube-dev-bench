package app

import (
	"fmt"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// GetDeployments returns all deployments in a namespace
func (a *App) GetDeployments(namespace string) ([]DeploymentInfo, error) {
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return nil, err
	}
	if a.currentKubeContext == "" {
		return nil, fmt.Errorf("Kein Kontext gewählt")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return nil, err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
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
			dur := now.Sub(deployment.CreationTimestamp.Time)
			age = formatDuration(dur)
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
			if a.ctx == nil || a.currentNamespace == "" {
				continue
			}
			deploys, err := a.GetDeployments(a.currentNamespace)
			if err == nil {
				wailsRuntime.EventsEmit(a.ctx, "deployments:update", deploys)
			}
		}
	}()
}
