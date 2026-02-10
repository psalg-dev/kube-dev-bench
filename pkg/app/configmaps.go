package app

import (
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// buildConfigMapInfo constructs a ConfigMapInfo from a ConfigMap
func buildConfigMapInfo(cm *corev1.ConfigMap, now time.Time) ConfigMapInfo {
	keys := len(cm.Data) + len(cm.BinaryData)

	totalSize := 0
	for _, v := range cm.Data {
		totalSize += len(v)
	}
	for _, v := range cm.BinaryData {
		totalSize += len(v)
	}

	return ConfigMapInfo{
		Name:      cm.Name,
		Namespace: cm.Namespace,
		Age:       FormatAge(cm.CreationTimestamp, now),
		Keys:      keys,
		Size:      formatBytes(totalSize),
		Labels:    cm.Labels,
	}
}

// GetConfigMaps returns all configmaps in a namespace
func (a *App) GetConfigMaps(namespace string) ([]ConfigMapInfo, error) {
	return listResources(a, namespace,
		func(cs kubernetes.Interface, ns string, opts metav1.ListOptions) ([]corev1.ConfigMap, error) {
			list, err := cs.CoreV1().ConfigMaps(ns).List(a.ctx, opts)
			if err != nil {
				return nil, err
			}
			return list.Items, nil
		},
		buildConfigMapInfo,
	)
}

// formatBytes converts bytes to human readable format
func formatBytes(bytes int) string {
	if bytes == 0 {
		return "0 B"
	}

	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}

	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}

	sizes := []string{"B", "KB", "MB", "GB", "TB"}
	if exp >= len(sizes) {
		exp = len(sizes) - 1
	}
	return fmt.Sprintf("%.1f %s", float64(bytes)/float64(div), sizes[exp])
}
