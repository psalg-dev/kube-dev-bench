package app

import (
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// getDaemonSetImage returns the first container image from the daemonset spec
func getDaemonSetImage(ds *appsv1.DaemonSet) string {
	if len(ds.Spec.Template.Spec.Containers) > 0 {
		return ds.Spec.Template.Spec.Containers[0].Image
	}
	return ""
}

// mergeDaemonSetLabels merges daemonset and template labels
func mergeDaemonSetLabels(ds *appsv1.DaemonSet) map[string]string {
	labels := make(map[string]string)
	for k, v := range ds.Labels {
		labels[k] = v
	}
	if ds.Spec.Template.Labels != nil {
		for k, v := range ds.Spec.Template.Labels {
			if _, exists := labels[k]; !exists {
				labels[k] = v
			}
		}
	}
	return labels
}

// buildDaemonSetInfo constructs a DaemonSetInfo from a DaemonSet
func buildDaemonSetInfo(ds *appsv1.DaemonSet, now time.Time) DaemonSetInfo {
	age := "-"
	if !ds.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(ds.CreationTimestamp.Time))
	}

	return DaemonSetInfo{
		Name:      ds.Name,
		Namespace: ds.Namespace,
		Desired:   ds.Status.DesiredNumberScheduled,
		Current:   ds.Status.NumberReady,
		Age:       age,
		Image:     getDaemonSetImage(ds),
		Labels:    mergeDaemonSetLabels(ds),
	}
}

// GetDaemonSets returns all daemonsets in a namespace
func (a *App) GetDaemonSets(namespace string) ([]DaemonSetInfo, error) {
	clientset, err := a.getClient()
	if err != nil {
		return nil, err
	}

	list, err := clientset.AppsV1().DaemonSets(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]DaemonSetInfo, 0, len(list.Items))
	for _, ds := range list.Items {
		result = append(result, buildDaemonSetInfo(&ds, now))
	}

	return result, nil
}

// StartDaemonSetPolling emits daemonsets:update events periodically with the current daemonset list
func (a *App) StartDaemonSetPolling() {
	go func() {
		for {
			time.Sleep(time.Second)
			if a.ctx == nil {
				continue
			}
			if nsList := a.getPollingNamespaces(); len(nsList) > 0 {
				all := a.collectDaemonSets(nsList)
				emitEvent(a.ctx, "daemonsets:update", all)
			}
		}
	}()
}

func (a *App) collectDaemonSets(nsList []string) []DaemonSetInfo {
	var all []DaemonSetInfo
	for _, ns := range nsList {
		if list, err := a.GetDaemonSets(ns); err == nil {
			all = append(all, list...)
		}
	}
	return all
}
