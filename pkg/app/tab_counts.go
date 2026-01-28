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
	getPods := map[string]func() (int, error){
		"Deployment": func() (int, error) {
			detail, err := a.GetDeploymentDetail(namespace, ownerName)
			if err != nil {
				return 0, err
			}
			return len(detail.Pods), nil
		},
		"StatefulSet": func() (int, error) {
			detail, err := a.GetStatefulSetDetail(namespace, ownerName)
			if err != nil {
				return 0, err
			}
			return len(detail.Pods), nil
		},
		"DaemonSet": func() (int, error) {
			detail, err := a.GetDaemonSetDetail(namespace, ownerName)
			if err != nil {
				return 0, err
			}
			return len(detail.Pods), nil
		},
		"ReplicaSet": func() (int, error) {
			detail, err := a.GetReplicaSetDetail(namespace, ownerName)
			if err != nil {
				return 0, err
			}
			return len(detail.Pods), nil
		},
		"Job": func() (int, error) {
			detail, err := a.GetJobDetail(namespace, ownerName)
			if err != nil {
				return 0, err
			}
			return len(detail.Pods), nil
		},
	}

	if fn, ok := getPods[ownerKind]; ok {
		return fn()
	}

	return 0, fmt.Errorf("unsupported owner kind: %s", ownerKind)
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

// GetAllTabCounts returns all relevant tab counts for a resource in a single call
func (a *App) GetAllTabCounts(namespace, kind, name string) (TabCounts, error) {
	counts := TabCounts{}
	setCount := func(get func() (int, error), set func(int)) {
		if v, err := get(); err == nil {
			set(v)
		}
	}

	// Events count (applicable to all resources)
	setCount(func() (int, error) { return a.GetResourceEventsCount(namespace, kind, name) }, func(v int) { counts.Events = v })

	applyPods := func() {
		setCount(func() (int, error) { return a.GetPodsCountForResource(namespace, kind, name) }, func(v int) { counts.Pods = v })
	}
	handlers := map[string][]func(){
		"Deployment": {applyPods},
		"DaemonSet":  {applyPods},
		"ReplicaSet": {applyPods},
		"Job":        {applyPods},
		"StatefulSet": {applyPods, func() {
			setCount(func() (int, error) { return a.GetStatefulSetPVCsCount(namespace, name) }, func(v int) { counts.PVCs = v })
		}},
		"CronJob": {func() {
			setCount(func() (int, error) { return a.GetCronJobHistoryCount(namespace, name) }, func(v int) { counts.History = v })
		}},
		"ConfigMap": {func() {
			setCount(func() (int, error) { return a.GetConfigMapConsumersCount(namespace, name) }, func(v int) { counts.Consumers = v })
		}, func() {
			setCount(func() (int, error) { return a.GetConfigMapDataCount(namespace, name) }, func(v int) { counts.Data = v })
		}},
		"Secret": {func() {
			setCount(func() (int, error) { return a.GetSecretConsumersCount(namespace, name) }, func(v int) { counts.Consumers = v })
		}, func() {
			setCount(func() (int, error) { return a.GetSecretDataCount(namespace, name) }, func(v int) { counts.Data = v })
		}},
		"PersistentVolumeClaim": {func() {
			setCount(func() (int, error) { return a.GetPVCConsumersCount(namespace, name) }, func(v int) { counts.Consumers = v })
		}},
		"Service": {func() {
			setCount(func() (int, error) { return a.GetServiceEndpointsCount(namespace, name) }, func(v int) { counts.Endpoints = v })
		}},
		"Ingress": {func() {
			setCount(func() (int, error) { return a.GetIngressRulesCount(namespace, name) }, func(v int) { counts.Rules = v })
		}},
	}
	if fns, ok := handlers[kind]; ok {
		for _, fn := range fns {
			fn()
		}
	}

	return counts, nil
}
