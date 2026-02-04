package app

import (
	"k8s.io/client-go/kubernetes"
)

// getClient returns a Kubernetes clientset for API calls.
// It returns the test clientset if one is injected (for testing),
// otherwise it creates a real client from the kubeconfig.
//
// This helper consolidates the duplicated client getter pattern
// found in ~16 resource handler files.
func (a *App) getClient() (kubernetes.Interface, error) {
	if a.testClientset != nil {
		return a.testClientset.(kubernetes.Interface), nil
	}
	return a.getKubernetesClient()
}
