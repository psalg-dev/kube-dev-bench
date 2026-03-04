package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"gowails/pkg/app/holmesgpt"
)

// AppConfig represents the persistent configuration
type AppConfig struct {
	CurrentContext      string   `json:"currentContext"`
	CurrentNamespace    string   `json:"currentNamespace"`
	PreferredNamespaces []string `json:"preferredNamespaces"`
	UseInformers        bool     `json:"useInformers"`
	RememberContext     bool     `json:"rememberContext"`
	RememberNamespace   bool     `json:"rememberNamespace"`
	KubeConfigPath      string   `json:"kubeConfigPath"`
	// Proxy configuration
	ProxyURL      string `json:"proxyURL"`
	ProxyAuthType string `json:"proxyAuthType"` // "none", "basic", "system"
	ProxyUsername string `json:"proxyUsername"`
	ProxyPassword string `json:"proxyPassword"`
	// Custom CA certificate path for Kubernetes API connections
	CustomCAPath string `json:"customCAPath,omitempty"`
	// Holmes AI configuration
	HolmesConfig holmesgpt.HolmesConfigData `json:"holmesConfig,omitempty"`
}

// loadConfig loads the saved configuration from disk
func (a *App) loadConfig() error {
	data, err := os.ReadFile(a.configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // No config file yet, not an error
		}
		return err
	}

	var config AppConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return err
	}
	a.currentKubeContext = config.CurrentContext
	a.currentNamespace = config.CurrentNamespace
	a.preferredNamespaces = append([]string(nil), config.PreferredNamespaces...)
	a.useInformers = config.UseInformers
	a.rememberContext = config.RememberContext
	a.rememberNamespace = config.RememberNamespace
	a.kubeConfig = config.KubeConfigPath
	a.customCAPath = config.CustomCAPath
	// Load proxy configuration
	a.proxyURL = config.ProxyURL
	a.proxyAuthType = config.ProxyAuthType
	a.proxyUsername = config.ProxyUsername
	a.proxyPassword = config.ProxyPassword
	// Load Holmes configuration
	holmesConfig = config.HolmesConfig
	return nil
}

// saveConfig persists the current configuration to disk
func (a *App) saveConfig() error {
	config := AppConfig{
		CurrentContext:      a.currentKubeContext,
		CurrentNamespace:    a.currentNamespace,
		PreferredNamespaces: append([]string(nil), a.preferredNamespaces...),
		UseInformers:        a.useInformers,
		RememberContext:     a.rememberContext,
		RememberNamespace:   a.rememberNamespace,
		KubeConfigPath:      a.kubeConfig,
		CustomCAPath:        a.customCAPath,
		// Proxy configuration
		ProxyURL:      a.proxyURL,
		ProxyAuthType: a.proxyAuthType,
		ProxyUsername: a.proxyUsername,
		ProxyPassword: a.proxyPassword,
		// Holmes AI configuration
		HolmesConfig: holmesConfig,
	}
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	// Ensure the parent directory exists
	if err := os.MkdirAll(filepath.Dir(a.configPath), 0o750); err != nil {
		return err
	}
	// #nosec G306 -- config contains user-specific settings.
	return os.WriteFile(a.configPath, data, 0o600)
}

// getKubeConfigPath returns the kubeconfig path to use
func (a *App) getKubeConfigPath() string {
	if a.kubeConfig != "" {
		return a.kubeConfig
	}
	// Default to ~/.kube/config
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".kube", "config")
}

// SetKubeConfigPath sets the kubeconfig file path to use
func (a *App) SetKubeConfigPath(path string) error {
	// Run pre-connect hooks before validating the kubeconfig.
	// This allows users to prepare environment or materialize files.
	preEnv := map[string]string{
		"KDB_CONNECTION_TYPE": "kubernetes",
		"KDB_CONNECTION_ID":   path,
		"KUBECONFIG":          path,
		"KUBE_CONTEXT":        a.currentKubeContext,
	}
	if _, err := a.runPreConnectHooks("kubernetes", path, preEnv); err != nil {
		return fmt.Errorf("pre-connect hook aborted connection: %w", err)
	}

	// Validate the file exists and is readable
	if _, err := os.Stat(path); err != nil {
		return fmt.Errorf("kubeconfig file not accessible: %w", err)
	}

	// Validate it's a valid kubeconfig
	_, err := a.getContextsFromFile(path)
	if err != nil {
		return fmt.Errorf("invalid kubeconfig file: %w", err)
	}

	// Store the path in our app config
	a.kubeConfig = path
	if err := a.saveConfig(); err != nil {
		return err
	}

	// Fire post-connect hooks asynchronously after the kubeconfig is accepted.
	a.runPostConnectHooksAsync("kubernetes", path, preEnv)
	return nil
}

// SetCurrentKubeContext stores the selected context name
func (a *App) SetCurrentKubeContext(name string) error {
	a.currentKubeContext = name
	a.restartInformerManager()
	// Trigger a counts refresh (context switch invalidates prior data)
	a.requestCountsRefresh()
	if a.rememberContext {
		return a.saveConfig()
	}
	return nil
}

// SetCurrentNamespace stores the selected namespace
func (a *App) SetCurrentNamespace(ns string) error {
	a.currentNamespace = ns
	// Ensure preferredNamespaces has this namespace as first if empty (legacy compatibility)
	if len(a.preferredNamespaces) == 0 && ns != "" {
		a.preferredNamespaces = []string{ns}
	}
	a.restartInformerManager()
	a.requestCountsRefresh()
	if a.rememberNamespace {
		return a.saveConfig()
	}
	return nil
}

// SetPreferredNamespaces stores the selected namespaces (multi-select)
func (a *App) SetPreferredNamespaces(namespaces []string) error {
	a.preferredNamespaces = append([]string(nil), namespaces...)
	// Ensure currentNamespace tracks the first selected (for backward-compat APIs)
	if len(namespaces) > 0 {
		a.currentNamespace = namespaces[0]
	}
	a.restartInformerManager()
	a.requestCountsRefresh()
	if a.rememberNamespace {
		return a.saveConfig()
	}
	return nil
}

// SetRememberContext sets the rememberContext flag and saves config
func (a *App) SetRememberContext(val bool) error {
	a.rememberContext = val
	return a.saveConfig()
}

// GetRememberContext returns the rememberContext flag
func (a *App) GetRememberContext() bool { return a.rememberContext }

// SetRememberNamespace sets the rememberNamespace flag and saves config
func (a *App) SetRememberNamespace(val bool) error {
	a.rememberNamespace = val
	return a.saveConfig()
}

// GetRememberNamespace returns the rememberNamespace flag
func (a *App) GetRememberNamespace() bool { return a.rememberNamespace }

// GetUseInformers returns whether informer-based updates are enabled.
func (a *App) GetUseInformers() bool { return a.useInformers }

// GetCustomCAPath returns the configured custom CA certificate path for Kubernetes connections.
func (a *App) GetCustomCAPath() string { return a.customCAPath }

// SetCustomCAPath sets an optional custom CA certificate file path used for TLS
// verification when connecting to Kubernetes clusters whose server certificate
// is signed by a private / enterprise CA not in the system trust store.
// Pass an empty string to clear.
func (a *App) SetCustomCAPath(path string) error {
	if path != "" {
		if _, err := os.Stat(path); err != nil {
			return fmt.Errorf("custom CA file not accessible: %w", err)
		}
	}
	a.customCAPath = path
	return a.saveConfig()
}

// SetUseInformers switches between polling and informer-based update mode.
func (a *App) SetUseInformers(val bool) error {
	if a.useInformers == val {
		return nil
	}
	a.useInformers = val
	if a.useInformers {
		a.StopAllPolling()
		a.startInformerManager()
	} else {
		a.stopInformerManager()
		a.StartAllPolling()
	}
	return a.saveConfig()
}
