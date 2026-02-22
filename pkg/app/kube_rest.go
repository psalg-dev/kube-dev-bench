package app

import (
	"fmt"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// getRESTConfig returns a *rest.Config for the current kube context, performing an
// insecure fallback (Insecure=true & clearing CA data) when a certificate error occurs.
// It updates a.isInsecureConnection accordingly so the frontend can reflect connection security.
func (a *App) getRESTConfig() (*rest.Config, error) {
	configPath := a.getKubeConfigPath()
	cfg, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return nil, err
	}
	if a.currentKubeContext == "" {
		return nil, fmt.Errorf("no kube context selected")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*cfg, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return nil, err
	}

	// Apply proxy configuration if set
	a.applyProxyConfig(restConfig)

	// Probe cluster to detect TLS issues early. We do a lightweight namespaced call via a temp clientset.
	if err := a.probeRESTConfig(restConfig); err != nil {
		if isCertError(err) && !restConfig.TLSClientConfig.Insecure {
			// Apply insecure fallback
			restConfig.TLSClientConfig.Insecure = true
			restConfig.TLSClientConfig.CAData = nil
			restConfig.TLSClientConfig.CAFile = ""
			a.isInsecureConnection = true
			// Log warning only once per application lifecycle
			a.insecureWarnOnce.Do(func() {
				fmt.Printf("[WARN] TLS error detected for context '%s'. Falling back to insecure mode (certificate verification disabled).\n", a.currentKubeContext)
			})
			// Re-probe only for non-permission errors
			if perr := a.probeRESTConfig(restConfig); perr != nil && isCertError(perr) {
				return nil, perr
			}
			return restConfig, nil
		}
		// Non cert error -> return original error (permission or others)
		return nil, err
	}

	a.isInsecureConnection = false
	return restConfig, nil
}

// getKubernetesClient returns a clientset using getRESTConfig.
func (a *App) getKubernetesClient() (*kubernetes.Clientset, error) {
	rc, err := a.getRESTConfig()
	if err != nil {
		return nil, err
	}
	return kubernetes.NewForConfig(rc)
}

// getKubernetesInterface returns a kubernetes.Interface for use with testClientset.
// Prefer using this function in resource actions to enable testing.
func (a *App) getKubernetesInterface() (kubernetes.Interface, error) {
	if a.TestClientset != nil {
		return a.TestClientset, nil
	}
	if a.testClientset != nil {
		return a.testClientset.(kubernetes.Interface), nil
	}
	return a.getKubernetesClient()
}

// probeRESTConfig attempts a minimal API call to detect TLS / auth issues.
func (a *App) probeRESTConfig(rc *rest.Config) error {
	cs, err := kubernetes.NewForConfig(rc)
	if err != nil {
		return err
	}
	// We limit to 1 to reduce load; if RBAC denies listing namespaces, we still return that error.
	_, err = cs.CoreV1().Namespaces().List(a.ctx, metav1.ListOptions{Limit: 1})
	return err
}

func isCertError(err error) bool {
	if err == nil {
		return false
	}
	e := err.Error()
	le := strings.ToLower(e)
	return strings.Contains(e, "x509:") || strings.Contains(le, "certificate") || strings.Contains(e, "unknown authority")
}
