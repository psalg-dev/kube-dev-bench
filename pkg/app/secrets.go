package app

import (
	"encoding/base64"
	"fmt"

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
