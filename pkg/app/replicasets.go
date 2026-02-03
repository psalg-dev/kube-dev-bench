package app

import (
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// buildReplicaSetInfo constructs a ReplicaSetInfo from a ReplicaSet
func buildReplicaSetInfo(rs *appsv1.ReplicaSet, now time.Time) ReplicaSetInfo {
	age := "-"
	if !rs.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(rs.CreationTimestamp.Time))
	}

	return ReplicaSetInfo{
		Name:      rs.Name,
		Namespace: rs.Namespace,
		Replicas:  SafeReplicaCount(rs.Spec.Replicas),
		Ready:     rs.Status.ReadyReplicas,
		Age:       age,
		Image:     ExtractFirstContainerImage(rs.Spec.Template.Spec),
		Labels:    MergeLabels(SafeLabels(rs.Labels), SafeLabels(rs.Spec.Template.Labels)),
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
	startResourcePolling(a, ResourcePollingConfig[ReplicaSetInfo]{
		EventName: "replicasets:update",
		FetchFn:   a.GetReplicaSets,
	})
}
