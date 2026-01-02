package app

import (
	"fmt"
	"sort"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes" // added for createKubernetesClient return type
)

// Helper function retained for backward compatibility – now delegates to central helper
func (a *App) createKubernetesClient() (*kubernetes.Clientset, error) {
	return a.getKubernetesClient()
}

// GetConnectionStatus returns connection security status for frontend
func (a *App) GetConnectionStatus() map[string]interface{} {
	fmt.Printf("[DEBUG] GetConnectionStatus called: isInsecure=%v, connected=%v, proxyEnabled=%v\n", a.isInsecureConnection, a.currentKubeContext != "", a.IsProxyEnabled())
	return map[string]interface{}{
		"isInsecure":   a.isInsecureConnection,
		"connected":    a.currentKubeContext != "",
		"proxyEnabled": a.IsProxyEnabled(),
		"proxyURL":     a.GetProxyDisplayURL(),
		"proxyType":    a.proxyAuthType,
	}
}

// GetNamespaces connects to the cluster and returns namespace names
func (a *App) GetNamespaces() ([]string, error) {
	var clientset kubernetes.Interface
	var err error
	if a.testClientset != nil {
		clientset = a.testClientset.(kubernetes.Interface)
	} else {
		clientset, err = a.createKubernetesClient()
		if err != nil {
			return nil, err
		}
	}

	nsList, err := clientset.CoreV1().Namespaces().List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var namespaces []string
	for _, ns := range nsList.Items {
		namespaces = append(namespaces, ns.Name)
	}
	sort.Strings(namespaces)
	return namespaces, nil
}
