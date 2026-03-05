package app

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GetOverview returns counts of Pods, Deployments and Jobs in a namespace
func (a *App) GetOverview(namespace string) (OverviewInfo, error) {
	clientset, err := a.getClient()
	if err != nil {
		return OverviewInfo{}, err
	}

	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return OverviewInfo{}, err
	}
	deployments, err := clientset.AppsV1().Deployments(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return OverviewInfo{}, err
	}
	jobs, err := clientset.BatchV1().Jobs(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return OverviewInfo{}, err
	}
	return OverviewInfo{Pods: len(pods.Items), Deployments: len(deployments.Items), Jobs: len(jobs.Items)}, nil
}
