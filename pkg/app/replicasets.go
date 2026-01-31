package app

import (
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// getReplicaSetImage returns the first container image from the replicaset spec
func getReplicaSetImage(rs *appsv1.ReplicaSet) string {
	if len(rs.Spec.Template.Spec.Containers) > 0 {
		return rs.Spec.Template.Spec.Containers[0].Image
	}
	return ""
}

// getReplicaSetReplicas returns the desired replica count
func getReplicaSetReplicas(rs *appsv1.ReplicaSet) int32 {
	if rs.Spec.Replicas != nil {
		return *rs.Spec.Replicas
	}
	return 0
}

// mergeReplicaSetLabels merges replicaset and template labels
func mergeReplicaSetLabels(rs *appsv1.ReplicaSet) map[string]string {
	labels := make(map[string]string)
	for k, v := range rs.Labels {
		labels[k] = v
	}
	if rs.Spec.Template.Labels != nil {
		for k, v := range rs.Spec.Template.Labels {
			if _, exists := labels[k]; !exists {
				labels[k] = v
			}
		}
	}
	return labels
}

// buildReplicaSetInfo constructs a ReplicaSetInfo from a ReplicaSet
func buildReplicaSetInfo(rs *appsv1.ReplicaSet, now time.Time) ReplicaSetInfo {
	age := "-"
	if !rs.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(rs.CreationTimestamp.Time))
	}

	return ReplicaSetInfo{
		Name:      rs.Name,
		Namespace: rs.Namespace,
		Replicas:  getReplicaSetReplicas(rs),
		Ready:     rs.Status.ReadyReplicas,
		Age:       age,
		Image:     getReplicaSetImage(rs),
		Labels:    mergeReplicaSetLabels(rs),
	}
}

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

	now := time.Now()
	result := make([]ReplicaSetInfo, 0, len(list.Items))
	for _, rs := range list.Items {
		result = append(result, buildReplicaSetInfo(&rs, now))
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
			if nsList := a.getPollingNamespaces(); len(nsList) > 0 {
				all := a.collectReplicaSets(nsList)
				emitEvent(a.ctx, "replicasets:update", all)
			}
		}
	}()
}

func (a *App) collectReplicaSets(nsList []string) []ReplicaSetInfo {
	var all []ReplicaSetInfo
	for _, ns := range nsList {
		if list, err := a.GetReplicaSets(ns); err == nil {
			all = append(all, list...)
		}
	}
	return all
}
