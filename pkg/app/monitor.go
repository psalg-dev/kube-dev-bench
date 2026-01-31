package app

import (
	"context"
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

// podIssueContext holds common context for creating pod issues
type podIssueContext struct {
	namespace string
	podName   string
	age       string
	podPhase  string
	ownerKind string
	ownerName string
	nodeName  string
}

// newPodIssueContext creates a context from a pod for issue creation
func newPodIssueContext(namespace string, pod *v1.Pod) podIssueContext {
	ownerKind, ownerName := getOwnerInfo(pod)
	return podIssueContext{
		namespace: namespace,
		podName:   pod.Name,
		age:       formatAge(pod.CreationTimestamp.Time),
		podPhase:  string(pod.Status.Phase),
		ownerKind: ownerKind,
		ownerName: ownerName,
		nodeName:  pod.Spec.NodeName,
	}
}

// createPodIssue creates a MonitorIssue for a pod with the given context
func createPodIssue(ctx podIssueContext, issueType, reason, message, containerName string, restartCount int32) MonitorIssue {
	return MonitorIssue{
		Type:          issueType,
		Resource:      "Pod",
		Namespace:     ctx.namespace,
		Name:          ctx.podName,
		Reason:        reason,
		Message:       message,
		ContainerName: containerName,
		RestartCount:  restartCount,
		Age:           ctx.age,
		PodPhase:      ctx.podPhase,
		OwnerKind:     ctx.ownerKind,
		OwnerName:     ctx.ownerName,
		NodeName:      ctx.nodeName,
	}
}

// classifyWaitingReason determines if a waiting reason is an error or warning
func classifyWaitingReason(reason string) string {
	errorReasons := map[string]bool{
		"CrashLoopBackOff":     true,
		"ImagePullBackOff":     true,
		"ErrImagePull":         true,
		"CreateContainerError": true,
	}
	if errorReasons[reason] {
		return "error"
	}
	return "warning"
}

// checkContainerStatus checks a single container status for issues
func checkContainerStatus(ctx podIssueContext, cs v1.ContainerStatus, isInit bool) []MonitorIssue {
	var issues []MonitorIssue
	containerName := cs.Name
	if isInit {
		containerName += " (init)"
	}

	if cs.State.Waiting != nil {
		issueType := classifyWaitingReason(cs.State.Waiting.Reason)
		issues = append(issues, createPodIssue(ctx, issueType, cs.State.Waiting.Reason, cs.State.Waiting.Message, containerName, cs.RestartCount))
	}

	// Check for terminated containers with non-zero exit codes (only for non-init containers)
	if !isInit && cs.State.Terminated != nil && cs.State.Terminated.ExitCode != 0 {
		issues = append(issues, createPodIssue(ctx, "error", cs.State.Terminated.Reason, cs.State.Terminated.Message, cs.Name, cs.RestartCount))
	}

	// Check last terminated state for restart issues (only for non-init containers)
	if !isInit && cs.LastTerminationState.Terminated != nil && cs.RestartCount > 0 {
		if time.Since(cs.LastTerminationState.Terminated.FinishedAt.Time) < 5*time.Minute {
			issues = append(issues, createPodIssue(ctx, "warning", "HighRestarts", cs.LastTerminationState.Terminated.Message, cs.Name, cs.RestartCount))
		}
	}

	return issues
}

// checkPodConditions checks pod conditions for issues
func checkPodConditions(ctx podIssueContext, conditions []v1.PodCondition) []MonitorIssue {
	var issues []MonitorIssue
	for _, cond := range conditions {
		if cond.Status == v1.ConditionFalse {
			if cond.Type == v1.PodReady || cond.Type == v1.PodInitialized {
				issues = append(issues, createPodIssue(ctx, "warning", string(cond.Type)+"False", cond.Message, "", 0))
			}
		}
	}
	return issues
}

// checkSinglePod checks a single pod for issues
func checkSinglePod(namespace string, pod v1.Pod) []MonitorIssue {
	var issues []MonitorIssue
	ctx := newPodIssueContext(namespace, &pod)

	// Check overall pod phase
	if pod.Status.Phase == v1.PodFailed {
		issues = append(issues, createPodIssue(ctx, "error", "PodFailed", pod.Status.Message, "", 0))
		return issues
	}

	// Check container statuses
	for _, cs := range pod.Status.ContainerStatuses {
		issues = append(issues, checkContainerStatus(ctx, cs, false)...)
	}

	// Check init container statuses
	for _, cs := range pod.Status.InitContainerStatuses {
		issues = append(issues, checkContainerStatus(ctx, cs, true)...)
	}

	// Check pod conditions
	issues = append(issues, checkPodConditions(ctx, pod.Status.Conditions)...)

	return issues
}

// checkPodIssues examines pod statuses for problematic conditions
func (a *App) checkPodIssues(namespace string) []MonitorIssue {
	var issues []MonitorIssue

	clientset, err := a.getClient()
	if err != nil {
		return issues
	}

	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return issues
	}

	for _, pod := range pods.Items {
		issues = append(issues, checkSinglePod(namespace, pod)...)
	}

	return issues
}

// processCoreV1Events collects warning events from CoreV1 Events API
func processCoreV1Events(clientset kubernetes.Interface, ctx context.Context, namespace string, cutoff time.Time) []MonitorIssue {
	var issues []MonitorIssue
	list, err := clientset.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return issues
	}
	for _, e := range list.Items {
		if e.Type != "Warning" {
			continue
		}
		lastTime := e.LastTimestamp.Time
		if lastTime.IsZero() && !e.EventTime.Time.IsZero() {
			lastTime = e.EventTime.Time
		}
		if lastTime.Before(cutoff) {
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

// processEventsV1Events collects warning events from EventsV1 API
func processEventsV1Events(clientset kubernetes.Interface, ctx context.Context, namespace string, cutoff time.Time) []MonitorIssue {
	var issues []MonitorIssue
	list, err := clientset.EventsV1().Events(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return issues
	}
	for _, e := range list.Items {
		if e.Type != "Warning" {
			continue
		}
		lastTime := e.EventTime.Time
		if lastTime.IsZero() && !e.DeprecatedLastTimestamp.Time.IsZero() {
			lastTime = e.DeprecatedLastTimestamp.Time
		}
		if lastTime.Before(cutoff) {
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

// checkEventIssues examines k8s events for warnings in the namespace
func (a *App) checkEventIssues(namespace string) []MonitorIssue {
	clientset, err := a.getClient()
	if err != nil {
		return nil
	}

	// Get events from the last 10 minutes
	tenMinutesAgo := time.Now().Add(-10 * time.Minute)

	issues := processCoreV1Events(clientset, a.ctx, namespace, tenMinutesAgo)
	issues = append(issues, processEventsV1Events(clientset, a.ctx, namespace, tenMinutesAgo)...)

	return issues
}
