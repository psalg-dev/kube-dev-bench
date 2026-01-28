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
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			ctx := a.ctx
			if ctx == nil {
				<-ticker.C
				continue
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
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
			emitEvent(ctx, "monitor:update", info)
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

type podIssueContext struct {
	Namespace string
	Age       string
	PodPhase  string
	OwnerKind string
	OwnerName string
	NodeName  string
}

func (a *App) getMonitorClientset() (kubernetes.Interface, error) {
	if a.testClientset != nil {
		return a.testClientset.(kubernetes.Interface), nil
	}
	return a.createKubernetesClient()
}

func makePodIssue(ctx podIssueContext, podName, issueType, reason, message string) MonitorIssue {
	return MonitorIssue{
		Type:      issueType,
		Resource:  "Pod",
		Namespace: ctx.Namespace,
		Name:      podName,
		Reason:    reason,
		Message:   message,
		Age:       ctx.Age,
		PodPhase:  ctx.PodPhase,
		OwnerKind: ctx.OwnerKind,
		OwnerName: ctx.OwnerName,
		NodeName:  ctx.NodeName,
	}
}

func makeContainerIssue(ctx podIssueContext, podName, issueType, reason, message, containerName string, restartCount int32) MonitorIssue {
	issue := makePodIssue(ctx, podName, issueType, reason, message)
	issue.ContainerName = containerName
	issue.RestartCount = restartCount
	return issue
}

func waitingIssueType(reason string, includeCrashLoop bool) string {
	switch reason {
	case "ImagePullBackOff", "ErrImagePull", "CreateContainerError":
		return "error"
	case "CrashLoopBackOff":
		if includeCrashLoop {
			return "error"
		}
		return "warning"
	default:
		return "warning"
	}
}

func appendContainerStatusIssues(issues []MonitorIssue, pod v1.Pod, ctx podIssueContext) []MonitorIssue {
	for _, cs := range pod.Status.ContainerStatuses {
		if cs.State.Waiting != nil {
			reason := cs.State.Waiting.Reason
			message := cs.State.Waiting.Message
			issueType := waitingIssueType(reason, true)
			issues = append(issues, makeContainerIssue(ctx, pod.Name, issueType, reason, message, cs.Name, cs.RestartCount))
		}

		if cs.State.Terminated != nil && cs.State.Terminated.ExitCode != 0 {
			reason := cs.State.Terminated.Reason
			message := cs.State.Terminated.Message
			issues = append(issues, makeContainerIssue(ctx, pod.Name, "error", reason, message, cs.Name, cs.RestartCount))
		}

		if cs.LastTerminationState.Terminated != nil && cs.RestartCount > 0 {
			if time.Since(cs.LastTerminationState.Terminated.FinishedAt.Time) < 5*time.Minute {
				issues = append(issues, makeContainerIssue(ctx, pod.Name, "warning", "HighRestarts", cs.LastTerminationState.Terminated.Message, cs.Name, cs.RestartCount))
			}
		}
	}
	return issues
}

func appendInitContainerIssues(issues []MonitorIssue, pod v1.Pod, ctx podIssueContext) []MonitorIssue {
	for _, cs := range pod.Status.InitContainerStatuses {
		if cs.State.Waiting == nil {
			continue
		}
		reason := cs.State.Waiting.Reason
		message := cs.State.Waiting.Message
		issueType := waitingIssueType(reason, false)
		containerName := cs.Name + " (init)"
		issues = append(issues, makeContainerIssue(ctx, pod.Name, issueType, reason, message, containerName, cs.RestartCount))
	}
	return issues
}

func appendConditionIssues(issues []MonitorIssue, pod v1.Pod, ctx podIssueContext) []MonitorIssue {
	for _, cond := range pod.Status.Conditions {
		if cond.Status != v1.ConditionFalse {
			continue
		}
		if cond.Type == v1.PodReady || cond.Type == v1.PodInitialized {
			reason := string(cond.Type) + "False"
			issues = append(issues, makePodIssue(ctx, pod.Name, "warning", reason, cond.Message))
		}
	}
	return issues
}

// checkPodIssues examines pod statuses for problematic conditions
func (a *App) checkPodIssues(namespace string) []MonitorIssue {
	var issues []MonitorIssue

	clientset, err := a.getMonitorClientset()
	if err != nil {
		return issues
	}

	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return issues
	}

	for _, pod := range pods.Items {
		age := formatAge(pod.CreationTimestamp.Time)
		ownerKind, ownerName := getOwnerInfo(&pod)
		podPhase := string(pod.Status.Phase)
		nodeName := pod.Spec.NodeName
		ctx := podIssueContext{
			Namespace: namespace,
			Age:       age,
			PodPhase:  podPhase,
			OwnerKind: ownerKind,
			OwnerName: ownerName,
			NodeName:  nodeName,
		}

		// Check overall pod phase
		if pod.Status.Phase == v1.PodFailed {
			issues = append(issues, makePodIssue(ctx, pod.Name, "error", "PodFailed", pod.Status.Message))
			continue
		}

		issues = appendContainerStatusIssues(issues, pod, ctx)
		issues = appendInitContainerIssues(issues, pod, ctx)
		issues = appendConditionIssues(issues, pod, ctx)
	}

	return issues
}

// checkEventIssues examines k8s events for warnings in the namespace
func (a *App) checkEventIssues(namespace string) []MonitorIssue {
	var issues []MonitorIssue

	var clientset kubernetes.Interface
	var err error
	if a.testClientset != nil {
		clientset = a.testClientset.(kubernetes.Interface)
	} else {
		clientset, err = a.createKubernetesClient()
		if err != nil {
			return issues
		}
	}

	// Get events from the last 10 minutes
	tenMinutesAgo := time.Now().Add(-10 * time.Minute)

	// Core/v1 Events
	if list, err := clientset.CoreV1().Events(namespace).List(a.ctx, metav1.ListOptions{}); err == nil {
		for _, e := range list.Items {
			// Only include Warning events
			if e.Type != "Warning" {
				continue
			}

			// Skip old events
			lastTime := e.LastTimestamp.Time
			if lastTime.IsZero() && !e.EventTime.Time.IsZero() {
				lastTime = e.EventTime.Time
			}
			if lastTime.Before(tenMinutesAgo) {
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
	}

	// events.k8s.io/v1 Events
	if list, err := clientset.EventsV1().Events(namespace).List(a.ctx, metav1.ListOptions{}); err == nil {
		for _, e := range list.Items {
			// Only include Warning events
			if e.Type != "Warning" {
				continue
			}

			// Skip old events
			lastTime := e.EventTime.Time
			if lastTime.IsZero() && !e.DeprecatedLastTimestamp.Time.IsZero() {
				lastTime = e.DeprecatedLastTimestamp.Time
			}
			if lastTime.Before(tenMinutesAgo) {
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
	}

	return issues
}
