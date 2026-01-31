package app

import (
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// getStatefulSetImage returns the first container image from the statefulset spec
func getStatefulSetImage(ss *appsv1.StatefulSet) string {
	if len(ss.Spec.Template.Spec.Containers) > 0 {
		return ss.Spec.Template.Spec.Containers[0].Image
	}
	return ""
}

// getStatefulSetReplicas returns the desired replica count
func getStatefulSetReplicas(ss *appsv1.StatefulSet) int32 {
	if ss.Spec.Replicas != nil {
		return *ss.Spec.Replicas
	}
	return 0
}

// mergeStatefulSetLabels merges statefulset and template labels
func mergeStatefulSetLabels(ss *appsv1.StatefulSet) map[string]string {
	labels := make(map[string]string)
	for k, v := range ss.Labels {
		labels[k] = v
	}
	if ss.Spec.Template.Labels != nil {
		for k, v := range ss.Spec.Template.Labels {
			if _, exists := labels[k]; !exists {
				labels[k] = v
			}
		}
	}
	return labels
}

// buildStatefulSetInfo constructs a StatefulSetInfo from a StatefulSet
func buildStatefulSetInfo(ss *appsv1.StatefulSet, now time.Time) StatefulSetInfo {
	age := "-"
	if !ss.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(ss.CreationTimestamp.Time))
	}

	return StatefulSetInfo{
		Name:      ss.Name,
		Namespace: ss.Namespace,
		Replicas:  getStatefulSetReplicas(ss),
		Ready:     ss.Status.ReadyReplicas,
		Age:       age,
		Image:     getStatefulSetImage(ss),
		Labels:    mergeStatefulSetLabels(ss),
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
	go func() {
		for {
			time.Sleep(time.Second)
			if a.ctx == nil {
				continue
			}
			if nsList := a.getPollingNamespaces(); len(nsList) > 0 {
				all := a.collectStatefulSets(nsList)
				emitEvent(a.ctx, "statefulsets:update", all)
			}
		}
	}()
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
