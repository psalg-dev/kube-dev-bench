package app

import (
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// GetReplicaSets returns all replicasets in a namespace
func (a *App) GetReplicaSets(namespace string) ([]ReplicaSetInfo, error) {
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

	list, err := clientset.AppsV1().ReplicaSets(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var result []ReplicaSetInfo
	now := time.Now()

	for _, rs := range list.Items {
		age := "-"
		if rs.CreationTimestamp.Time != (time.Time{}) {
			dur := now.Sub(rs.CreationTimestamp.Time)
			age = formatDuration(dur)
		}

		image := ""
		if len(rs.Spec.Template.Spec.Containers) > 0 {
			image = rs.Spec.Template.Spec.Containers[0].Image
		}

		replicas := int32(0)
		if rs.Spec.Replicas != nil {
			replicas = *rs.Spec.Replicas
		}

		labels := map[string]string{}
		for k, v := range rs.Labels {
			labels[k] = v
		}
		if rs.Spec.Template.Labels != nil {
			for k, v := range rs.Spec.Template.Labels {
				if _, e := labels[k]; !e {
					labels[k] = v
				}
			}
		}
		result = append(result, ReplicaSetInfo{
			Name:      rs.Name,
			Namespace: rs.Namespace,
			Replicas:  replicas,
			Ready:     rs.Status.ReadyReplicas,
			Age:       age,
			Image:     image,
			Labels:    labels,
		})
	}

	return result, nil
}

// StartReplicaSetPolling emits replicasets:update events periodically with the current replicaset list
func (a *App) StartReplicaSetPolling() {
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
			var all []ReplicaSetInfo
			for _, ns := range nsList {
				list, err := a.GetReplicaSets(ns)
				if err != nil {
					continue
				}
				all = append(all, list...)
			}
			emitEvent(a.ctx, "replicasets:update", all)
		}
	}()
}
