package app

import (
	"encoding/base64"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
)

// maxSecretValueSize is the maximum size of a single secret key value returned to the frontend (IMP-4).
const maxSecretValueSize = 64 * 1024 // 64 KiB

// GetSecretData fetches a Secret by name in the current namespace and returns its data as base64 strings.
// Individual key values are capped at maxSecretValueSize; larger values are truncated.
func (a *App) GetSecretData(secretName string) (map[string]string, error) {
	out := make(map[string]string)

	if secretName == "" {
		return out, fmt.Errorf("secret name is required")
	}
	if a.currentNamespace == "" {
		return out, fmt.Errorf("no namespace selected")
	}
	clientset, err := a.getClient()
	if err != nil {
		return out, err
	}
	s, err := clientset.CoreV1().Secrets(a.currentNamespace).Get(a.ctx, secretName, metav1.GetOptions{})
	if err != nil {
		return out, err
	}

	// Convert data to base64 strings for transport (IMP-4: cap at 64 KiB per key)
	for k, v := range s.Data {
		if len(v) == 0 {
			out[k] = ""
			continue
		}
		truncated := len(v) > maxSecretValueSize
		if truncated {
			v = v[:maxSecretValueSize]
		}
		encoded := base64.StdEncoding.EncodeToString(v)
		if truncated {
			out[k] = encoded + "[TRUNCATED]"
		} else {
			out[k] = encoded
		}
	}

	return out, nil
}

// GetSecrets retrieves all secrets in the given namespace
func (a *App) GetSecrets(namespace string) ([]map[string]interface{}, error) {
	secrets := make([]map[string]interface{}, 0)

	ns := namespace
	if ns == "" {
		ns = a.currentNamespace
	}
	if ns == "" {
		return secrets, fmt.Errorf("no namespace specified")
	}

	if factory, ok := a.getInformerNamespaceFactory(ns); ok {
		secretList, err := factory.Core().V1().Secrets().Lister().Secrets(ns).List(labels.Everything())
		if err == nil {
			secrets = make([]map[string]interface{}, 0, len(secretList))
			for _, secret := range secretList {
				age := "-"
				if secret.CreationTimestamp.Time != (time.Time{}) {
					age = formatDuration(time.Since(secret.CreationTimestamp.Time))
				}

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
	}

	clientset, err := a.getClient()
	if err != nil {
		return secrets, err
	}

	secretList, err := clientset.CoreV1().Secrets(ns).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return secrets, err
	}
	secrets = make([]map[string]interface{}, 0, len(secretList.Items))

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
