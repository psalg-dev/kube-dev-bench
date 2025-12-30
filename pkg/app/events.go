package app

import (
	"fmt"
	"sort"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// GetPodEvents returns events related to the given pod (from all available time in cluster retention)
func (a *App) GetPodEvents(namespace string, podName string) ([]EventInfo, error) {
	var clientset kubernetes.Interface

	if a.testClientset != nil {
		clientset = a.testClientset.(kubernetes.Interface)
	} else {
		configPath := a.getKubeConfigPath()
		config, err := clientcmd.LoadFromFile(configPath)
		if err != nil {
			return nil, err
		}
		if a.currentKubeContext == "" {
			return nil, fmt.Errorf("no kube context selected")
		}
		clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
		restConfig, err := clientConfig.ClientConfig()
		if err != nil {
			return nil, err
		}
		var newErr error
		clientset, newErr = kubernetes.NewForConfig(restConfig)
		if newErr != nil {
			return nil, newErr
		}
	}
	if namespace == "" {
		if a.currentNamespace == "" {
			return nil, fmt.Errorf("no namespace selected")
		}
		namespace = a.currentNamespace
	}

	var res []EventInfo
	// Core/v1 Events
	if list, err := clientset.CoreV1().Events(namespace).List(a.ctx, metav1.ListOptions{}); err == nil {
		for _, e := range list.Items {
			if e.InvolvedObject.Name != podName {
				continue
			}
			first := e.FirstTimestamp.Time
			last := e.LastTimestamp.Time
			if last.IsZero() && !e.EventTime.Time.IsZero() {
				last = e.EventTime.Time
			}
			if first.IsZero() && !e.EventTime.Time.IsZero() {
				first = e.EventTime.Time
			}
			source := ""
			if e.Source.Component != "" || e.Source.Host != "" {
				source = fmt.Sprintf("%s/%s", e.Source.Component, e.Source.Host)
			}
			res = append(res, EventInfo{
				Type:           e.Type,
				Reason:         e.Reason,
				Message:        e.Message,
				Count:          e.Count,
				FirstTimestamp: first,
				LastTimestamp:  last,
				Source:         source,
			})
		}
	}
	// events.k8s.io/v1 Events
	if list, err := clientset.EventsV1().Events(namespace).List(a.ctx, metav1.ListOptions{}); err == nil {
		for _, e := range list.Items {
			if e.Regarding.Name != podName {
				continue
			}
			first := e.DeprecatedFirstTimestamp.Time
			last := e.EventTime.Time
			if last.IsZero() && !e.DeprecatedLastTimestamp.Time.IsZero() {
				last = e.DeprecatedLastTimestamp.Time
			}
			if first.IsZero() && !e.EventTime.Time.IsZero() {
				first = e.EventTime.Time
			}
			count := int32(0)
			if e.Series != nil {
				count = int32(e.Series.Count)
			} else if e.DeprecatedCount != 0 {
				count = int32(e.DeprecatedCount)
			}
			source := ""
			if e.DeprecatedSource.Component != "" || e.DeprecatedSource.Host != "" {
				source = fmt.Sprintf("%s/%s", e.DeprecatedSource.Component, e.DeprecatedSource.Host)
			}
			msg := e.Note
			res = append(res, EventInfo{
				Type:           e.Type,
				Reason:         e.Reason,
				Message:        msg,
				Count:          count,
				FirstTimestamp: first,
				LastTimestamp:  last,
				Source:         source,
			})
		}
	}
	// sort newest first
	sort.Slice(res, func(i, j int) bool { return res[i].LastTimestamp.After(res[j].LastTimestamp) })
	return res, nil
}

// Backwards-compat wrapper (deprecated)
func (a *App) GetPodEventsLegacy(podName string) ([]EventInfo, error) {
	return a.GetPodEvents("", podName)
}

// GetResourceEvents returns events related to a resource by kind and name
// kind can be: Pod, Deployment, StatefulSet, DaemonSet, ReplicaSet, Job, CronJob, ConfigMap, Secret, PersistentVolume, PersistentVolumeClaim, Ingress
func (a *App) GetResourceEvents(namespace, kind, name string) ([]EventInfo, error) {
	var clientset kubernetes.Interface
	if a.testClientset != nil {
		clientset = a.testClientset.(kubernetes.Interface)
	} else {
		configPath := a.getKubeConfigPath()
		config, configErr := clientcmd.LoadFromFile(configPath)
		if configErr != nil {
			return nil, configErr
		}
		if a.currentKubeContext == "" {
			return nil, fmt.Errorf("no kube context selected")
		}
		clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
		restConfig, restErr := clientConfig.ClientConfig()
		if restErr != nil {
			return nil, restErr
		}
		var clientErr error
		clientset, clientErr = kubernetes.NewForConfig(restConfig)
		if clientErr != nil {
			return nil, clientErr
		}
	}

	// For cluster-scoped resources like PersistentVolume, use all namespaces
	ns := namespace
	if kind == "PersistentVolume" {
		ns = ""
	} else if ns == "" {
		if a.currentNamespace == "" {
			return nil, fmt.Errorf("no namespace selected")
		}
		ns = a.currentNamespace
	}

	var res []EventInfo

	// Core/v1 Events
	listOpts := metav1.ListOptions{}
	if list, err := clientset.CoreV1().Events(ns).List(a.ctx, listOpts); err == nil {
		for _, e := range list.Items {
			if e.InvolvedObject.Name != name || e.InvolvedObject.Kind != kind {
				continue
			}
			first := e.FirstTimestamp.Time
			last := e.LastTimestamp.Time
			if last.IsZero() && !e.EventTime.Time.IsZero() {
				last = e.EventTime.Time
			}
			if first.IsZero() && !e.EventTime.Time.IsZero() {
				first = e.EventTime.Time
			}
			source := ""
			if e.Source.Component != "" || e.Source.Host != "" {
				source = fmt.Sprintf("%s/%s", e.Source.Component, e.Source.Host)
			}
			res = append(res, EventInfo{
				Type:           e.Type,
				Reason:         e.Reason,
				Message:        e.Message,
				Count:          e.Count,
				FirstTimestamp: first,
				LastTimestamp:  last,
				Source:         source,
			})
		}
	}

	// events.k8s.io/v1 Events
	if list, err := clientset.EventsV1().Events(ns).List(a.ctx, listOpts); err == nil {
		for _, e := range list.Items {
			if e.Regarding.Name != name || e.Regarding.Kind != kind {
				continue
			}
			first := e.DeprecatedFirstTimestamp.Time
			last := e.EventTime.Time
			if last.IsZero() && !e.DeprecatedLastTimestamp.Time.IsZero() {
				last = e.DeprecatedLastTimestamp.Time
			}
			if first.IsZero() && !e.EventTime.Time.IsZero() {
				first = e.EventTime.Time
			}
			count := int32(0)
			if e.Series != nil {
				count = int32(e.Series.Count)
			} else if e.DeprecatedCount != 0 {
				count = int32(e.DeprecatedCount)
			}
			source := ""
			if e.DeprecatedSource.Component != "" || e.DeprecatedSource.Host != "" {
				source = fmt.Sprintf("%s/%s", e.DeprecatedSource.Component, e.DeprecatedSource.Host)
			}
			msg := e.Note
			res = append(res, EventInfo{
				Type:           e.Type,
				Reason:         e.Reason,
				Message:        msg,
				Count:          count,
				FirstTimestamp: first,
				LastTimestamp:  last,
				Source:         source,
			})
		}
	}

	// sort newest first
	sort.Slice(res, func(i, j int) bool { return res[i].LastTimestamp.After(res[j].LastTimestamp) })
	return res, nil
}
