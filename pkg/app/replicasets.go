package app

import (
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"
)

// buildReplicaSetInfo constructs a ReplicaSetInfo from a ReplicaSet
func buildReplicaSetInfo(rs *appsv1.ReplicaSet, now time.Time) ReplicaSetInfo {
	return ReplicaSetInfo{
		Name:      rs.Name,
		Namespace: rs.Namespace,
		Replicas:  SafeReplicaCount(rs.Spec.Replicas),
		Ready:     rs.Status.ReadyReplicas,
		Age:       FormatAge(rs.CreationTimestamp, now),
		Image:     ExtractFirstContainerImage(rs.Spec.Template.Spec),
		Labels:    MergeLabels(rs.Labels, rs.Spec.Template.Labels),
	}
}

// GetReplicaSets returns all replicasets in a namespace
func (a *App) GetReplicaSets(namespace string) ([]ReplicaSetInfo, error) {
	if factory, ok := a.getInformerNamespaceFactory(namespace); ok {
		items, err := factory.Apps().V1().ReplicaSets().Lister().ReplicaSets(namespace).List(labels.Everything())
		if err == nil {
			now := time.Now()
			result := make([]ReplicaSetInfo, 0, len(items))
			for _, item := range items {
				result = append(result, buildReplicaSetInfo(item, now))
			}
			return result, nil
		}
	}

	return listResources(a, namespace,
		func(cs kubernetes.Interface, ns string, opts metav1.ListOptions) ([]appsv1.ReplicaSet, error) {
			list, err := cs.AppsV1().ReplicaSets(ns).List(a.ctx, opts)
			if err != nil {
				return nil, err
			}
			return list.Items, nil
		},
		buildReplicaSetInfo,
	)
}
