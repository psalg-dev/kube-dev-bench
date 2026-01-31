package app

import (
	"fmt"
	"sort"
	"time"

	corev1 "k8s.io/api/core/v1"
	eventsv1 "k8s.io/api/events/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// eventMatcher defines a function that checks if an event matches filtering criteria
type eventMatcher func(name, kind string) bool

// convertCoreV1Event converts a core/v1 Event to EventInfo
func convertCoreV1Event(e corev1.Event) EventInfo {
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

// convertEventsV1Event converts an events.k8s.io/v1 Event to EventInfo
func convertEventsV1Event(e eventsv1.Event) EventInfo {
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

// sortEventsByTime sorts events by LastTimestamp in descending order (newest first)
func sortEventsByTime(events []EventInfo) {
	sort.Slice(events, func(i, j int) bool {
		return parseEventTime(events[i].LastTimestamp).After(parseEventTime(events[j].LastTimestamp))
	})
}

// getEventsClientset returns a kubernetes clientset for events queries
func (a *App) getEventsClientset() (kubernetes.Interface, error) {
	return a.getClient()
}

// resolveEventsNamespace returns the namespace to use for events, defaulting to current namespace
func (a *App) resolveEventsNamespace(namespace string) string {
	if namespace != "" {
		return namespace
	}
	return a.currentNamespace
}

// collectAndSortEvents collects events from both core/v1 and events.k8s.io/v1 APIs
func (a *App) collectAndSortEvents(clientset kubernetes.Interface, namespace string, matcher eventMatcher) []EventInfo {
	var res []EventInfo

	// Core/v1 Events
	if list, err := clientset.CoreV1().Events(namespace).List(a.ctx, metav1.ListOptions{}); err == nil {
		for _, e := range list.Items {
			if matcher(e.InvolvedObject.Name, e.InvolvedObject.Kind) {
				res = append(res, convertCoreV1Event(e))
			}
		}
	}

	// events.k8s.io/v1 Events
	if list, err := clientset.EventsV1().Events(namespace).List(a.ctx, metav1.ListOptions{}); err == nil {
		for _, e := range list.Items {
			if matcher(e.Regarding.Name, e.Regarding.Kind) {
				res = append(res, convertEventsV1Event(e))
			}
		}
	}

	sortEventsByTime(res)
	return res
}

// GetPodEvents returns events related to the given pod (from all available time in cluster retention)
func (a *App) GetPodEvents(namespace string, podName string) ([]EventInfo, error) {
	clientset, err := a.getEventsClientset()
	if err != nil {
		return nil, err
	}

	ns := a.resolveEventsNamespace(namespace)
	if ns == "" {
		return nil, fmt.Errorf("no namespace selected")
	}

	matcher := func(name, kind string) bool {
		return name == podName
	}

	return a.collectAndSortEvents(clientset, ns, matcher), nil
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
	ns := a.resolveResourceEventNamespace(namespace, kind)
	if ns == "" && kind != "PersistentVolume" {
		return nil, fmt.Errorf("no namespace selected")
	}

	matcher := func(eName, eKind string) bool {
		return eName == name && eKind == kind
	}

	return a.collectAndSortEvents(clientset, ns, matcher), nil
}

// resolveResourceEventNamespace determines the namespace to use for event queries
func (a *App) resolveResourceEventNamespace(namespace, kind string) string {
	if kind == "PersistentVolume" {
		return ""
	}
	return a.resolveEventsNamespace(namespace)
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
