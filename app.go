package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"gopkg.in/yaml.v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/restmapper"
	"k8s.io/client-go/tools/clientcmd"
)

// AppConfig represents the persistent configuration
type AppConfig struct {
	CurrentContext    string `json:"currentContext"`
	CurrentNamespace  string `json:"currentNamespace"`
	RememberContext   bool   `json:"rememberContext"`
	RememberNamespace bool   `json:"rememberNamespace"`
	KubeConfigPath    string `json:"kubeConfigPath"`
}

// App struct
type App struct {
	ctx                context.Context
	kubeConfig         string // nicht mehr benötigt, aber für Kompatibilität belassen
	currentKubeContext string // aktuell gewählter Kontextname
	currentNamespace   string // aktuell gewählter Namespace
	configPath         string
	rememberContext    bool
	rememberNamespace  bool
}

// NewApp creates a new App application struct
func NewApp() *App {
	home, err := os.UserHomeDir()
	if err != nil {
		fmt.Printf("Error getting user home directory: %v\n", err)
		return &App{}
	}

	// Ensure gowails directory exists
	configDir := filepath.Join(home, "gowails")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		fmt.Printf("Error creating config directory: %v\n", err)
		return &App{}
	}

	return &App{
		configPath: filepath.Join(configDir, "config.json"),
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if err := a.loadConfig(); err != nil {
		fmt.Printf("Error loading config: %v\n", err)
	}
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
	a.rememberContext = config.RememberContext
	a.rememberNamespace = config.RememberNamespace
	a.kubeConfig = config.KubeConfigPath
	return nil
}

// saveConfig persists the current configuration to disk
func (a *App) saveConfig() error {
	config := AppConfig{
		CurrentContext:    a.currentKubeContext,
		CurrentNamespace:  a.currentNamespace,
		RememberContext:   a.rememberContext,
		RememberNamespace: a.rememberNamespace,
		KubeConfigPath:    a.kubeConfig,
	}
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(a.configPath, data, 0644)
}

// GetCurrentConfig returns the currently loaded configuration
func (a *App) GetCurrentConfig() AppConfig {
	return AppConfig{
		CurrentContext:   a.currentKubeContext,
		CurrentNamespace: a.currentNamespace,
	}
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// kubeConfigFile repräsentiert die kubeconfig YAML-Struktur (nur relevante Teile)
type kubeConfigFile struct {
	Contexts []struct {
		Name    string                 `yaml:"name"`
		Context map[string]interface{} `yaml:"context"`
	} `yaml:"contexts"`
}

// GetKubeContexts liest die konfigurierte kubeconfig und gibt die Namen aller Kontexte zurück
func (a *App) GetKubeContexts() ([]string, error) {
	configPath := a.getKubeConfigPath()
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}
	var cfg kubeConfigFile
	err = yaml.Unmarshal(data, &cfg)
	if err != nil {
		return nil, err
	}
	var names []string
	for _, ctx := range cfg.Contexts {
		names = append(names, ctx.Name)
	}
	sort.Strings(names)
	return names, nil
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

// SetCurrentKubeContext speichert den gewählten Kontextnamen
func (a *App) SetCurrentKubeContext(name string) error {
	a.currentKubeContext = name
	if a.rememberContext {
		return a.saveConfig()
	}
	return nil
}

// SetCurrentNamespace speichert den gewählten Namespace
func (a *App) SetCurrentNamespace(ns string) error {
	a.currentNamespace = ns
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
func (a *App) GetRememberContext() bool {
	return a.rememberContext
}

// SetRememberNamespace sets the rememberNamespace flag and saves config
func (a *App) SetRememberNamespace(val bool) error {
	a.rememberNamespace = val
	return a.saveConfig()
}

// GetRememberNamespace returns the rememberNamespace flag
func (a *App) GetRememberNamespace() bool {
	return a.rememberNamespace
}

// GetNamespaces stellt eine Verbindung zum Cluster her und gibt die Namespace-Namen zurück
func (a *App) GetNamespaces() ([]string, error) {
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return nil, err
	}
	if a.currentKubeContext == "" {
		return nil, fmt.Errorf("Kein Kontext gewählt")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return nil, err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, err
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

// OverviewInfo enthält die Anzahl der Ressourcen
// und wird an das Frontend geliefert
type OverviewInfo struct {
	Pods        int `json:"pods"`
	Deployments int `json:"deployments"`
	Jobs        int `json:"jobs"`
}

type PodInfo struct {
	Name      string `json:"name"`
	Restarts  int32  `json:"restarts"`
	Uptime    string `json:"uptime"`
	StartTime string `json:"startTime"`
}

// GetOverview gibt die Anzahl von Pods, Deployments und Jobs im Namespace zurück
func (a *App) GetOverview(namespace string) (OverviewInfo, error) {
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return OverviewInfo{}, err
	}
	if a.currentKubeContext == "" {
		return OverviewInfo{}, fmt.Errorf("Kein Kontext gewählt")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return OverviewInfo{}, err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return OverviewInfo{}, err
	}
	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return OverviewInfo{}, err
	}
	deployments, err := clientset.AppsV1().Deployments(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return OverviewInfo{}, err
	}
	jobs, err := clientset.BatchV1().Jobs(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return OverviewInfo{}, err
	}
	return OverviewInfo{
		Pods:        len(pods.Items),
		Deployments: len(deployments.Items),
		Jobs:        len(jobs.Items),
	}, nil
}

// GetRunningPods gibt alle laufenden Pods (Name, Restarts, Uptime) im Namespace zurück
func (a *App) GetRunningPods(namespace string) ([]PodInfo, error) {
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return nil, err
	}
	if a.currentKubeContext == "" {
		return nil, fmt.Errorf("Kein Kontext gewählt")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return nil, err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, err
	}
	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	var result []PodInfo
	now := time.Now()
	for _, pod := range pods.Items {
		if pod.Status.Phase == "Running" {
			uptime := "-"
			startTimeStr := ""
			if pod.Status.StartTime != nil {
				dur := now.Sub(pod.Status.StartTime.Time)
				uptime = dur.Truncate(time.Second).String()
				startTimeStr = pod.Status.StartTime.Time.UTC().Format(time.RFC3339)
			}

			// Calculate total restart count across all containers
			restarts := int32(0)
			if pod.Status.ContainerStatuses != nil {
				for _, containerStatus := range pod.Status.ContainerStatuses {
					restarts += containerStatus.RestartCount
				}
			}

			result = append(result, PodInfo{
				Name:      pod.Name,
				Restarts:  restarts,
				Uptime:    uptime,
				StartTime: startTimeStr,
			})
		}
	}
	return result, nil
}

// StartPodPolling emits pods:update events every second with the current pod list
func (a *App) StartPodPolling() {
	go func() {
		for {
			time.Sleep(time.Second)
			if a.ctx == nil || a.currentNamespace == "" {
				continue
			}
			pods, err := a.GetRunningPods(a.currentNamespace)
			if err == nil {
				runtime.EventsEmit(a.ctx, "pods:update", pods)
			}
		}
	}()
}

// CreateResource creates a resource in the cluster from YAML
func (a *App) CreateResource(namespace string, yamlContent string) error {
	// Parse YAML into map
	var obj map[string]interface{}
	if err := yaml.Unmarshal([]byte(yamlContent), &obj); err != nil {
		return fmt.Errorf("YAML parse error: %w", err)
	}

	// Convert to unstructured
	u := &unstructured.Unstructured{Object: obj}

	// Extract apiVersion and kind
	apiVersion, found := obj["apiVersion"].(string)
	if !found {
		return fmt.Errorf("apiVersion not found in resource")
	}
	kind, found := obj["kind"].(string)
	if !found {
		return fmt.Errorf("kind not found in resource")
	}

	// Load kubeconfig and create dynamic client
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return err
	}
	if a.currentKubeContext == "" {
		return fmt.Errorf("Kein Kontext gewählt")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return err
	}
	dynClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return err
	}

	// Discover REST mapping
	dc, err := discovery.NewDiscoveryClientForConfig(restConfig)
	if err != nil {
		return err
	}
	mapper := restmapper.NewDeferredDiscoveryRESTMapper(memory.NewMemCacheClient(dc))
	gv, err := schema.ParseGroupVersion(apiVersion)
	if err != nil {
		return fmt.Errorf("invalid apiVersion: %w", err)
	}
	mapping, err := mapper.RESTMapping(schema.GroupKind{Group: gv.Group, Kind: kind}, gv.Version)
	if err != nil {
		return fmt.Errorf("could not find REST mapping for %s/%s: %w", apiVersion, kind, err)
	}

	// Determine namespace
	resNamespace := namespace
	if meta, ok := obj["metadata"].(map[string]interface{}); ok {
		if ns, ok := meta["namespace"].(string); ok && ns != "" {
			resNamespace = ns
		}
	}

	// Create resource
	var ri dynamic.ResourceInterface
	if mapping.Scope.Name() == "namespace" {
		if resNamespace == "" {
			return fmt.Errorf("namespace must be specified for namespaced resource")
		}
		ri = dynClient.Resource(mapping.Resource).Namespace(resNamespace)
	} else {
		ri = dynClient.Resource(mapping.Resource)
	}
	_, err = ri.Create(a.ctx, u, metav1.CreateOptions{})
	if err != nil {
		// If already exists, return a more friendly error
		if strings.Contains(err.Error(), "already exists") {
			return fmt.Errorf("Resource already exists: %w", err)
		}
		return err
	}

	// Immediately emit updated pod list after creating a resource
	// This ensures the UI updates instantly when a new pod is created
	go func() {
		time.Sleep(100 * time.Millisecond) // Small delay to allow pod to be created
		if a.ctx != nil && namespace != "" {
			pods, err := a.GetRunningPods(namespace)
			if err == nil {
				runtime.EventsEmit(a.ctx, "pods:update", pods)
			}
		}
	}()

	return nil
}

// KubeConfigInfo represents information about a kubeconfig file
type KubeConfigInfo struct {
	Path     string   `json:"path"`
	Name     string   `json:"name"`
	Contexts []string `json:"contexts"`
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
		contexts, err := a.getContextsFromFile(defaultConfig)
		if err == nil && len(contexts) > 0 {
			configs = append(configs, KubeConfigInfo{
				Path:     defaultConfig,
				Name:     "config (default)",
				Contexts: contexts,
			})
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
				continue // Already handled above
			}
			// Look for files that might be kubeconfigs
			if strings.Contains(name, "config") || strings.Contains(name, "kube") {
				fullPath := filepath.Join(kubeDir, name)
				contexts, err := a.getContextsFromFile(fullPath)
				if err == nil && len(contexts) > 0 {
					configs = append(configs, KubeConfigInfo{
						Path:     fullPath,
						Name:     name,
						Contexts: contexts,
					})
				}
			}
		}
	}

	return configs, nil
}

// getContextsFromFile extracts context names from a kubeconfig file
func (a *App) getContextsFromFile(path string) ([]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg kubeConfigFile
	err = yaml.Unmarshal(data, &cfg)
	if err != nil {
		return nil, err
	}

	var names []string
	for _, ctx := range cfg.Contexts {
		names = append(names, ctx.Name)
	}
	return names, nil
}

// SelectKubeConfigFile opens a file dialog to select a kubeconfig file
func (a *App) SelectKubeConfigFile() (string, error) {
	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Kubeconfig File",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Kubeconfig Files",
				Pattern:     "*config*;*.yaml;*.yml",
			},
			{
				DisplayName: "All Files",
				Pattern:     "*",
			},
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
		return fmt.Errorf("invalid kubeconfig YAML: %w", err)
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

// SetKubeConfigPath sets the kubeconfig file path to use
func (a *App) SetKubeConfigPath(path string) error {
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
	return a.saveConfig()
}

// GetKubeContextsFromFile gets contexts from a specific kubeconfig file
func (a *App) GetKubeContextsFromFile(path string) ([]string, error) {
	return a.getContextsFromFile(path)
}
