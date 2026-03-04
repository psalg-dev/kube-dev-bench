package app

import (
	"sort"

	"gowails/pkg/logger"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes" // added for createKubernetesClient return type
	"k8s.io/client-go/tools/clientcmd"
)

// Helper function retained for backward compatibility – now delegates to central helper
func (a *App) createKubernetesClient() (*kubernetes.Clientset, error) {
	return a.getKubernetesClient()
}

// GetConnectionStatus returns connection security status for frontend
func (a *App) GetConnectionStatus() map[string]interface{} {
	logger.Debug("GetConnectionStatus called",
		"isInsecure", a.isInsecureConnection,
		"connected", a.currentKubeContext != "",
		"proxyEnabled", a.IsProxyEnabled(),
	)
	return map[string]interface{}{
		"isInsecure":   a.isInsecureConnection,
		"connected":    a.currentKubeContext != "",
		"proxyEnabled": a.IsProxyEnabled(),
		"proxyURL":     a.GetProxyDisplayURL(),
		"proxyType":    a.proxyAuthType,
	}
}

// GetNamespaces connects to the cluster and returns namespace names.
// If RBAC prevents listing namespaces cluster-wide, it falls back to
// extracting the default namespace from the kubeconfig context.
func (a *App) GetNamespaces() ([]string, error) {
	logger.Info("GetNamespaces called", "context", a.currentKubeContext)

	clientset, err := a.getClient()
	if err != nil {
		logger.Error("GetNamespaces: failed to get client", "error", err)
		return nil, err
	}

	nsList, err := clientset.CoreV1().Namespaces().List(a.ctx, metav1.ListOptions{})
	if err != nil {
		logger.Warn("GetNamespaces: cluster-wide list failed, attempting RBAC fallback", "error", err)
		// RBAC fallback: if the user cannot list namespaces cluster-wide,
		// derive a usable namespace list from the kubeconfig context.
		if isPermissionError(err) {
			ns := a.namespaceFromKubeconfig()
			if ns != "" {
				logger.Info("GetNamespaces: RBAC fallback succeeded", "namespace", ns)
				return []string{ns}, nil
			}
			logger.Info("GetNamespaces: no namespace in kubeconfig, falling back to 'default'")
			return []string{"default"}, nil
		}
		return nil, err
	}

	namespaces := make([]string, 0, len(nsList.Items))
	for _, ns := range nsList.Items {
		namespaces = append(namespaces, ns.Name)
	}
	sort.Strings(namespaces)
	logger.Info("GetNamespaces: success", "count", len(namespaces))
	return namespaces, nil
}

// namespaceFromKubeconfig reads the default namespace configured in the
// kubeconfig for the current context. Returns "" if none is set.
func (a *App) namespaceFromKubeconfig() string {
	configPath := a.getKubeConfigPath()
	cfg, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		logger.Warn("namespaceFromKubeconfig: could not load kubeconfig", "error", err)
		return ""
	}
	ctxObj, ok := cfg.Contexts[a.currentKubeContext]
	if !ok || ctxObj == nil {
		return ""
	}
	return ctxObj.Namespace
}
