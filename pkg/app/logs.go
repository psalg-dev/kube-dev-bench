package app

import (
	"bufio"
	"context"
	"fmt"
	"strings"
	"sync"

	v1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes"
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
		emitEvent(a.ctx, PodLogsEvent(podName), "[stream stop requested]")
	}
}

// StreamPodLogs streams logs for a pod and emits each line as a Wails event.
// For multi-container pods, logs from all containers are streamed concurrently
// with each line prefixed by the container name (e.g. "[container-name] line").
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
			emitEvent(a.ctx, PodLogsEvent(podName), "[error] no namespace selected")
			return
		}
		clientset, err := a.getKubernetesClient()
		if err != nil {
			emitEvent(a.ctx, PodLogsEvent(podName), "[error] client: "+err.Error())
			return
		}

		// Detect multi-container pod
		containers, multiContainer := a.getPodContainerNames(podName)
		if multiContainer {
			a.streamAllContainerLogs(streamCtx, podName, containers, true)
			return
		}

		opts := &v1.PodLogOptions{Follow: true}
		stream, err := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts).Stream(streamCtx)
		if err != nil {
			emitEvent(a.ctx, PodLogsEvent(podName), "[error] log stream: "+err.Error())
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
			emitEvent(a.ctx, PodLogsEvent(podName), line)
		}
		if err := scanner.Err(); err != nil {
			emitEvent(a.ctx, PodLogsEvent(podName), "[error] scan error: "+err.Error())
		}
		emitEvent(a.ctx, PodLogsEvent(podName), "[stream closed]")
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
			emitEvent(a.ctx, PodLogsEvent(podName), "[error] no namespace selected")
			return
		}
		clientset, err := a.getKubernetesClient()
		if err != nil {
			emitEvent(a.ctx, PodLogsEvent(podName), "[error] client: "+err.Error())
			return
		}
		opts := &v1.PodLogOptions{Follow: true, Container: container}
		stream, err := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts).Stream(streamCtx)
		if err != nil {
			emitEvent(a.ctx, PodLogsEvent(podName), "[error] log stream: "+err.Error())
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
			emitEvent(a.ctx, PodLogsEvent(podName), line)
		}
		if err := scanner.Err(); err != nil {
			emitEvent(a.ctx, PodLogsEvent(podName), "[error] scan error: "+err.Error())
		}
		emitEvent(a.ctx, PodLogsEvent(podName), "[stream closed]")
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

		// If no specific container requested, detect multi-container pod
		if container == "" {
			containers, multiContainer := a.getPodContainerNames(podName)
			if multiContainer {
				a.streamAllContainerLogsWith(ctx, podName, containers, tailLines, follow)
				return
			}
		}

		if err := a.streamLogsToEvents(ctx, podName, container, tailLines, follow); err != nil {
			emitEvent(a.ctx, PodLogsEvent(podName), "[error] "+err.Error())
		}
		if follow {
			emitEvent(a.ctx, PodLogsEvent(podName), "[stream closed]")
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
		emitEvent(a.ctx, PodLogsEvent(podName), scanner.Text())
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

// GetPodLog returns the full log content of a pod (no follow).
// For multi-container pods, logs from all containers are aggregated
// with each section prefixed by the container name.
func (a *App) GetPodLog(podName string) (string, error) {
	if a.currentNamespace == "" {
		return "", fmt.Errorf("no namespace selected")
	}
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return "", err
	}

	// Detect multi-container pod
	containers, multiContainer := a.getPodContainerNames(podName)
	if multiContainer {
		return a.getAggregatedContainerLogs(podName, containers)
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

// getPodContainerNames returns all regular container names for the given pod.
// The second return value indicates whether the pod has more than one container.
// Delegates to GetPodContainers (pod_details.go) to avoid duplicating the API call.
func (a *App) getPodContainerNames(podName string) ([]string, bool) {
	names, err := a.GetPodContainers(podName)
	if err != nil || len(names) == 0 {
		return nil, false
	}
	return names, len(names) > 1
}

// streamAllContainerLogs streams logs from all containers concurrently
// with each line prefixed by [container-name]. Used for follow=true streaming.
func (a *App) streamAllContainerLogs(ctx context.Context, podName string, containers []string, follow bool) {
	cs, err := a.getKubernetesClient()
	if err != nil {
		emitEvent(a.ctx, PodLogsEvent(podName), fmt.Sprintf("[error] client: %s", err.Error()))
		return
	}
	var wg sync.WaitGroup
	for _, c := range containers {
		wg.Add(1)
		go func(container string) {
			defer wg.Done()
			a.streamContainerWithPrefix(ctx, cs, podName, container, nil, follow)
		}(c)
	}
	wg.Wait()
	if follow {
		emitEvent(a.ctx, PodLogsEvent(podName), "[stream closed]")
	}
}

// streamAllContainerLogsWith streams logs from all containers with tail/follow options.
func (a *App) streamAllContainerLogsWith(ctx context.Context, podName string, containers []string, tailLines int, follow bool) {
	cs, err := a.getKubernetesClient()
	if err != nil {
		emitEvent(a.ctx, PodLogsEvent(podName), fmt.Sprintf("[error] client: %s", err.Error()))
		return
	}
	var tl *int64
	if tailLines > 0 {
		v := int64(tailLines)
		tl = &v
	}
	var wg sync.WaitGroup
	for _, c := range containers {
		wg.Add(1)
		go func(container string) {
			defer wg.Done()
			a.streamContainerWithPrefix(ctx, cs, podName, container, tl, follow)
		}(c)
	}
	wg.Wait()
	if follow {
		emitEvent(a.ctx, PodLogsEvent(podName), "[stream closed]")
	}
}

// streamContainerWithPrefix streams logs for a single container
// and prefixes each line with [container-name].
// The clientset is passed in by the caller (streamAllContainerLogs / streamAllContainerLogsWith)
// so that a single shared client is reused across all container goroutines.
func (a *App) streamContainerWithPrefix(ctx context.Context, clientset kubernetes.Interface, podName, container string, tailLines *int64, follow bool) {
	if a.currentNamespace == "" {
		emitEvent(a.ctx, PodLogsEvent(podName), fmt.Sprintf("[%s] [error] no namespace selected", container))
		return
	}
	opts := &v1.PodLogOptions{Follow: follow, Container: container, TailLines: tailLines}
	stream, err := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts).Stream(ctx)
	if err != nil {
		emitEvent(a.ctx, PodLogsEvent(podName), fmt.Sprintf("[%s] [error] log stream: %s", container, err.Error()))
		return
	}
	defer stream.Close()

	prefix := fmt.Sprintf("[%s] ", container)
	scanner := bufio.NewScanner(stream)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
		}
		emitEvent(a.ctx, PodLogsEvent(podName), prefix+scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		emitEvent(a.ctx, PodLogsEvent(podName), fmt.Sprintf("[%s] [error] scan error: %s", container, err.Error()))
	}
}

// getAggregatedContainerLogs fetches logs from all containers in a pod
// and returns them as a single string with container name prefixes.
func (a *App) getAggregatedContainerLogs(podName string, containers []string) (string, error) {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return "", err
	}

	var b strings.Builder
	for _, c := range containers {
		opts := &v1.PodLogOptions{Follow: false, Container: c}
		data, err := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts).Do(a.ctx).Raw()
		if err != nil {
			b.WriteString(fmt.Sprintf("[%s] [error] %s\n", c, err.Error()))
			continue
		}
		lines := strings.Split(string(data), "\n")
		prefix := fmt.Sprintf("[%s] ", c)
		for _, line := range lines {
			if line == "" {
				continue
			}
			b.WriteString(prefix)
			b.WriteString(line)
			b.WriteString("\n")
		}
	}
	return b.String(), nil
}
