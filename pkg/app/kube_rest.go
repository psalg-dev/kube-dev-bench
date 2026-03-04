package app

import (
	"crypto/x509"
	"fmt"
	"net/url"
	"os"
	"regexp"
	"strings"

	"gowails/pkg/logger"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

// getRESTConfig returns a *rest.Config for the current kube context.
// Instead of auto-degrading to insecure TLS on cert errors, it returns structured
// sentinel errors so the frontend can prompt the user for explicit consent.
//
// Permission / RBAC errors during probing are tolerated — they prove the cluster is reachable.
// 401 Unauthorized errors are distinguished from 403 Forbidden and surface as ErrAuthExpired.
func (a *App) getRESTConfig() (*rest.Config, error) {
	cfg, err := a.loadKubeconfig()
	if err != nil {
		return nil, err
	}

	if a.currentKubeContext == "" {
		logger.Error("getRESTConfig: no kube context selected")
		return nil, fmt.Errorf("no kube context selected")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*cfg, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		// Gap 5: detect exec binary not found
		if binary := extractExecBinaryFromError(err); binary != "" {
			logger.Error("getRESTConfig: exec provider binary not found", "binary", binary, "error", err)
			emitEvent(a.ctx, EventExecProviderNotFound, map[string]interface{}{
				"binary":  binary,
				"context": a.currentKubeContext,
				"error":   err.Error(),
			})
			return nil, &ErrExecBinaryNotFound{Binary: binary, Err: err}
		}
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

	// Probe cluster to detect TLS / auth issues early.
	if err := a.probeRESTConfig(restConfig); err != nil {
		// Gap 2: TLS cert errors → require explicit user consent instead of auto-degrade
		if isCertError(err) {
			if a.allowInsecure {
				// User has previously opted in via ConnectInsecure
				restConfig.TLSClientConfig.Insecure = true
				restConfig.TLSClientConfig.CAData = nil
				restConfig.TLSClientConfig.CAFile = ""
				a.isInsecureConnection = true
				a.insecureWarnOnce.Do(func() {
					logger.Warn("TLS error detected, using insecure mode (user opted in)", "context", a.currentKubeContext)
				})
				// Re-probe
				if perr := a.probeRESTConfig(restConfig); perr != nil && isCertError(perr) {
					logger.Error("getRESTConfig: insecure re-probe also failed with cert error", "error", perr)
					return nil, perr
				}
				return restConfig, nil
			}

			// No opt-in: emit event and return sentinel error
			host := extractHostFromRESTConfig(restConfig)
			logger.Warn("getRESTConfig: TLS cert error, requesting user consent", "host", host, "error", err)
			emitEvent(a.ctx, EventTLSCertError, map[string]interface{}{
				"host":    host,
				"context": a.currentKubeContext,
				"error":   err.Error(),
			})
			return nil, &ErrTLSCertVerification{Host: host, Err: err}
		}

		// Gap 6: detect 407 Proxy Authentication Required
		if isProxyAuthRequired(err) {
			logger.Warn("getRESTConfig: proxy requires authentication (407)", "error", err)
			emitEvent(a.ctx, EventProxyAuthRequired, map[string]interface{}{
				"context": a.currentKubeContext,
				"error":   err.Error(),
			})
			return nil, fmt.Errorf("proxy requires NTLM/Negotiate authentication: %w", err)
		}

		// Gap 3: distinguish 401 from 403
		if isUnauthenticated(err) {
			logger.Warn("getRESTConfig: cluster probe returned 401 Unauthorized", "context", a.currentKubeContext, "error", err)
			emitEvent(a.ctx, EventConnectionAuthExpired, map[string]interface{}{
				"context": a.currentKubeContext,
				"error":   err.Error(),
			})
			return nil, &ErrAuthExpired{Context: a.currentKubeContext, Err: err}
		}
		if isRBACForbidden(err) {
			logger.Warn("getRESTConfig: cluster probe returned 403 Forbidden (RBAC); connection allowed", "context", a.currentKubeContext, "error", err)
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

// loadKubeconfig loads the kubeconfig using either merged multi-path loading (Gap 4)
// or the legacy single-file approach.
func (a *App) loadKubeconfig() (*clientcmdapi.Config, error) {
	// Gap 4: merged kubeconfig loading
	if len(a.kubeconfigPaths) > 0 {
		loadingRules := &clientcmd.ClientConfigLoadingRules{
			Precedence: a.kubeconfigPaths,
		}
		cfg, err := loadingRules.Load()
		if err != nil {
			logger.Error("loadKubeconfig: failed to load merged kubeconfigs", "paths", a.kubeconfigPaths, "error", err)
			return nil, err
		}
		logger.Info("loadKubeconfig: loaded merged kubeconfigs", "paths", a.kubeconfigPaths, "contexts", len(cfg.Contexts))
		return cfg, nil
	}

	// Check KUBECONFIG env var for multi-path
	if envPaths := os.Getenv("KUBECONFIG"); envPaths != "" {
		loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
		cfg, err := loadingRules.Load()
		if err != nil {
			logger.Warn("loadKubeconfig: KUBECONFIG env merge failed, falling back to single file", "error", err)
		} else if len(cfg.Contexts) > 0 {
			logger.Info("loadKubeconfig: loaded from KUBECONFIG env var", "contexts", len(cfg.Contexts))
			return cfg, nil
		}
	}

	// Legacy single-file load
	configPath := a.getKubeConfigPath()
	logger.Info("loadKubeconfig: loading single kubeconfig", "path", configPath, "context", a.currentKubeContext)
	cfg, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		logger.Error("loadKubeconfig: failed to load kubeconfig", "path", configPath, "error", err)
		return nil, err
	}
	return cfg, nil
}

// ConnectInsecure explicitly connects with TLS verification disabled.
// This should only be called after the user has confirmed the insecure opt-in dialog.
func (a *App) ConnectInsecure(context string) error {
	if context == "" {
		return fmt.Errorf("context name required")
	}
	a.allowInsecure = true
	logger.Warn("ConnectInsecure: user opted into insecure TLS", "context", context)

	// Re-attempt connection via SetCurrentKubeContext which will call getRESTConfig
	return a.SetCurrentKubeContext(context)
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
// Deprecated: use isRBACForbidden or isUnauthenticated for accurate classification.
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

// isProxyAuthRequired returns true when the error indicates a 407 Proxy
// Authentication Required response, typically from NTLM/Kerberos proxies.
func isProxyAuthRequired(err error) bool {
	if err == nil {
		return false
	}
	le := strings.ToLower(err.Error())
	return strings.Contains(le, "407") || strings.Contains(le, "proxy authentication required") || strings.Contains(le, "proxy-authenticate")
}

// extractHostFromRESTConfig extracts the hostname from the REST config's Host field.
func extractHostFromRESTConfig(rc *rest.Config) string {
	if rc == nil {
		return "unknown"
	}
	u, err := url.Parse(rc.Host)
	if err != nil {
		return rc.Host
	}
	if h := u.Hostname(); h != "" {
		return h
	}
	// url.Parse treats schemeless strings as paths; return raw host.
	return rc.Host
}

// execBinaryRegexp captures the binary name from "exec: \"<name>\": ..." style errors.
var execBinaryRegexp = regexp.MustCompile(`exec:\s*"([^"]+)"`)

// execFileNotFoundRegexp captures the binary name from "executable file not found" errors.
var execFileNotFoundRegexp = regexp.MustCompile(`"([^"]+)":\s*executable file not found`)

// extractExecBinaryFromError attempts to extract a credential provider binary name
// from an error message. Returns empty string if not an exec-binary error.
func extractExecBinaryFromError(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	if !strings.Contains(msg, "executable file not found") && !strings.Contains(msg, "exec:") {
		return ""
	}
	if m := execFileNotFoundRegexp.FindStringSubmatch(msg); len(m) >= 2 {
		return m[1]
	}
	if m := execBinaryRegexp.FindStringSubmatch(msg); len(m) >= 2 {
		return m[1]
	}
	return ""
}
