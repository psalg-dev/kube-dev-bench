package app

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// GetConfigMaps returns all configmaps in a namespace
func (a *App) GetConfigMaps(namespace string) ([]ConfigMapInfo, error) {
	var clientset kubernetes.Interface
	var err error

	if a.testClientset != nil {
		clientset = a.testClientset.(kubernetes.Interface)
	} else {
		configPath := a.getKubeConfigPath()
		config, err := clientcmd.LoadFromFile(configPath)
		if err != nil {
			return nil, err
		}
		if a.currentKubeContext == "" {
			return nil, fmt.Errorf("Kein Kontext gewählt")
		}
		clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
		restConfig, err := clientConfig.ClientConfig()
		if err != nil {
			return nil, err
		}
		clientset, err = kubernetes.NewForConfig(restConfig)
		if err != nil {
			return nil, err
		}
	}

	configMaps, err := clientset.CoreV1().ConfigMaps(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var result []ConfigMapInfo
	now := time.Now()

	for _, cm := range configMaps.Items {
		age := "-"
		if cm.CreationTimestamp.Time != (time.Time{}) {
			dur := now.Sub(cm.CreationTimestamp.Time)
			age = formatDuration(dur)
		}

		// Count the number of keys in the configmap
		keys := len(cm.Data) + len(cm.BinaryData)

		// Calculate total size of data
		totalSize := 0
		for _, v := range cm.Data {
			totalSize += len(v)
		}
		for _, v := range cm.BinaryData {
			totalSize += len(v)
		}

		size := formatBytes(totalSize)

		result = append(result, ConfigMapInfo{
			Name:      cm.Name,
			Namespace: cm.Namespace,
			Age:       age,
			Keys:      keys,
			Size:      size,
			Labels:    cm.Labels,
		})
	}

	return result, nil
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
	return fmt.Sprintf("%.1f %s", float64(bytes)/float64(div), sizes[exp])
}

// StartConfigMapPolling emits configmaps:update events periodically with the current configmap list
func (a *App) StartConfigMapPolling() {
	startResourcePolling(a, ResourcePollingConfig[ConfigMapInfo]{
		EventName: "configmaps:update",
		FetchFn:   a.GetConfigMaps,
	})
}
