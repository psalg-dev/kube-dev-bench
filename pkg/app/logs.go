package app

import (
	"bufio"
	"context"
	"fmt"

	v1 "k8s.io/api/core/v1"
)

// StopPodLogs stops an active log stream for the given pod if running
func (a *App) StopPodLogs(podName string) {
	a.logMu.Lock()
	cancel, ok := a.logCancels[podName]
	if ok {
		delete(a.logCancels, podName)
	}
	a.logMu.Unlock()
	if ok && cancel != nil {
		cancel()
		emitEvent(a.ctx, "podlogs:"+podName, "[stream stop requested]")
	}
}

// StreamPodLogs streams logs for a pod and emits each line as a Wails event
func (a *App) StreamPodLogs(podName string) {
	// stop any previous stream for this pod
	a.StopPodLogs(podName)

	go func() {
		// derive cancellable context for this stream
		streamCtx, cancel := context.WithCancel(a.ctx)
		a.logMu.Lock()
		a.logCancels[podName] = cancel
		a.logMu.Unlock()
		defer func() {
			// cleanup registration
			a.logMu.Lock()
			delete(a.logCancels, podName)
			a.logMu.Unlock()
			cancel()
		}()

		if a.currentNamespace == "" {
			emitEvent(a.ctx, "podlogs:"+podName, "[error] no namespace selected")
			return
		}
		clientset, err := a.getKubernetesClient()
		if err != nil {
			emitEvent(a.ctx, "podlogs:"+podName, "[error] client: "+err.Error())
			return
		}
		opts := &v1.PodLogOptions{Follow: true}
		stream, err := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts).Stream(streamCtx)
		if err != nil {
			emitEvent(a.ctx, "podlogs:"+podName, "[error] log stream: "+err.Error())
			return
		}
		defer stream.Close()
		scanner := bufio.NewScanner(stream)
		for scanner.Scan() {
			select {
			case <-streamCtx.Done():
				return
			default:
			}
			line := scanner.Text()
			emitEvent(a.ctx, "podlogs:"+podName, line)
		}
		if err := scanner.Err(); err != nil {
			emitEvent(a.ctx, "podlogs:"+podName, "[error] scan error: "+err.Error())
		}
		emitEvent(a.ctx, "podlogs:"+podName, "[stream closed]")
	}()
}

// StreamPodContainerLogs streams logs for a pod container and emits each line as a Wails event
func (a *App) StreamPodContainerLogs(podName, container string) {
	// stop any previous stream for this pod
	a.StopPodLogs(podName)

	go func() {
		streamCtx, cancel := context.WithCancel(a.ctx)
		a.logMu.Lock()
		a.logCancels[podName] = cancel
		a.logMu.Unlock()
		defer func() {
			a.logMu.Lock()
			delete(a.logCancels, podName)
			a.logMu.Unlock()
			cancel()
		}()

		if a.currentNamespace == "" {
			emitEvent(a.ctx, "podlogs:"+podName, "[error] no namespace selected")
			return
		}
		clientset, err := a.getKubernetesClient()
		if err != nil {
			emitEvent(a.ctx, "podlogs:"+podName, "[error] client: "+err.Error())
			return
		}
		opts := &v1.PodLogOptions{Follow: true, Container: container}
		stream, err := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts).Stream(streamCtx)
		if err != nil {
			emitEvent(a.ctx, "podlogs:"+podName, "[error] log stream: "+err.Error())
			return
		}
		defer stream.Close()
		scanner := bufio.NewScanner(stream)
		for scanner.Scan() {
			select {
			case <-streamCtx.Done():
				return
			default:
			}
			line := scanner.Text()
			emitEvent(a.ctx, "podlogs:"+podName, line)
		}
		if err := scanner.Err(); err != nil {
			emitEvent(a.ctx, "podlogs:"+podName, "[error] scan error: "+err.Error())
		}
		emitEvent(a.ctx, "podlogs:"+podName, "[stream closed]")
	}()
}

// StreamPodLogsWith streams logs with optional tail lines & follow flags.
func (a *App) StreamPodLogsWith(podName string, tailLines int, follow bool) {
	a.streamPodLogsInternal(podName, "", tailLines, follow)
}

// StreamPodContainerLogsWith streams logs for a specific container with tail/follow options.
func (a *App) StreamPodContainerLogsWith(podName, container string, tailLines int, follow bool) {
	a.streamPodLogsInternal(podName, container, tailLines, follow)
}

func (a *App) streamPodLogsInternal(podName, container string, tailLines int, follow bool) {
	a.StopPodLogs(podName)
	go func() {
		ctx, cancel := context.WithCancel(a.ctx)
		a.registerLogCancel(podName, cancel)
		defer a.unregisterLogCancel(podName, cancel)

		if err := a.streamLogsToEvents(ctx, podName, container, tailLines, follow); err != nil {
			emitEvent(a.ctx, "podlogs:"+podName, "[error] "+err.Error())
		}
		if follow {
			emitEvent(a.ctx, "podlogs:"+podName, "[stream closed]")
		}
	}()
}

func (a *App) registerLogCancel(podName string, cancel context.CancelFunc) {
	a.logMu.Lock()
	a.logCancels[podName] = cancel
	a.logMu.Unlock()
}

func (a *App) unregisterLogCancel(podName string, cancel context.CancelFunc) {
	a.logMu.Lock()
	delete(a.logCancels, podName)
	a.logMu.Unlock()
	cancel()
}

func (a *App) streamLogsToEvents(ctx context.Context, podName, container string, tailLines int, follow bool) error {
	if a.currentNamespace == "" {
		return fmt.Errorf("no namespace selected")
	}
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return fmt.Errorf("client: %w", err)
	}

	opts := a.buildLogOptions(container, tailLines, follow)
	stream, err := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts).Stream(ctx)
	if err != nil {
		return fmt.Errorf("log stream: %w", err)
	}
	defer stream.Close()

	scanner := bufio.NewScanner(stream)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return nil
		default:
		}
		emitEvent(a.ctx, "podlogs:"+podName, scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scan error: %w", err)
	}
	return nil
}

func (a *App) buildLogOptions(container string, tailLines int, follow bool) *v1.PodLogOptions {
	var tl *int64
	if tailLines > 0 {
		v := int64(tailLines)
		tl = &v
	}
	opts := &v1.PodLogOptions{Follow: follow, TailLines: tl}
	if container != "" {
		opts.Container = container
	}
	return opts
}

// GetPodLog returns the full log content of a pod (no follow)
func (a *App) GetPodLog(podName string) (string, error) {
	if a.currentNamespace == "" {
		return "", fmt.Errorf("no namespace selected")
	}
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return "", err
	}
	opts := &v1.PodLogOptions{Follow: false}
	data, err := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts).Do(a.ctx).Raw()
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// GetPodContainerLog returns the full log content of a specific container (no follow)
func (a *App) GetPodContainerLog(podName, container string) (string, error) {
	if a.currentNamespace == "" {
		return "", fmt.Errorf("no namespace selected")
	}
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return "", err
	}
	opts := &v1.PodLogOptions{Follow: false, Container: container}
	data, err := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts).Do(a.ctx).Raw()
	if err != nil {
		return "", err
	}
	return string(data), nil
}
