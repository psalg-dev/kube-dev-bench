package app

import (
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"
)

// buildDaemonSetInfo constructs a DaemonSetInfo from a DaemonSet
func buildDaemonSetInfo(ds *appsv1.DaemonSet, now time.Time) DaemonSetInfo {
	return DaemonSetInfo{
		Name:      ds.Name,
		Namespace: ds.Namespace,
		Desired:   ds.Status.DesiredNumberScheduled,
		Current:   ds.Status.NumberReady,
		Age:       FormatAge(ds.CreationTimestamp, now),
		Image:     ExtractFirstContainerImage(ds.Spec.Template.Spec),
		Labels:    MergeLabels(ds.Labels, ds.Spec.Template.Labels),
	}
}

// GetDaemonSets returns all daemonsets in a namespace
func (a *App) GetDaemonSets(namespace string) ([]DaemonSetInfo, error) {
	if factory, ok := a.getInformerNamespaceFactory(namespace); ok {
		items, err := factory.Apps().V1().DaemonSets().Lister().DaemonSets(namespace).List(labels.Everything())
		if err == nil {
			now := time.Now()
			result := make([]DaemonSetInfo, 0, len(items))
			for _, item := range items {
				result = append(result, buildDaemonSetInfo(item, now))
			}
			return result, nil
		}
	}

	return listResources(a, namespace,
		func(cs kubernetes.Interface, ns string, opts metav1.ListOptions) ([]appsv1.DaemonSet, error) {
			list, err := cs.AppsV1().DaemonSets(ns).List(a.ctx, opts)
			if err != nil {
				return nil, err
			}
			return list.Items, nil
		},
		buildDaemonSetInfo,
	)
}
