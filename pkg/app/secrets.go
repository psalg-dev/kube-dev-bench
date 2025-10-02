package app

import (
	"encoding/base64"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// GetSecretData fetches a Secret by name in the current namespace and returns its data as base64 strings
func (a *App) GetSecretData(secretName string) (map[string]string, error) {
	out := make(map[string]string)

	if secretName == "" {
		return out, fmt.Errorf("secret name is required")
	}

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

	s, err := clientset.CoreV1().Secrets(a.currentNamespace).Get(a.ctx, secretName, metav1.GetOptions{})
	if err != nil {
		return out, err
	}

	// Convert data to base64 strings for transport
	for k, v := range s.Data {
		if len(v) == 0 {
			out[k] = ""
			continue
		}
		out[k] = base64.StdEncoding.EncodeToString(v)
	}

	return out, nil
}

// GetSecrets retrieves all secrets in the given namespace
func (a *App) GetSecrets(namespace string) ([]map[string]interface{}, error) {
	var secrets []map[string]interface{}

	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return secrets, err
	}
	if a.currentKubeContext == "" {
		return secrets, fmt.Errorf("no kube context selected")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return secrets, err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return secrets, err
	}

	ns := namespace
	if ns == "" {
		ns = a.currentNamespace
	}
	if ns == "" {
		return secrets, fmt.Errorf("no namespace specified")
	}

	secretList, err := clientset.CoreV1().Secrets(ns).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return secrets, err
	}

	for _, secret := range secretList.Items {
		age := "-"
		if secret.CreationTimestamp.Time != (time.Time{}) {
			dur := time.Since(secret.CreationTimestamp.Time)
			age = formatDuration(dur)
		}

		// Count keys and calculate approximate size
		keyCount := len(secret.Data)
		totalSize := 0
		for _, v := range secret.Data {
			totalSize += len(v)
		}

		secrets = append(secrets, map[string]interface{}{
			"name":      secret.Name,
			"namespace": secret.Namespace,
			"type":      string(secret.Type),
			"keys":      fmt.Sprintf("%d", keyCount),
			"size":      formatBytes(totalSize),
			"age":       age,
		})
	}

	return secrets, nil
}
