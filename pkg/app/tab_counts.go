package app

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// TabCounts contains all tab-related counts for a resource
type TabCounts struct {
	Events    int `json:"events"`
	Pods      int `json:"pods"`
	Consumers int `json:"consumers"`
	Data      int `json:"data"`
	History   int `json:"history"`
	PVCs      int `json:"pvcs"`
	Endpoints int `json:"endpoints"`
	Rules     int `json:"rules"`
}

// GetResourceEventsCount returns the count of events for a resource
func (a *App) GetResourceEventsCount(namespace, kind, name string) (int, error) {
	events, err := a.GetResourceEvents(namespace, kind, name)
	if err != nil {
		return 0, err
	}
	return len(events), nil
}

// GetPodsCountForResource returns the count of pods owned by a resource
func (a *App) GetPodsCountForResource(namespace, ownerKind, ownerName string) (int, error) {
	var podCount int

	switch ownerKind {
	case "Deployment":
		detail, detailErr := a.GetDeploymentDetail(namespace, ownerName)
		if detailErr != nil {
			return 0, detailErr
		}
		podCount = len(detail.Pods)
	case "StatefulSet":
		detail, detailErr := a.GetStatefulSetDetail(namespace, ownerName)
		if detailErr != nil {
			return 0, detailErr
		}
		podCount = len(detail.Pods)
	case "DaemonSet":
		detail, detailErr := a.GetDaemonSetDetail(namespace, ownerName)
		if detailErr != nil {
			return 0, detailErr
		}
		podCount = len(detail.Pods)
	case "ReplicaSet":
		detail, detailErr := a.GetReplicaSetDetail(namespace, ownerName)
		if detailErr != nil {
			return 0, detailErr
		}
		podCount = len(detail.Pods)
	case "Job":
		detail, detailErr := a.GetJobDetail(namespace, ownerName)
		if detailErr != nil {
			return 0, detailErr
		}
		podCount = len(detail.Pods)
	default:
		return 0, fmt.Errorf("unsupported owner kind: %s", ownerKind)
	}

	return podCount, nil
}

// GetConfigMapConsumersCount returns the count of workloads using a ConfigMap
func (a *App) GetConfigMapConsumersCount(namespace, configMapName string) (int, error) {
	consumers, err := a.GetConfigMapConsumers(namespace, configMapName)
	if err != nil {
		return 0, err
	}
	return len(consumers), nil
}

// GetSecretConsumersCount returns the count of workloads using a Secret
func (a *App) GetSecretConsumersCount(namespace, secretName string) (int, error) {
	consumers, err := a.GetSecretConsumers(namespace, secretName)
	if err != nil {
		return 0, err
	}
	return len(consumers), nil
}

// GetPVCConsumersCount returns the count of pods using a PVC
func (a *App) GetPVCConsumersCount(namespace, pvcName string) (int, error) {
	consumers, err := a.GetPVCConsumers(namespace, pvcName)
	if err != nil {
		return 0, err
	}
	return len(consumers), nil
}

// GetCronJobHistoryCount returns the count of Jobs created by a CronJob
func (a *App) GetCronJobHistoryCount(namespace, cronJobName string) (int, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return 0, err
	}

	jobs, err := clientset.BatchV1().Jobs(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return 0, err
	}

	count := 0
	for _, job := range jobs.Items {
		for _, ownerRef := range job.OwnerReferences {
			if ownerRef.Kind == "CronJob" && ownerRef.Name == cronJobName {
				count++
				break
			}
		}
	}

	return count, nil
}

// GetServiceEndpointsCount returns the count of endpoints for a Service
func (a *App) GetServiceEndpointsCount(namespace, serviceName string) (int, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return 0, err
	}

	endpoints, err := clientset.CoreV1().Endpoints(namespace).Get(a.ctx, serviceName, metav1.GetOptions{})
	if err != nil {
		return 0, err
	}

	count := 0
	for _, subset := range endpoints.Subsets {
		count += len(subset.Addresses) + len(subset.NotReadyAddresses)
	}

	return count, nil
}

// GetConfigMapDataCount returns the count of data keys in a ConfigMap
func (a *App) GetConfigMapDataCount(namespace, configMapName string) (int, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return 0, err
	}

	cm, err := clientset.CoreV1().ConfigMaps(namespace).Get(a.ctx, configMapName, metav1.GetOptions{})
	if err != nil {
		return 0, err
	}

	return len(cm.Data) + len(cm.BinaryData), nil
}

// GetSecretDataCount returns the count of data keys in a Secret
func (a *App) GetSecretDataCount(namespace, secretName string) (int, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return 0, err
	}

	secret, err := clientset.CoreV1().Secrets(namespace).Get(a.ctx, secretName, metav1.GetOptions{})
	if err != nil {
		return 0, err
	}

	return len(secret.Data) + len(secret.StringData), nil
}

// GetIngressRulesCount returns the count of rules in an Ingress
func (a *App) GetIngressRulesCount(namespace, ingressName string) (int, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return 0, err
	}

	ingress, err := clientset.NetworkingV1().Ingresses(namespace).Get(a.ctx, ingressName, metav1.GetOptions{})
	if err != nil {
		return 0, err
	}

	count := 0
	for _, rule := range ingress.Spec.Rules {
		if rule.HTTP != nil {
			count += len(rule.HTTP.Paths)
		} else {
			count++ // count the rule itself if no HTTP paths
		}
	}

	return count, nil
}

// GetStatefulSetPVCsCount returns the count of PVCs for a StatefulSet
func (a *App) GetStatefulSetPVCsCount(namespace, statefulSetName string) (int, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return 0, err
	}

	// Get PVCs with the StatefulSet name prefix
	pvcs, err := clientset.CoreV1().PersistentVolumeClaims(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return 0, err
	}

	count := 0
	prefix := statefulSetName + "-"
	for _, pvc := range pvcs.Items {
		// StatefulSet PVCs follow the pattern: <pvc-template-name>-<statefulset-name>-<ordinal>
		// We check if the PVC name contains the statefulset name
		if len(pvc.Name) > len(prefix) && pvc.Name[:len(prefix)] == prefix {
			count++
		}
		// Also check owner references
		for _, ownerRef := range pvc.OwnerReferences {
			if ownerRef.Kind == "StatefulSet" && ownerRef.Name == statefulSetName {
				count++
				break
			}
		}
	}

	return count, nil
}

// getWorkloadPodCount gets pod count for workload resources
func (a *App) getWorkloadPodCount(namespace, kind, name string) int {
	if podsCount, err := a.GetPodsCountForResource(namespace, kind, name); err == nil {
		return podsCount
	}
	return 0
}

// getStatefulSetCounts gets counts specific to StatefulSet
func (a *App) getStatefulSetCounts(namespace, name string) (pods, pvcs int) {
	pods = a.getWorkloadPodCount(namespace, "StatefulSet", name)
	if pvcsCount, err := a.GetStatefulSetPVCsCount(namespace, name); err == nil {
		pvcs = pvcsCount
	}
	return
}

// getConfigMapCounts gets counts specific to ConfigMap
func (a *App) getConfigMapCounts(namespace, name string) (consumers, data int) {
	if c, err := a.GetConfigMapConsumersCount(namespace, name); err == nil {
		consumers = c
	}
	if d, err := a.GetConfigMapDataCount(namespace, name); err == nil {
		data = d
	}
	return
}

// getSecretCounts gets counts specific to Secret
func (a *App) getSecretCounts(namespace, name string) (consumers, data int) {
	if c, err := a.GetSecretConsumersCount(namespace, name); err == nil {
		consumers = c
	}
	if d, err := a.GetSecretDataCount(namespace, name); err == nil {
		data = d
	}
	return
}

// GetAllTabCounts returns all relevant tab counts for a resource in a single call
func (a *App) GetAllTabCounts(namespace, kind, name string) (TabCounts, error) {
	counts := TabCounts{}

	// Events count (applicable to all resources)
	if eventsCount, err := a.GetResourceEventsCount(namespace, kind, name); err == nil {
		counts.Events = eventsCount
	}

	// Resource-specific counts
	switch kind {
	case "Deployment", "DaemonSet", "ReplicaSet", "Job":
		counts.Pods = a.getWorkloadPodCount(namespace, kind, name)

	case "StatefulSet":
		counts.Pods, counts.PVCs = a.getStatefulSetCounts(namespace, name)

	case "CronJob":
		if historyCount, err := a.GetCronJobHistoryCount(namespace, name); err == nil {
			counts.History = historyCount
		}

	case "ConfigMap":
		counts.Consumers, counts.Data = a.getConfigMapCounts(namespace, name)

	case "Secret":
		counts.Consumers, counts.Data = a.getSecretCounts(namespace, name)

	case "PersistentVolumeClaim":
		if consumersCount, err := a.GetPVCConsumersCount(namespace, name); err == nil {
			counts.Consumers = consumersCount
		}

	case "Service":
		if endpointsCount, err := a.GetServiceEndpointsCount(namespace, name); err == nil {
			counts.Endpoints = endpointsCount
		}

	case "Ingress":
		if rulesCount, err := a.GetIngressRulesCount(namespace, name); err == nil {
			counts.Rules = rulesCount
		}
	}

	return counts, nil
}
