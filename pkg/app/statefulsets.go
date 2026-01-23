package app

import (
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// GetStatefulSets returns all statefulsets in a namespace
func (a *App) GetStatefulSets(namespace string) ([]StatefulSetInfo, error) {
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

		labels := map[string]string{}
		for k, v := range ss.Labels {
			labels[k] = v
		}
		if ss.Spec.Template.Labels != nil {
			for k, v := range ss.Spec.Template.Labels {
				if _, e := labels[k]; !e {
					labels[k] = v
				}
			}
		}
		result = append(result, StatefulSetInfo{
			Name:      ss.Name,
			Namespace: ss.Namespace,
			Replicas:  replicas,
			Ready:     ss.Status.ReadyReplicas,
			Age:       age,
			Image:     image,
			Labels:    labels,
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
			emitEvent(a.ctx, "statefulsets:update", all)
		}
	}()
}
