package app

import (
	"fmt"
	"gopkg.in/yaml.v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GetPodYAML returns the live Pod manifest as YAML
func (a *App) GetPodYAML(podName string) (string, error) {
	if a.currentNamespace == "" {
		return "", fmt.Errorf("no namespace selected")
	}
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return "", err
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
	if a.currentNamespace == "" {
		return nil, fmt.Errorf("no namespace selected")
	}
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return nil, err
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
	if a.currentNamespace == "" {
		return out, fmt.Errorf("no namespace selected")
	}
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return out, err
	}
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return out, err
	}
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
		Status:    string(pod.Status.Phase),
		Ports:     ports,
	}
	return out, nil
}

// GetPodContainerPorts returns a flat list of all defined container ports for the pod
func (a *App) GetPodContainerPorts(podName string) ([]int, error) {
	if a.currentNamespace == "" {
		return nil, fmt.Errorf("no namespace selected")
	}
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return nil, err
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
	if a.currentNamespace == "" {
		return result, fmt.Errorf("no namespace selected")
	}
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return result, err
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
		cm := ContainerMountInfo{Container: c.Name}
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
