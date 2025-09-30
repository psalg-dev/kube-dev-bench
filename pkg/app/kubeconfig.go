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
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}
	var cfg kubeConfigFile
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	var names []string
	for _, ctx := range cfg.Contexts {
		names = append(names, ctx.Name)
	}
	sort.Strings(names)
	return names, nil
}

// getContextsFromFile extracts context names from a kubeconfig file
func (a *App) getContextsFromFile(path string) ([]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg kubeConfigFile
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	var names []string
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
	if err := os.MkdirAll(kubeDir, 0755); err != nil {
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

// GetKubeConfigs discovers kubeconfig files in the user's home directory and .kube folder
func (a *App) GetKubeConfigs() ([]KubeConfigInfo, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	var configs []KubeConfigInfo
	kubeDir := filepath.Join(home, ".kube")
	// Check for default config
	defaultConfig := filepath.Join(kubeDir, "config")
	if info, err := os.Stat(defaultConfig); err == nil && !info.IsDir() {
		if contexts, err := a.getContextsFromFile(defaultConfig); err == nil && len(contexts) > 0 {
			configs = append(configs, KubeConfigInfo{Path: defaultConfig, Name: "config (default)", Contexts: contexts})
		}
	}
	// Look for other kubeconfig files in .kube directory
	if entries, err := os.ReadDir(kubeDir); err == nil {
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			name := entry.Name()
			if name == "config" {
				continue
			}
			if strings.Contains(name, "config") || strings.Contains(name, "kube") {
				fullPath := filepath.Join(kubeDir, name)
				if contexts, err := a.getContextsFromFile(fullPath); err == nil && len(contexts) > 0 {
					configs = append(configs, KubeConfigInfo{Path: fullPath, Name: name, Contexts: contexts})
				}
			}
		}
	}
	return configs, nil
}
