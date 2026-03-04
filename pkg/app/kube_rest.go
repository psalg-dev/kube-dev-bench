package app

import (
	"crypto/x509"
	"fmt"
	"os"
	"strings"

	"gowails/pkg/logger"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// getRESTConfig returns a *rest.Config for the current kube context, performing an
// insecure fallback (Insecure=true & clearing CA data) when a certificate error occurs.
// It updates a.isInsecureConnection accordingly so the frontend can reflect connection security.
// Permission / RBAC errors during probing are tolerated — they prove the cluster is reachable.
func (a *App) getRESTConfig() (*rest.Config, error) {
	configPath := a.getKubeConfigPath()
	logger.Info("getRESTConfig: loading kubeconfig", "path", configPath, "context", a.currentKubeContext)
	cfg, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		logger.Error("getRESTConfig: failed to load kubeconfig", "path", configPath, "error", err)
		return nil, err
	}
	if a.currentKubeContext == "" {
		logger.Error("getRESTConfig: no kube context selected")
		return nil, fmt.Errorf("no kube context selected")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*cfg, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		logger.Error("getRESTConfig: failed to build client config", "context", a.currentKubeContext, "error", err)
		return nil, err
	}

	// Apply custom CA certificate if configured
	if err := a.applyCustomCA(restConfig); err != nil {
		logger.Error("getRESTConfig: failed to apply custom CA", "path", a.customCAPath, "error", err)
		return nil, err
	}

	// Apply proxy configuration if set
	a.applyProxyConfig(restConfig)

	// Probe cluster to detect TLS issues early. We do a lightweight call via a temp clientset.
	if err := a.probeRESTConfig(restConfig); err != nil {
		if isCertError(err) && !restConfig.TLSClientConfig.Insecure {
			// Apply insecure fallback
			restConfig.TLSClientConfig.Insecure = true
			restConfig.TLSClientConfig.CAData = nil
			restConfig.TLSClientConfig.CAFile = ""
			a.isInsecureConnection = true
			a.insecureWarnOnce.Do(func() {
				logger.Warn("TLS error detected, falling back to insecure mode", "context", a.currentKubeContext)
			})
			// Re-probe only for non-permission errors
			if perr := a.probeRESTConfig(restConfig); perr != nil && isCertError(perr) {
				logger.Error("getRESTConfig: insecure re-probe also failed with cert error", "error", perr)
				return nil, perr
			}
			return restConfig, nil
		}
		// Permission / RBAC errors mean the cluster IS reachable, just restricted.
		// Do NOT block connection for those — the user may still be able to
		// access specific namespaces even without cluster-wide list permission.
		if isPermissionError(err) {
			logger.Warn("getRESTConfig: cluster probe returned permission error (RBAC); connection allowed", "context", a.currentKubeContext, "error", err)
			a.isInsecureConnection = false
			return restConfig, nil
		}
		if isAuthDiscoveryRecoverableError(err) {
			logger.Warn("getRESTConfig: cluster probe returned auth-provider error; allowing kubeconfig-scoped namespace fallback", "context", a.currentKubeContext, "error", err)
			a.isInsecureConnection = false
			return restConfig, nil
		}
		logger.Error("getRESTConfig: probe failed with non-recoverable error", "context", a.currentKubeContext, "error", err)
		return nil, err
	}

	logger.Info("getRESTConfig: probe successful", "context", a.currentKubeContext)
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
	// Use the /version endpoint first — it is unauthenticated on most clusters
	// and avoids RBAC issues. If it fails with a TLS error, we surface it.
	_, err = cs.Discovery().ServerVersion()
	if err != nil {
		logger.Warn("probeRESTConfig: server version probe failed", "error", err)
		return err
	}
	// Optionally try listing 1 namespace — if forbidden, return that error
	// so callers can decide to tolerate it.
	_, err = cs.CoreV1().Namespaces().List(a.ctx, metav1.ListOptions{Limit: 1})
	if err != nil {
		logger.Debug("probeRESTConfig: namespace list probe returned error", "error", err)
	}
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

// applyCustomCA merges a user-supplied CA certificate file into the REST config's
// TLS trust chain. When the kubeconfig already carries its own CA data, the custom
// CA is _appended_ so both the original and the custom authority are trusted.
func (a *App) applyCustomCA(rc *rest.Config) error {
	if a.customCAPath == "" {
		return nil
	}
	customPEM, err := os.ReadFile(a.customCAPath)
	if err != nil {
		return fmt.Errorf("read custom CA file %s: %w", a.customCAPath, err)
	}
	// Validate that the file contains at least one PEM certificate.
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(customPEM) {
		return fmt.Errorf("custom CA file %s contains no valid PEM certificates", a.customCAPath)
	}

	// Merge: append the custom CA PEM to whatever CA data the kubeconfig already has.
	var merged []byte

	// Start with existing inline CA data.
	if len(rc.TLSClientConfig.CAData) > 0 {
		merged = append(merged, rc.TLSClientConfig.CAData...)
		merged = append(merged, '\n')
	}
	// Include existing CA file contents.
	if rc.TLSClientConfig.CAFile != "" {
		if existing, readErr := os.ReadFile(rc.TLSClientConfig.CAFile); readErr == nil {
			merged = append(merged, existing...)
			merged = append(merged, '\n')
		}
	}
	// Append the custom CA.
	merged = append(merged, customPEM...)

	// Replace file/data references with the merged PEM bundle.
	rc.TLSClientConfig.CAData = merged
	rc.TLSClientConfig.CAFile = ""
	logger.Info("applyCustomCA: injected custom CA into REST config", "path", a.customCAPath)
	return nil
}

// isPermissionError returns true if err is a Kubernetes API Forbidden or Unauthorized error.
func isPermissionError(err error) bool {
	if err == nil {
		return false
	}
	if apierrors.IsForbidden(err) || apierrors.IsUnauthorized(err) {
		return true
	}
	// Fallback: some wrapped errors lose the structured status code.
	le := strings.ToLower(err.Error())
	return strings.Contains(le, "forbidden") || strings.Contains(le, "unauthorized")
}

// isAuthDiscoveryRecoverableError returns true for auth-provider / OIDC errors
// where we should still allow connection setup and let namespace fallback logic
// proceed from kubeconfig context defaults.
func isAuthDiscoveryRecoverableError(err error) bool {
	if err == nil {
		return false
	}
	le := strings.ToLower(err.Error())
	authIndicators := []string{
		"auth-provider",
		"no auth provider found",
		"you must be logged in",
		"provide credentials",
		"oidc",
		"id-token",
		"refresh token",
		"token is expired",
		"oauth2",
	}
	for _, indicator := range authIndicators {
		if strings.Contains(le, indicator) {
			return true
		}
	}
	return false
}
