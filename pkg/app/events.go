package app

import (
	"fmt"
	"sort"
	"time"

	v1 "k8s.io/api/core/v1"
	eventsv1 "k8s.io/api/events/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// GetPodEvents returns events related to the given pod (from all available time in cluster retention)
func (a *App) GetPodEvents(namespace string, podName string) ([]EventInfo, error) {
	clientset, err := a.getClientsetForEvents()
	if err != nil {
		return nil, err
	}

	if namespace == "" {
		if a.currentNamespace == "" {
			return nil, fmt.Errorf("no namespace selected")
		}
		namespace = a.currentNamespace
	}

	var res []EventInfo

	// Core/v1 Events - filter by pod name
	coreEvents := a.fetchCoreV1EventsForPod(clientset, namespace, podName)
	res = append(res, coreEvents...)

	// events.k8s.io/v1 Events - filter by pod name
	v1Events := a.fetchEventsV1ForPod(clientset, namespace, podName)
	res = append(res, v1Events...)

	// sort newest first
	sort.Slice(res, func(i, j int) bool {
		return parseEventTime(res[i].LastTimestamp).After(parseEventTime(res[j].LastTimestamp))
	})
	return res, nil
}

// fetchCoreV1EventsForPod fetches Core/v1 events for a specific pod
func (a *App) fetchCoreV1EventsForPod(clientset kubernetes.Interface, namespace, podName string) []EventInfo {
	var res []EventInfo

	list, err := clientset.CoreV1().Events(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return res
	}

	for _, e := range list.Items {
		if e.InvolvedObject.Name != podName {
			continue
		}

		first, last := extractCoreV1EventTimes(e)
		source := formatEventSource(e.Source.Component, e.Source.Host)

		res = append(res, EventInfo{
			Type:           e.Type,
			Reason:         e.Reason,
			Message:        e.Message,
			Count:          e.Count,
			FirstTimestamp: formatEventTime(first),
			LastTimestamp:  formatEventTime(last),
			Source:         source,
		})
	}

	return res
}

// fetchEventsV1ForPod fetches events.k8s.io/v1 events for a specific pod
func (a *App) fetchEventsV1ForPod(clientset kubernetes.Interface, namespace, podName string) []EventInfo {
	var res []EventInfo

	list, err := clientset.EventsV1().Events(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return res
	}

	for _, e := range list.Items {
		if e.Regarding.Name != podName {
			continue
		}

		first, last := extractEventsV1Times(e)
		count := extractEventsV1Count(e)
		source := formatEventSource(e.DeprecatedSource.Component, e.DeprecatedSource.Host)

		res = append(res, EventInfo{
			Type:           e.Type,
			Reason:         e.Reason,
			Message:        e.Note,
			Count:          count,
			FirstTimestamp: formatEventTime(first),
			LastTimestamp:  formatEventTime(last),
			Source:         source,
		})
	}

	return res
}

// Backwards-compat wrapper (deprecated)
func (a *App) GetPodEventsLegacy(podName string) ([]EventInfo, error) {
	return a.GetPodEvents("", podName)
}

// GetResourceEvents returns events related to a resource by kind and name
// kind can be: Pod, Deployment, StatefulSet, DaemonSet, ReplicaSet, Job, CronJob, ConfigMap, Secret, PersistentVolume, PersistentVolumeClaim, Ingress
func (a *App) GetResourceEvents(namespace, kind, name string) ([]EventInfo, error) {
	clientset, err := a.getClientsetForEvents()
	if err != nil {
		return nil, err
	}

	ns := a.resolveEventNamespace(namespace, kind)
	if ns == "" && kind != "PersistentVolume" {
		return nil, fmt.Errorf("no namespace selected")
	}

	var res []EventInfo

	// Core/v1 Events
	coreEvents := a.fetchCoreV1Events(clientset, ns, kind, name)
	res = append(res, coreEvents...)

	// events.k8s.io/v1 Events
	v1Events := a.fetchEventsV1(clientset, ns, kind, name)
	res = append(res, v1Events...)

	// sort newest first
	sort.Slice(res, func(i, j int) bool {
		return parseEventTime(res[i].LastTimestamp).After(parseEventTime(res[j].LastTimestamp))
	})
	return res, nil
}

// getClientsetForEvents returns a kubernetes clientset for event queries
func (a *App) getClientsetForEvents() (kubernetes.Interface, error) {
	if a.testClientset != nil {
		return a.testClientset.(kubernetes.Interface), nil
	}

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
	
	return kubernetes.NewForConfig(restConfig)
}

// resolveEventNamespace determines the namespace to use for event queries
func (a *App) resolveEventNamespace(namespace, kind string) string {
	// For cluster-scoped resources like PersistentVolume, use all namespaces
	if kind == "PersistentVolume" {
		return ""
	}
	if namespace != "" {
		return namespace
	}
	return a.currentNamespace
}

// fetchCoreV1Events fetches events from Core/v1 API
func (a *App) fetchCoreV1Events(clientset kubernetes.Interface, ns, kind, name string) []EventInfo {
	var res []EventInfo

	listOpts := metav1.ListOptions{}
	list, err := clientset.CoreV1().Events(ns).List(a.ctx, listOpts)
	if err != nil {
		return res
	}

	for _, e := range list.Items {
		if e.InvolvedObject.Name != name || e.InvolvedObject.Kind != kind {
			continue
		}

		first, last := extractCoreV1EventTimes(e)
		source := formatEventSource(e.Source.Component, e.Source.Host)

		res = append(res, EventInfo{
			Type:           e.Type,
			Reason:         e.Reason,
			Message:        e.Message,
			Count:          e.Count,
			FirstTimestamp: formatEventTime(first),
			LastTimestamp:  formatEventTime(last),
			Source:         source,
		})
	}

	return res
}

// extractCoreV1EventTimes extracts first and last timestamps from a Core/v1 event
func extractCoreV1EventTimes(e v1.Event) (first, last time.Time) {
	first = e.FirstTimestamp.Time
	last = e.LastTimestamp.Time
	
	if last.IsZero() && !e.EventTime.Time.IsZero() {
		last = e.EventTime.Time
	}
	if first.IsZero() && !e.EventTime.Time.IsZero() {
		first = e.EventTime.Time
	}
	
	return first, last
}

// fetchEventsV1 fetches events from events.k8s.io/v1 API
func (a *App) fetchEventsV1(clientset kubernetes.Interface, ns, kind, name string) []EventInfo {
	var res []EventInfo

	listOpts := metav1.ListOptions{}
	list, err := clientset.EventsV1().Events(ns).List(a.ctx, listOpts)
	if err != nil {
		return res
	}

	for _, e := range list.Items {
		if e.Regarding.Name != name || e.Regarding.Kind != kind {
			continue
		}

		first, last := extractEventsV1Times(e)
		count := extractEventsV1Count(e)
		source := formatEventSource(e.DeprecatedSource.Component, e.DeprecatedSource.Host)

		res = append(res, EventInfo{
			Type:           e.Type,
			Reason:         e.Reason,
			Message:        e.Note,
			Count:          count,
			FirstTimestamp: formatEventTime(first),
			LastTimestamp:  formatEventTime(last),
			Source:         source,
		})
	}

	return res
}

// extractEventsV1Times extracts first and last timestamps from an events.k8s.io/v1 event
func extractEventsV1Times(e eventsv1.Event) (first, last time.Time) {
	first = e.DeprecatedFirstTimestamp.Time
	last = e.EventTime.Time
	
	if last.IsZero() && !e.DeprecatedLastTimestamp.Time.IsZero() {
		last = e.DeprecatedLastTimestamp.Time
	}
	if first.IsZero() && !e.EventTime.Time.IsZero() {
		first = e.EventTime.Time
	}
	
	return first, last
}

// extractEventsV1Count extracts the event count from an events.k8s.io/v1 event
func extractEventsV1Count(e eventsv1.Event) int32 {
	if e.Series != nil {
		return int32(e.Series.Count)
	}
	if e.DeprecatedCount != 0 {
		return int32(e.DeprecatedCount)
	}
	return 0
}

// formatEventSource formats event source from component and host
func formatEventSource(component, host string) string {
	if component != "" || host != "" {
		return fmt.Sprintf("%s/%s", component, host)
	}
	return ""
}

func formatEventTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.UTC().Format(time.RFC3339Nano)
}

func parseEventTime(value string) time.Time {
	if value == "" {
		return time.Time{}
	}
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err == nil {
		return parsed
	}
	parsed, err = time.Parse(time.RFC3339, value)
	if err == nil {
		return parsed
	}
	return time.Time{}
}
