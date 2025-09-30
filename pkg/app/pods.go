package app

import (
	"fmt"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// GetRunningPods returns all running pods (name, restarts, uptime) in a namespace
func (a *App) GetRunningPods(namespace string) ([]PodInfo, error) {
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
	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	var result []PodInfo
	now := time.Now()
	for _, pod := range pods.Items {
		if pod.Status.Phase == "Running" {
			uptime := "-"
			startTimeStr := ""
			if pod.Status.StartTime != nil {
				dur := now.Sub(pod.Status.StartTime.Time)
				uptime = dur.Truncate(time.Second).String()
				startTimeStr = pod.Status.StartTime.Time.UTC().Format(time.RFC3339)
			}
			restarts := int32(0)
			if pod.Status.ContainerStatuses != nil {
				for _, cs := range pod.Status.ContainerStatuses {
					restarts += cs.RestartCount
				}
			}
			result = append(result, PodInfo{Name: pod.Name, Restarts: restarts, Uptime: uptime, StartTime: startTimeStr})
		}
	}
	return result, nil
}

// StartPodPolling emits pods:update events every second with the current pod list
func (a *App) StartPodPolling() {
	go func() {
		for {
			time.Sleep(time.Second)
			if a.ctx == nil || a.currentNamespace == "" {
				continue
			}
			pods, err := a.GetRunningPods(a.currentNamespace)
			if err == nil {
				runtime.EventsEmit(a.ctx, "pods:update", pods)
			}
		}
	}()
}
