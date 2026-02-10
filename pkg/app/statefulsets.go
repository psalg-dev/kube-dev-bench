package app

import (
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// buildStatefulSetInfo constructs a StatefulSetInfo from a StatefulSet
func buildStatefulSetInfo(ss *appsv1.StatefulSet, now time.Time) StatefulSetInfo {
	return StatefulSetInfo{
		Name:      ss.Name,
		Namespace: ss.Namespace,
		Replicas:  SafeReplicaCount(ss.Spec.Replicas),
		Ready:     ss.Status.ReadyReplicas,
		Age:       FormatAge(ss.CreationTimestamp, now),
		Image:     ExtractFirstContainerImage(ss.Spec.Template.Spec),
		Labels:    MergeLabels(ss.Labels, ss.Spec.Template.Labels),
	}
}

// GetStatefulSets returns all statefulsets in a namespace
func (a *App) GetStatefulSets(namespace string) ([]StatefulSetInfo, error) {
	return listResources(a, namespace,
		func(cs kubernetes.Interface, ns string, opts metav1.ListOptions) ([]appsv1.StatefulSet, error) {
			list, err := cs.AppsV1().StatefulSets(ns).List(a.ctx, opts)
			if err != nil {
				return nil, err
			}
			return list.Items, nil
		},
		buildStatefulSetInfo,
	)
}
