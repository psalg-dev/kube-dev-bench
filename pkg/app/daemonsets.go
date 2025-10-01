package app

import (
	"fmt"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// GetDaemonSets returns all daemonsets in a namespace
func (a *App) GetDaemonSets(namespace string) ([]DaemonSetInfo, error) {
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

	list, err := clientset.AppsV1().DaemonSets(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var result []DaemonSetInfo
	now := time.Now()

	for _, ds := range list.Items {
		age := "-"
		if ds.CreationTimestamp.Time != (time.Time{}) {
			dur := now.Sub(ds.CreationTimestamp.Time)
			age = formatDuration(dur)
		}

		image := ""
		if len(ds.Spec.Template.Spec.Containers) > 0 {
			image = ds.Spec.Template.Spec.Containers[0].Image
		}

		desired := ds.Status.DesiredNumberScheduled
		current := ds.Status.NumberReady // show ready pods as current to reflect health

		result = append(result, DaemonSetInfo{
			Name:      ds.Name,
			Namespace: ds.Namespace,
			Desired:   desired,
			Current:   current,
			Age:       age,
			Image:     image,
		})
	}

	return result, nil
}

// StartDaemonSetPolling emits daemonsets:update events periodically with the current daemonset list
func (a *App) StartDaemonSetPolling() {
	go func() {
		for {
			time.Sleep(time.Second)
			if a.ctx == nil || a.currentNamespace == "" {
				continue
			}
			list, err := a.GetDaemonSets(a.currentNamespace)
			if err == nil {
				wailsRuntime.EventsEmit(a.ctx, "daemonsets:update", list)
			}
		}
	}()
}
