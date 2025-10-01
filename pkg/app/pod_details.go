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

// GetPodMounts returns volumes and volume mounts (incl. secret mounts) for a pod
func (a *App) GetPodMounts(podName string) (PodMounts, error) {
	var result PodMounts

	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return result, err
	}
	if a.currentKubeContext == "" {
		return result, fmt.Errorf("no kube context selected")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return result, err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return result, err
	}
	if a.currentNamespace == "" {
		return result, fmt.Errorf("no namespace selected")
	}
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return result, err
	}

	// Build volumes info
	vols := make([]VolumeInfo, 0, len(pod.Spec.Volumes))
	for _, v := range pod.Spec.Volumes {
		vi := VolumeInfo{Name: v.Name}
		if v.Secret != nil {
			vi.Type = "Secret"
			vi.SecretName = v.Secret.SecretName
		} else if v.ConfigMap != nil {
			vi.Type = "ConfigMap"
			if v.ConfigMap.Name != "" {
				vi.ConfigMapName = v.ConfigMap.Name
			}
		} else if v.PersistentVolumeClaim != nil {
			vi.Type = "PVC"
			vi.PersistentVolumeClaim = v.PersistentVolumeClaim.ClaimName
		} else if v.HostPath != nil {
			vi.Type = "HostPath"
			if v.HostPath.Path != "" {
				vi.HostPath = v.HostPath.Path
			}
		} else if v.EmptyDir != nil {
			vi.Type = "EmptyDir"
			vi.EmptyDir = true
		} else if v.Projected != nil {
			vi.Type = "Projected"
			for _, src := range v.Projected.Sources {
				if src.Secret != nil {
					name := src.Secret.Name
					if name != "" {
						vi.ProjectedSecretNames = append(vi.ProjectedSecretNames, name)
					}
				}
				if src.ConfigMap != nil {
					name := src.ConfigMap.Name
					if name != "" {
						vi.ProjectedConfigMapNames = append(vi.ProjectedConfigMapNames, name)
					}
				}
			}
		} else if v.DownwardAPI != nil {
			vi.Type = "DownwardAPI"
		} else if v.CSI != nil {
			vi.Type = "CSI"
		} else {
			vi.Type = "Other"
		}
		vols = append(vols, vi)
	}
	result.Volumes = vols

	// Because k8s VolumeMount is a concrete type, just loop directly for each container list
	for _, c := range pod.Spec.InitContainers {
		cm := ContainerMountInfo{Container: c.Name, IsInit: true}
		for _, m := range c.VolumeMounts {
			cm.Mounts = append(cm.Mounts, MountInfo{
				Name:      m.Name,
				MountPath: m.MountPath,
				ReadOnly:  m.ReadOnly,
				SubPath:   m.SubPath,
			})
		}
		result.Containers = append(result.Containers, cm)
	}
	for _, c := range pod.Spec.Containers {
		cm := ContainerMountInfo{Container: c.Name, IsInit: false}
		for _, m := range c.VolumeMounts {
			cm.Mounts = append(cm.Mounts, MountInfo{
				Name:      m.Name,
				MountPath: m.MountPath,
				ReadOnly:  m.ReadOnly,
				SubPath:   m.SubPath,
			})
		}
		result.Containers = append(result.Containers, cm)
	}

	return result, nil
}
