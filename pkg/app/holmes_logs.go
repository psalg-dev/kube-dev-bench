package app

import (
	"context"
	"fmt"
	"time"

	"gowails/pkg/app/holmesgpt"

	corev1 "k8s.io/api/core/v1"
)

const defaultLogAnalysisLines = 200

// AnalyzeLogs retrieves logs for a pod/container and asks HolmesGPT to analyze them.
func (a *App) AnalyzeLogs(namespace, podName, containerName string, lines int) (*holmesgpt.HolmesResponse, error) {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	if namespace == "" {
		namespace = a.currentNamespace
	}
	if namespace == "" {
		return nil, fmt.Errorf("namespace required")
	}
	if podName == "" {
		return nil, fmt.Errorf("pod name required")
	}
	if lines <= 0 {
		lines = defaultLogAnalysisLines
	}

	log.Info("AnalyzeLogs: starting",
		"namespace", namespace,
		"pod", podName,
		"container", containerName,
		"lines", lines)

	logs, err := a.getPodLogs(namespace, podName, containerName, lines)
	if err != nil {
		log.Error("AnalyzeLogs: failed to get logs",
			"error", err,
			"elapsed", time.Since(startTime))
		return nil, fmt.Errorf("failed to get logs: %w", err)
	}

	containerInfo := ""
	if containerName != "" {
		containerInfo = fmt.Sprintf(" (container: %s)", containerName)
	}

	question := fmt.Sprintf(
		"Analyze these logs from pod %s/%s%s and identify any issues:\n\n```\n%s\n```\n\nWhat problems do you see? What could be causing them? How can they be fixed?",
		namespace, podName, containerInfo, logs,
	)

	resp, err := a.AskHolmes(question)
	if err != nil {
		log.Error("AnalyzeLogs: analysis failed",
			"error", err,
			"elapsed", time.Since(startTime))
	} else {
		log.Info("AnalyzeLogs: completed",
			"responseLen", len(resp.Response),
			"elapsed", time.Since(startTime))
	}

	return resp, err
}

func (a *App) getPodLogs(namespace, podName, containerName string, lines int) (string, error) {
	if a.testPodLogsFetcher != nil {
		return a.testPodLogsFetcher(namespace, podName, containerName, lines)
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}

	var tailLines *int64
	if lines > 0 {
		v := int64(lines)
		tailLines = &v
	}

	logOptions := &corev1.PodLogOptions{
		TailLines: tailLines,
	}
	if containerName != "" {
		logOptions.Container = containerName
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	logCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()

	req := clientset.CoreV1().Pods(namespace).GetLogs(podName, logOptions)
	logs, err := req.DoRaw(logCtx)
	if err != nil {
		return "", fmt.Errorf("failed to get logs: %w", err)
	}

	return string(logs), nil
}
