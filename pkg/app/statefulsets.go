package app

import (
	"fmt"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// GetStatefulSets returns all statefulsets in a namespace
func (a *App) GetStatefulSets(namespace string) ([]StatefulSetInfo, error) {
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

	list, err := clientset.AppsV1().StatefulSets(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var result []StatefulSetInfo
	now := time.Now()

	for _, ss := range list.Items {
		age := "-"
		if ss.CreationTimestamp.Time != (time.Time{}) {
			dur := now.Sub(ss.CreationTimestamp.Time)
			age = formatDuration(dur)
		}

		image := ""
		if len(ss.Spec.Template.Spec.Containers) > 0 {
			image = ss.Spec.Template.Spec.Containers[0].Image
		}

		replicas := int32(0)
		if ss.Spec.Replicas != nil {
			replicas = *ss.Spec.Replicas
		}

		result = append(result, StatefulSetInfo{
			Name:      ss.Name,
			Namespace: ss.Namespace,
			Replicas:  replicas,
			Ready:     ss.Status.ReadyReplicas,
			Age:       age,
			Image:     image,
		})
	}

	return result, nil
}

// StartStatefulSetPolling emits statefulsets:update events periodically with the current statefulset list
func (a *App) StartStatefulSetPolling() {
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
			var all []StatefulSetInfo
			for _, ns := range nsList {
				list, err := a.GetStatefulSets(ns)
				if err != nil {
					continue
				}
				all = append(all, list...)
			}
			wailsRuntime.EventsEmit(a.ctx, "statefulsets:update", all)
		}
	}()
}
