package app

import (
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// buildStatefulSetInfo constructs a StatefulSetInfo from a StatefulSet
func buildStatefulSetInfo(ss *appsv1.StatefulSet, now time.Time) StatefulSetInfo {
	age := "-"
	if !ss.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(ss.CreationTimestamp.Time))
	}

	return StatefulSetInfo{
		Name:      ss.Name,
		Namespace: ss.Namespace,
		Replicas:  SafeReplicaCount(ss.Spec.Replicas),
		Ready:     ss.Status.ReadyReplicas,
		Age:       age,
		Image:     ExtractFirstContainerImage(ss.Spec.Template.Spec),
		Labels:    MergeLabels(SafeLabels(ss.Labels), SafeLabels(ss.Spec.Template.Labels)),
	}
}

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

	now := time.Now()
	result := make([]StatefulSetInfo, 0, len(list.Items))
	for _, ss := range list.Items {
		result = append(result, buildStatefulSetInfo(&ss, now))
	}

	return result, nil
}

// StartStatefulSetPolling emits statefulsets:update events periodically with the current statefulset list
func (a *App) StartStatefulSetPolling() {
	startResourcePolling(a, ResourcePollingConfig[StatefulSetInfo]{
		EventName: "statefulsets:update",
		FetchFn:   a.GetStatefulSets,
	})
}
