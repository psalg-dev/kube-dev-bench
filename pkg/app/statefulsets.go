package app

import (
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
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
	if factory, ok := a.getInformerNamespaceFactory(namespace); ok {
		items, err := factory.Apps().V1().StatefulSets().Lister().StatefulSets(namespace).List(labels.Everything())
		if err == nil {
			now := time.Now()
			result := make([]StatefulSetInfo, 0, len(items))
			for _, item := range items {
				result = append(result, buildStatefulSetInfo(item, now))
			}
			return result, nil
		}
	}

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

func (a *App) collectStatefulSets(nsList []string) []StatefulSetInfo {
	var all []StatefulSetInfo
	for _, ns := range nsList {
		if list, err := a.GetStatefulSets(ns); err == nil {
			all = append(all, list...)
		}
	}
	return all
}
