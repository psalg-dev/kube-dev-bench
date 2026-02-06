package app

import (
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"gopkg.in/yaml.v3"
)

// kubeConfigFile represents the kubeconfig YAML structure (relevant parts)
type kubeConfigFile struct {
	Contexts []struct {
		Name    string                 `yaml:"name"`
		Context map[string]interface{} `yaml:"context"`
	} `yaml:"contexts"`
}

// GetKubeContexts reads the configured kubeconfig and returns all context names
func (a *App) GetKubeContexts() ([]string, error) {
	configPath := a.getKubeConfigPath()
	configPath = filepath.Clean(configPath)
	// #nosec G304 -- path is derived from user home or explicitly set config.
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}
	var cfg kubeConfigFile
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	names := make([]string, 0, len(cfg.Contexts))
	for _, ctx := range cfg.Contexts {
		names = append(names, ctx.Name)
	}
	sort.Strings(names)
	return names, nil
}

// getContextsFromFile extracts context names from a kubeconfig file
func (a *App) getContextsFromFile(path string) ([]string, error) {
	path = filepath.Clean(path)
	// #nosec G304 -- path comes from user selection.
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg kubeConfigFile
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	names := make([]string, 0, len(cfg.Contexts))
	for _, ctx := range cfg.Contexts {
		names = append(names, ctx.Name)
	}
	return names, nil
}

// GetKubeContextsFromFile gets contexts from a specific kubeconfig file
func (a *App) GetKubeContextsFromFile(path string) ([]string, error) {
	return a.getContextsFromFile(path)
}

// SelectKubeConfigFile opens a file dialog to select a kubeconfig file
func (a *App) SelectKubeConfigFile() (string, error) {
	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Kubeconfig File",
		Filters: []runtime.FileFilter{
			{DisplayName: "Kubeconfig Files", Pattern: "*config*;*.yaml;*.yml"},
			{DisplayName: "All Files", Pattern: "*"},
		},
	})
	if err != nil {
		return "", err
	}
	return selection, nil
}

// SaveCustomKubeConfig saves a kubeconfig content to a file in the .kube directory
func (a *App) SaveCustomKubeConfig(name string, content string) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	kubeDir := filepath.Join(home, ".kube")
	if err := os.MkdirAll(kubeDir, 0o750); err != nil {
		return err
	}
	// Validate the YAML content first
	var cfg kubeConfigFile
	if err := yaml.Unmarshal([]byte(content), &cfg); err != nil {
		return err
	}
	// Ensure the filename is safe
	safeName := strings.ReplaceAll(name, " ", "_")
	safeName = strings.ReplaceAll(safeName, "/", "_")
	safeName = strings.ReplaceAll(safeName, "\\", "_")
	if !strings.HasPrefix(safeName, "config-") {
		safeName = "config-" + safeName
	}
	filePath := filepath.Join(kubeDir, safeName)
	return os.WriteFile(filePath, []byte(content), 0600)
}

// SavePrimaryKubeConfig saves (or creates) the primary kubeconfig at ~/.kube/kubeconfig.
// It validates the YAML before writing. Returns the full path written.
func (a *App) SavePrimaryKubeConfig(content string) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	kubeDir := filepath.Join(home, ".kube")
	if err := os.MkdirAll(kubeDir, 0o750); err != nil {
		return "", err
	}
	// Validate YAML
	var cfg kubeConfigFile
	if err := yaml.Unmarshal([]byte(content), &cfg); err != nil {
		return "", err
	}
	primaryPath := filepath.Join(kubeDir, "kubeconfig")
	if err := os.WriteFile(primaryPath, []byte(content), 0600); err != nil {
		return "", err
	}
	return primaryPath, nil
}

// kubeconfigCollector helps discover and dedupe kubeconfig files
type kubeconfigCollector struct {
	app     *App
	configs []KubeConfigInfo
	seen    map[string]bool
}

// add adds a kubeconfig file if it exists and is valid
func (c *kubeconfigCollector) add(path, name string) {
	if path == "" || c.seen[path] {
		return
	}
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return
	}
	contexts, err := c.app.getContextsFromFile(path)
	if err != nil || len(contexts) == 0 {
		return
	}
	c.configs = append(c.configs, KubeConfigInfo{Path: path, Name: name, Contexts: contexts})
	c.seen[path] = true
}

// scanKubeDir scans the .kube directory for additional kubeconfig files
func (c *kubeconfigCollector) scanKubeDir(kubeDir string) {
	entries, err := os.ReadDir(kubeDir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if name == "config" || name == "kubeconfig" { // already handled
			continue
		}
		if strings.Contains(name, "config") || strings.Contains(name, "kube") {
			c.add(filepath.Join(kubeDir, name), name)
		}
	}
}

// GetKubeConfigs discovers kubeconfig files in the user's home directory and .kube folder
func (a *App) GetKubeConfigs() ([]KubeConfigInfo, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	kubeDir := filepath.Join(home, ".kube")

	collector := &kubeconfigCollector{app: a, seen: make(map[string]bool)}

	// Always include the currently configured kubeconfig, even if it lives outside ~/.kube
	currentPath := a.getKubeConfigPath()
	if currentPath != "" {
		label := filepath.Base(currentPath)
		if label == "" {
			label = "current kubeconfig"
		}
		collector.add(currentPath, label)
	}

	// Check for primary kubeconfig: ~/.kube/kubeconfig
	collector.add(filepath.Join(kubeDir, "kubeconfig"), "kubeconfig (primary)")

	// Default config: ~/.kube/config
	collector.add(filepath.Join(kubeDir, "config"), "config (default)")

	// Scan for other kubeconfig files
	collector.scanKubeDir(kubeDir)

	if len(collector.configs) == 0 {
		return []KubeConfigInfo{}, nil
	}
	return collector.configs, nil
}
