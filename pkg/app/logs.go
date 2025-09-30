package app

import (
	"bufio"
	"context"
	"fmt"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	v1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
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
		runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[stream stop requested]")
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

		configPath := a.getKubeConfigPath()
		config, err := clientcmd.LoadFromFile(configPath)
		if err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] loading kubeconfig: "+err.Error())
			return
		}
		if a.currentKubeContext == "" {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] no kube context selected")
			return
		}
		clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
		restConfig, err := clientConfig.ClientConfig()
		if err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] client config: "+err.Error())
			return
		}
		clientset, err := kubernetes.NewForConfig(restConfig)
		if err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] clientset: "+err.Error())
			return
		}
		if a.currentNamespace == "" {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] no namespace selected")
			return
		}
		opts := &v1.PodLogOptions{Follow: true}
		stream, err := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts).Stream(streamCtx)
		if err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] log stream: "+err.Error())
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
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, line)
		}
		if err := scanner.Err(); err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] scan error: "+err.Error())
		}
		runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[stream closed]")
	}()
}

// StreamPodContainerLogs streams logs for a pod container and emits each line as a Wails event
func (a *App) StreamPodContainerLogs(podName string, container string) {
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

		configPath := a.getKubeConfigPath()
		config, err := clientcmd.LoadFromFile(configPath)
		if err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] loading kubeconfig: "+err.Error())
			return
		}
		if a.currentKubeContext == "" {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] no kube context selected")
			return
		}
		clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
		restConfig, err := clientConfig.ClientConfig()
		if err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] client config: "+err.Error())
			return
		}
		clientset, err := kubernetes.NewForConfig(restConfig)
		if err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] clientset: "+err.Error())
			return
		}
		if a.currentNamespace == "" {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] no namespace selected")
			return
		}
		opts := &v1.PodLogOptions{Follow: true, Container: container}
		stream, err := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts).Stream(streamCtx)
		if err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] log stream: "+err.Error())
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
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, line)
		}
		if err := scanner.Err(); err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] scan error: "+err.Error())
		}
		runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[stream closed]")
	}()
}

// GetPodLog returns the full log content of a pod (no follow)
func (a *App) GetPodLog(podName string) (string, error) {
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return "", err
	}
	if a.currentKubeContext == "" {
		return "", fmt.Errorf("no kube context selected")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return "", err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return "", err
	}
	if a.currentNamespace == "" {
		return "", fmt.Errorf("no namespace selected")
	}
	opts := &v1.PodLogOptions{Follow: false}
	req := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts)
	data, err := req.Do(a.ctx).Raw()
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// GetPodContainerLog returns the full log content of a specific container (no follow)
func (a *App) GetPodContainerLog(podName string, container string) (string, error) {
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return "", err
	}
	if a.currentKubeContext == "" {
		return "", fmt.Errorf("no kube context selected")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return "", err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return "", err
	}
	if a.currentNamespace == "" {
		return "", fmt.Errorf("no namespace selected")
	}
	opts := &v1.PodLogOptions{Follow: false, Container: container}
	req := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts)
	data, err := req.Do(a.ctx).Raw()
	if err != nil {
		return "", err
	}
	return string(data), nil
}
