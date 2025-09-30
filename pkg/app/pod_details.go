package app

import (
	"fmt"

	"gopkg.in/yaml.v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// GetPodYAML returns the live Pod manifest as YAML
func (a *App) GetPodYAML(podName string) (string, error) {
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
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	out, err := yaml.Marshal(pod)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

// GetPodContainers returns the list of container names for the pod (regular containers only)
func (a *App) GetPodContainers(podName string) ([]string, error) {
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
	if a.currentNamespace == "" {
		return nil, fmt.Errorf("no namespace selected")
	}
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(pod.Spec.Containers))
	for _, c := range pod.Spec.Containers {
		names = append(names, c.Name)
	}
	return names, nil
}

// GetPodSummary fetches a pod and returns a concise summary
func (a *App) GetPodSummary(podName string) (PodSummary, error) {
	var out PodSummary
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return out, err
	}
	if a.currentKubeContext == "" {
		return out, fmt.Errorf("no kube context selected")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return out, err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return out, err
	}
	if a.currentNamespace == "" {
		return out, fmt.Errorf("no namespace selected")
	}
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return out, err
	}
	status := string(pod.Status.Phase)

	// Extract container ports
	ports := []int{}
	for _, c := range pod.Spec.Containers {
		for _, p := range c.Ports {
			if p.ContainerPort > 0 {
				ports = append(ports, int(p.ContainerPort))
			}
		}
	}

	out = PodSummary{
		Name:      pod.Name,
		Namespace: pod.Namespace,
		Created:   pod.CreationTimestamp.Time,
		Labels:    pod.Labels,
		Status:    status,
		Ports:     ports,
	}
	return out, nil
}

// GetPodContainerPorts returns a flat list of all defined container ports for the pod
func (a *App) GetPodContainerPorts(podName string) ([]int, error) {
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
	if a.currentNamespace == "" {
		return nil, fmt.Errorf("no namespace selected")
	}
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	ports := []int{}
	for _, c := range pod.Spec.Containers {
		for _, p := range c.Ports {
			if p.ContainerPort > 0 {
				ports = append(ports, int(p.ContainerPort))
			}
		}
	}
	return ports, nil
}
