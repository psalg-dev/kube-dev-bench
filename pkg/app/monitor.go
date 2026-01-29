package app

import (
	"fmt"
	"time"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// formatAge converts a time to a human-readable age string
func formatAge(t time.Time) string {
	d := time.Since(t)
	if d < time.Minute {
		return "< 1m"
	} else if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	} else if d < 24*time.Hour {
		return fmt.Sprintf("%dh", int(d.Hours()))
	} else {
		return fmt.Sprintf("%dd", int(d.Hours()/24))
	}
}

// StartMonitorPolling emits monitor:update events every 5 seconds with warnings and errors
func (a *App) StartMonitorPolling() {
	go func() {
		for {
			time.Sleep(5 * time.Second)
			if a.ctx == nil {
				continue
			}
			// Determine namespaces to monitor
			nsList := a.preferredNamespaces
			if len(nsList) == 0 && a.currentNamespace != "" {
				nsList = []string{a.currentNamespace}
			}
			if len(nsList) == 0 {
				continue
			}

			info := a.collectMonitorInfo(nsList)
			emitEvent(a.ctx, "monitor:update", info)
		}
	}()
}

// collectMonitorInfo gathers warnings and errors from pods and events across the given namespaces
func (a *App) collectMonitorInfo(namespaces []string) MonitorInfo {
	var warnings []MonitorIssue
	var errors []MonitorIssue

	for _, ns := range namespaces {
		// Check pod conditions for errors
		podIssues := a.checkPodIssues(ns)
		for _, issue := range podIssues {
			if issue.Type == "error" {
				errors = append(errors, issue)
			} else {
				warnings = append(warnings, issue)
			}
		}

		// Check k8s events for warnings
		eventIssues := a.checkEventIssues(ns)
		for _, issue := range eventIssues {
			if issue.Type == "error" {
				errors = append(errors, issue)
			} else {
				warnings = append(warnings, issue)
			}
		}
	}

	return a.enrichMonitorInfo(MonitorInfo{
		WarningCount: len(warnings),
		ErrorCount:   len(errors),
		Warnings:     warnings,
		Errors:       errors,
	})
}

// getOwnerInfo extracts owner kind and name from owner references
func getOwnerInfo(pod *v1.Pod) (string, string) {
	if len(pod.OwnerReferences) > 0 {
		owner := pod.OwnerReferences[0]
		return owner.Kind, owner.Name
	}
	return "", ""
}

// checkPodIssues examines pod statuses for problematic conditions
func (a *App) checkPodIssues(namespace string) []MonitorIssue {
	var issues []MonitorIssue

	clientset, err := a.getClientsetForMonitoring()
	if err != nil {
		return issues
	}

	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return issues
	}

	for _, pod := range pods.Items {
		podIssues := a.checkSinglePodIssues(pod, namespace)
		issues = append(issues, podIssues...)
	}

	return issues
}

// getClientsetForMonitoring returns a kubernetes clientset for monitoring
func (a *App) getClientsetForMonitoring() (kubernetes.Interface, error) {
	if a.testClientset != nil {
		return a.testClientset.(kubernetes.Interface), nil
	}
	return a.createKubernetesClient()
}

// checkSinglePodIssues checks all issues for a single pod
func (a *App) checkSinglePodIssues(pod v1.Pod, namespace string) []MonitorIssue {
	var issues []MonitorIssue
	
	age := formatAge(pod.CreationTimestamp.Time)
	ownerKind, ownerName := getOwnerInfo(&pod)
	podPhase := string(pod.Status.Phase)
	nodeName := pod.Spec.NodeName

	// Check overall pod phase
	if pod.Status.Phase == v1.PodFailed {
		issues = append(issues, createPodIssue("error", namespace, pod.Name, "PodFailed", pod.Status.Message, "", 0, age, podPhase, ownerKind, ownerName, nodeName))
		return issues
	}

	// Check container statuses
	issues = append(issues, a.checkContainerIssues(pod.Status.ContainerStatuses, namespace, pod.Name, age, podPhase, ownerKind, ownerName, nodeName)...)

	// Check init container statuses
	issues = append(issues, a.checkInitContainerIssues(pod.Status.InitContainerStatuses, namespace, pod.Name, age, podPhase, ownerKind, ownerName, nodeName)...)

	// Check pod conditions
	issues = append(issues, a.checkPodConditions(pod.Status.Conditions, namespace, pod.Name, age, podPhase, ownerKind, ownerName, nodeName)...)

	return issues
}

// checkContainerIssues checks issues in regular containers
func (a *App) checkContainerIssues(statuses []v1.ContainerStatus, namespace, podName, age, podPhase, ownerKind, ownerName, nodeName string) []MonitorIssue {
	var issues []MonitorIssue

	for _, cs := range statuses {
		// Check waiting state
		if cs.State.Waiting != nil {
			issueType := classifyWaitingReason(cs.State.Waiting.Reason)
			issues = append(issues, createContainerIssue(issueType, namespace, podName, cs.State.Waiting.Reason, cs.State.Waiting.Message, cs.Name, cs.RestartCount, age, podPhase, ownerKind, ownerName, nodeName))
		}

		// Check terminated state with non-zero exit code
		if cs.State.Terminated != nil && cs.State.Terminated.ExitCode != 0 {
			issues = append(issues, createContainerIssue("error", namespace, podName, cs.State.Terminated.Reason, cs.State.Terminated.Message, cs.Name, cs.RestartCount, age, podPhase, ownerKind, ownerName, nodeName))
		}

		// Check last terminated state for recent restarts
		if cs.LastTerminationState.Terminated != nil && cs.RestartCount > 0 {
			if time.Since(cs.LastTerminationState.Terminated.FinishedAt.Time) < 5*time.Minute {
				issues = append(issues, createContainerIssue("warning", namespace, podName, "HighRestarts", cs.LastTerminationState.Terminated.Message, cs.Name, cs.RestartCount, age, podPhase, ownerKind, ownerName, nodeName))
			}
		}
	}

	return issues
}

// checkInitContainerIssues checks issues in init containers
func (a *App) checkInitContainerIssues(statuses []v1.ContainerStatus, namespace, podName, age, podPhase, ownerKind, ownerName, nodeName string) []MonitorIssue {
	var issues []MonitorIssue

	for _, cs := range statuses {
		if cs.State.Waiting != nil {
			issueType := classifyInitContainerWaitingReason(cs.State.Waiting.Reason)
			containerName := cs.Name + " (init)"
			issues = append(issues, createContainerIssue(issueType, namespace, podName, cs.State.Waiting.Reason, cs.State.Waiting.Message, containerName, cs.RestartCount, age, podPhase, ownerKind, ownerName, nodeName))
		}
	}

	return issues
}

// checkPodConditions checks pod conditions for issues
func (a *App) checkPodConditions(conditions []v1.PodCondition, namespace, podName, age, podPhase, ownerKind, ownerName, nodeName string) []MonitorIssue {
	var issues []MonitorIssue

	for _, cond := range conditions {
		if cond.Status == v1.ConditionFalse {
			if cond.Type == v1.PodReady || cond.Type == v1.PodInitialized {
				issues = append(issues, createPodIssue("warning", namespace, podName, string(cond.Type)+"False", cond.Message, "", 0, age, podPhase, ownerKind, ownerName, nodeName))
			}
		}
	}

	return issues
}

// classifyWaitingReason determines issue type based on waiting reason
func classifyWaitingReason(reason string) string {
	if reason == "CrashLoopBackOff" || reason == "ImagePullBackOff" ||
		reason == "ErrImagePull" || reason == "CreateContainerError" {
		return "error"
	}
	return "warning"
}

// classifyInitContainerWaitingReason determines issue type for init container waiting reason
func classifyInitContainerWaitingReason(reason string) string {
	if reason == "ImagePullBackOff" || reason == "ErrImagePull" ||
		reason == "CreateContainerError" {
		return "error"
	}
	return "warning"
}

// createPodIssue creates a monitor issue for a pod
func createPodIssue(issueType, namespace, name, reason, message, containerName string, restartCount int32, age, podPhase, ownerKind, ownerName, nodeName string) MonitorIssue {
	return MonitorIssue{
		Type:          issueType,
		Resource:      "Pod",
		Namespace:     namespace,
		Name:          name,
		Reason:        reason,
		Message:       message,
		ContainerName: containerName,
		RestartCount:  restartCount,
		Age:           age,
		PodPhase:      podPhase,
		OwnerKind:     ownerKind,
		OwnerName:     ownerName,
		NodeName:      nodeName,
	}
}

// createContainerIssue creates a monitor issue for a container
func createContainerIssue(issueType, namespace, podName, reason, message, containerName string, restartCount int32, age, podPhase, ownerKind, ownerName, nodeName string) MonitorIssue {
	return MonitorIssue{
		Type:          issueType,
		Resource:      "Pod",
		Namespace:     namespace,
		Name:          podName,
		Reason:        reason,
		Message:       message,
		ContainerName: containerName,
		RestartCount:  restartCount,
		Age:           age,
		PodPhase:      podPhase,
		OwnerKind:     ownerKind,
		OwnerName:     ownerName,
		NodeName:      nodeName,
	}
}

// checkEventIssues examines k8s events for warnings in the namespace
func (a *App) checkEventIssues(namespace string) []MonitorIssue {
	var issues []MonitorIssue

	clientset, err := a.getClientsetForMonitoring()
	if err != nil {
		return issues
	}

	tenMinutesAgo := time.Now().Add(-10 * time.Minute)

	// Core/v1 Events
	coreIssues := a.extractCoreV1EventIssues(clientset, namespace, tenMinutesAgo)
	issues = append(issues, coreIssues...)

	// events.k8s.io/v1 Events
	v1Issues := a.extractEventsV1Issues(clientset, namespace, tenMinutesAgo)
	issues = append(issues, v1Issues...)

	return issues
}

// extractCoreV1EventIssues extracts warning issues from Core/v1 events
func (a *App) extractCoreV1EventIssues(clientset kubernetes.Interface, namespace string, cutoffTime time.Time) []MonitorIssue {
	var issues []MonitorIssue

	list, err := clientset.CoreV1().Events(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return issues
	}

	for _, e := range list.Items {
		if e.Type != "Warning" {
			continue
		}

		lastTime := getEventLastTime(e.LastTimestamp.Time, e.EventTime.Time)
		if lastTime.Before(cutoffTime) {
			continue
		}

		issues = append(issues, MonitorIssue{
			Type:      "warning",
			Resource:  e.InvolvedObject.Kind,
			Namespace: namespace,
			Name:      e.InvolvedObject.Name,
			Reason:    e.Reason,
			Message:   e.Message,
			Age:       formatAge(lastTime),
		})
	}

	return issues
}

// extractEventsV1Issues extracts warning issues from events.k8s.io/v1 events
func (a *App) extractEventsV1Issues(clientset kubernetes.Interface, namespace string, cutoffTime time.Time) []MonitorIssue {
	var issues []MonitorIssue

	list, err := clientset.EventsV1().Events(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return issues
	}

	for _, e := range list.Items {
		if e.Type != "Warning" {
			continue
		}

		lastTime := getEventLastTime(e.EventTime.Time, e.DeprecatedLastTimestamp.Time)
		if lastTime.Before(cutoffTime) {
			continue
		}

		issues = append(issues, MonitorIssue{
			Type:      "warning",
			Resource:  e.Regarding.Kind,
			Namespace: namespace,
			Name:      e.Regarding.Name,
			Reason:    e.Reason,
			Message:   e.Note,
			Age:       formatAge(lastTime),
		})
	}

	return issues
}

// getEventLastTime returns the most recent time from two timestamps
func getEventLastTime(lastTime, altTime time.Time) time.Time {
	if lastTime.IsZero() && !altTime.IsZero() {
		return altTime
	}
	return lastTime
}
