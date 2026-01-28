package app

import (
	"fmt"
	"sort"
	"time"

	corev1 "k8s.io/api/core/v1"
	eventsv1 "k8s.io/api/events/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

type coreEventMatcher func(corev1.Event) bool
type eventsV1Matcher func(eventsv1.Event) bool

func (a *App) getEventsClientset() (kubernetes.Interface, error) {
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
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, err
	}
	return clientset, nil
}

func appendCoreEventInfos(events []EventInfo, list []corev1.Event, matches coreEventMatcher) []EventInfo {
	for _, e := range list {
		if !matches(e) {
			continue
		}
		events = append(events, coreEventInfo(e))
	}
	return events
}

func appendEventsV1Infos(events []EventInfo, list []eventsv1.Event, matches eventsV1Matcher) []EventInfo {
	for _, e := range list {
		if !matches(e) {
			continue
		}
		events = append(events, eventsV1Info(e))
	}
	return events
}

func coreEventInfo(e corev1.Event) EventInfo {
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
	return EventInfo{
		Type:           e.Type,
		Reason:         e.Reason,
		Message:        e.Message,
		Count:          e.Count,
		FirstTimestamp: formatEventTime(first),
		LastTimestamp:  formatEventTime(last),
		Source:         source,
	}
}

func eventsV1Info(e eventsv1.Event) EventInfo {
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
	return EventInfo{
		Type:           e.Type,
		Reason:         e.Reason,
		Message:        e.Note,
		Count:          count,
		FirstTimestamp: formatEventTime(first),
		LastTimestamp:  formatEventTime(last),
		Source:         source,
	}
}

// GetPodEvents returns events related to the given pod (from all available time in cluster retention)
func (a *App) GetPodEvents(namespace string, podName string) ([]EventInfo, error) {
	clientset, err := a.getEventsClientset()
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
	// Core/v1 Events
	if list, err := clientset.CoreV1().Events(namespace).List(a.ctx, metav1.ListOptions{}); err == nil {
		res = appendCoreEventInfos(res, list.Items, func(e corev1.Event) bool {
			return e.InvolvedObject.Name == podName
		})
	}
	// events.k8s.io/v1 Events
	if list, err := clientset.EventsV1().Events(namespace).List(a.ctx, metav1.ListOptions{}); err == nil {
		res = appendEventsV1Infos(res, list.Items, func(e eventsv1.Event) bool {
			return e.Regarding.Name == podName
		})
	}
	// sort newest first
	sort.Slice(res, func(i, j int) bool {
		return parseEventTime(res[i].LastTimestamp).After(parseEventTime(res[j].LastTimestamp))
	})
	return res, nil
}

// Backwards-compat wrapper (deprecated)
func (a *App) GetPodEventsLegacy(podName string) ([]EventInfo, error) {
	return a.GetPodEvents("", podName)
}

// GetResourceEvents returns events related to a resource by kind and name
// kind can be: Pod, Deployment, StatefulSet, DaemonSet, ReplicaSet, Job, CronJob, ConfigMap, Secret, PersistentVolume, PersistentVolumeClaim, Ingress
func (a *App) GetResourceEvents(namespace, kind, name string) ([]EventInfo, error) {
	clientset, err := a.getEventsClientset()
	if err != nil {
		return nil, err
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
		res = appendCoreEventInfos(res, list.Items, func(e corev1.Event) bool {
			return e.InvolvedObject.Name == name && e.InvolvedObject.Kind == kind
		})
	}

	// events.k8s.io/v1 Events
	if list, err := clientset.EventsV1().Events(ns).List(a.ctx, listOpts); err == nil {
		res = appendEventsV1Infos(res, list.Items, func(e eventsv1.Event) bool {
			return e.Regarding.Name == name && e.Regarding.Kind == kind
		})
	}

	// sort newest first
	sort.Slice(res, func(i, j int) bool {
		return parseEventTime(res[i].LastTimestamp).After(parseEventTime(res[j].LastTimestamp))
	})
	return res, nil
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
