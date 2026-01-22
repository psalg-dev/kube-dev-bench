package app

import (
	"fmt"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
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
			wailsRuntime.EventsEmit(a.ctx, "monitor:update", info)
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

	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return issues
	}

	for _, pod := range pods.Items {
		age := formatAge(pod.CreationTimestamp.Time)
		ownerKind, ownerName := getOwnerInfo(&pod)
		podPhase := string(pod.Status.Phase)
		nodeName := pod.Spec.NodeName

		// Check overall pod phase
		if pod.Status.Phase == v1.PodFailed {
			issues = append(issues, MonitorIssue{
				Type:      "error",
				Resource:  "Pod",
				Namespace: namespace,
				Name:      pod.Name,
				Reason:    "PodFailed",
				Message:   pod.Status.Message,
				Age:       age,
				PodPhase:  podPhase,
				OwnerKind: ownerKind,
				OwnerName: ownerName,
				NodeName:  nodeName,
			})
			continue
		}

		// Check container statuses for waiting states
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.State.Waiting != nil {
				reason := cs.State.Waiting.Reason
				message := cs.State.Waiting.Message
				issueType := "warning"

				// Classify certain waiting reasons as errors
				if reason == "CrashLoopBackOff" || reason == "ImagePullBackOff" ||
					reason == "ErrImagePull" || reason == "CreateContainerError" {
					issueType = "error"
				}

				issues = append(issues, MonitorIssue{
					Type:          issueType,
					Resource:      "Pod",
					Namespace:     namespace,
					Name:          pod.Name,
					Reason:        reason,
					Message:       message,
					ContainerName: cs.Name,
					RestartCount:  cs.RestartCount,
					Age:           age,
					PodPhase:      podPhase,
					OwnerKind:     ownerKind,
					OwnerName:     ownerName,
					NodeName:      nodeName,
				})
			}

			// Check for terminated containers with non-zero exit codes
			if cs.State.Terminated != nil && cs.State.Terminated.ExitCode != 0 {
				issues = append(issues, MonitorIssue{
					Type:          "error",
					Resource:      "Pod",
					Namespace:     namespace,
					Name:          pod.Name,
					Reason:        cs.State.Terminated.Reason,
					Message:       cs.State.Terminated.Message,
					ContainerName: cs.Name,
					RestartCount:  cs.RestartCount,
					Age:           age,
					PodPhase:      podPhase,
					OwnerKind:     ownerKind,
					OwnerName:     ownerName,
					NodeName:      nodeName,
				})
			}

			// Check last terminated state for restart issues
			if cs.LastTerminationState.Terminated != nil && cs.RestartCount > 0 {
				// Only report if restarts are recent (within last 5 minutes)
				if time.Since(cs.LastTerminationState.Terminated.FinishedAt.Time) < 5*time.Minute {
					issues = append(issues, MonitorIssue{
						Type:          "warning",
						Resource:      "Pod",
						Namespace:     namespace,
						Name:          pod.Name,
						Reason:        "HighRestarts",
						Message:       cs.LastTerminationState.Terminated.Message,
						ContainerName: cs.Name,
						RestartCount:  cs.RestartCount,
						Age:           age,
						PodPhase:      podPhase,
						OwnerKind:     ownerKind,
						OwnerName:     ownerName,
						NodeName:      nodeName,
					})
				}
			}
		}

		// Check init container statuses
		for _, cs := range pod.Status.InitContainerStatuses {
			if cs.State.Waiting != nil {
				reason := cs.State.Waiting.Reason
				message := cs.State.Waiting.Message
				issueType := "warning"

				if reason == "ImagePullBackOff" || reason == "ErrImagePull" ||
					reason == "CreateContainerError" {
					issueType = "error"
				}

				issues = append(issues, MonitorIssue{
					Type:          issueType,
					Resource:      "Pod",
					Namespace:     namespace,
					Name:          pod.Name,
					Reason:        reason,
					Message:       message,
					ContainerName: cs.Name + " (init)",
					RestartCount:  cs.RestartCount,
					Age:           age,
					PodPhase:      podPhase,
					OwnerKind:     ownerKind,
					OwnerName:     ownerName,
					NodeName:      nodeName,
				})
			}
		}

		// Check pod conditions
		for _, cond := range pod.Status.Conditions {
			if cond.Status == v1.ConditionFalse {
				// Report certain failed conditions as warnings
				if cond.Type == v1.PodReady || cond.Type == v1.PodInitialized {
					issues = append(issues, MonitorIssue{
						Type:      "warning",
						Resource:  "Pod",
						Namespace: namespace,
						Name:      pod.Name,
						Reason:    string(cond.Type) + "False",
						Message:   cond.Message,
						Age:       age,
						PodPhase:  podPhase,
						OwnerKind: ownerKind,
						OwnerName: ownerName,
						NodeName:  nodeName,
					})
				}
			}
		}
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
