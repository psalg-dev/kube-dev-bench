package app

import (
	"context"
	"time"

	"gowails/pkg/logger"

	"k8s.io/client-go/kubernetes"
)

// startSessionProbe begins a background goroutine that periodically probes the
// cluster with a lightweight /version call. On 401, it calls handleUnauthenticated.
// The probe is opt-in: sessionProbeInterval must be > 0 (set via settings).
func (a *App) startSessionProbe() {
	a.sessionProbeMu.Lock()
	defer a.sessionProbeMu.Unlock()

	// Stop any existing probe
	if a.sessionProbeCancel != nil {
		a.sessionProbeCancel()
		a.sessionProbeCancel = nil
	}

	interval := a.sessionProbeInterval
	if interval <= 0 {
		logger.Debug("session probe disabled (interval=0)")
		return
	}
	if interval < 5*time.Minute {
		interval = 5 * time.Minute
	}

	ctx, cancel := context.WithCancel(a.ctx)
	a.sessionProbeCancel = cancel

	logger.Info("starting session probe", "interval", interval)
	go a.runSessionProbe(ctx, interval)
}

// stopSessionProbe stops the background session probe goroutine.
func (a *App) stopSessionProbe() {
	a.sessionProbeMu.Lock()
	defer a.sessionProbeMu.Unlock()

	if a.sessionProbeCancel != nil {
		a.sessionProbeCancel()
		a.sessionProbeCancel = nil
		logger.Info("session probe stopped")
	}
}

func (a *App) runSessionProbe(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			a.probeSessionLiveness(ctx)
		}
	}
}

func (a *App) probeSessionLiveness(ctx context.Context) {
	if a.currentKubeContext == "" {
		return
	}

	rc, err := a.getRESTConfig()
	if err != nil {
		// If it's an auth-expired error, handleUnauthenticated is already called in getRESTConfig
		logger.Debug("session probe: getRESTConfig failed", "error", err)
		return
	}

	cs, err := kubernetes.NewForConfig(rc)
	if err != nil {
		logger.Debug("session probe: failed to create clientset", "error", err)
		return
	}

	_, err = cs.Discovery().ServerVersion()
	if err != nil {
		if isUnauthenticated(err) {
			a.handleUnauthenticated(a.currentKubeContext)
		} else {
			logger.Debug("session probe: version check failed", "error", err)
		}
	}
}

// RefreshCredentials re-runs pre-connect hooks and rebuilds the Kubernetes client
// to pick up refreshed tokens without disconnecting (no namespace or UI state change).
func (a *App) RefreshCredentials(contextName string) error {
	if contextName == "" {
		contextName = a.currentKubeContext
	}
	if contextName == "" {
		return nil
	}

	logger.Info("RefreshCredentials: re-running pre-connect hooks", "context", contextName)

	// Re-run pre-connect hooks
	preEnv := map[string]string{
		"KDB_CONNECTION_TYPE": "kubernetes",
		"KDB_CONNECTION_ID":   contextName,
		"KUBECONFIG":          a.getKubeConfigPath(),
		"KUBE_CONTEXT":        contextName,
	}
	if _, err := a.runPreConnectHooks("kubernetes", contextName, preEnv); err != nil {
		return err
	}

	// Rebuild the REST config to pick up refreshed tokens
	_, err := a.getRESTConfig()
	if err != nil {
		return err
	}

	logger.Info("RefreshCredentials: credentials refreshed successfully", "context", contextName)

	// Fire post-connect hooks
	a.runPostConnectHooksAsync("kubernetes", contextName, preEnv)
	return nil
}

// SetSessionProbeInterval sets the background liveness probe interval.
// 0 disables the probe. Minimum value when enabled is 5 minutes.
func (a *App) SetSessionProbeInterval(minutes int) error {
	if minutes < 0 {
		minutes = 0
	}
	a.sessionProbeInterval = time.Duration(minutes) * time.Minute

	// Restart the probe with the new interval
	if a.currentKubeContext != "" {
		a.startSessionProbe()
	}

	return a.saveConfig()
}

// GetSessionProbeInterval returns the current session probe interval in minutes.
func (a *App) GetSessionProbeInterval() int {
	if a.sessionProbeInterval <= 0 {
		return 0
	}
	return int(a.sessionProbeInterval / time.Minute)
}
