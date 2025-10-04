package app

import (
	"encoding/base64"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GetSecretData fetches a Secret by name in the current namespace and returns its data as base64 strings
func (a *App) GetSecretData(secretName string) (map[string]string, error) {
	out := make(map[string]string)

	if secretName == "" {
		return out, fmt.Errorf("secret name is required")
	}
	if a.currentNamespace == "" {
		return out, fmt.Errorf("no namespace selected")
	}
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return out, err
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

	clientset, err := a.getKubernetesClient()
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
			age = formatDuration(time.Since(secret.CreationTimestamp.Time))
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
			"labels":    secret.Labels,
		})
	}

	return secrets, nil
}
