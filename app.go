package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"gopkg.in/yaml.v3"
	v1 "k8s.io/api/core/v1"
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

	logMu      sync.Mutex
	logCancels map[string]context.CancelFunc
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
		logCancels: make(map[string]context.CancelFunc),
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

// StopPodLogs stops an active log stream for the given pod if running
func (a *App) StopPodLogs(podName string) {
	a.logMu.Lock()
	cancel, ok := a.logCancels[podName]
	if ok {
		delete(a.logCancels, podName)
	}
	a.logMu.Unlock()
	if ok && cancel != nil {
		cancel()
		runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[stream stop requested]")
	}
}

// StreamPodLogs streams logs for a pod and emits each line as a Wails event
func (a *App) StreamPodLogs(podName string) {
	// stop any previous stream for this pod
	a.StopPodLogs(podName)

	go func() {
		// derive cancellable context for this stream
		streamCtx, cancel := context.WithCancel(a.ctx)
		a.logMu.Lock()
		a.logCancels[podName] = cancel
		a.logMu.Unlock()
		defer func() {
			// cleanup registration
			a.logMu.Lock()
			delete(a.logCancels, podName)
			a.logMu.Unlock()
			cancel()
		}()

		configPath := a.getKubeConfigPath()
		config, err := clientcmd.LoadFromFile(configPath)
		if err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] loading kubeconfig: "+err.Error())
			return
		}
		if a.currentKubeContext == "" {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] no kube context selected")
			return
		}
		clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
		restConfig, err := clientConfig.ClientConfig()
		if err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] client config: "+err.Error())
			return
		}
		clientset, err := kubernetes.NewForConfig(restConfig)
		if err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] clientset: "+err.Error())
			return
		}
		if a.currentNamespace == "" {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] no namespace selected")
			return
		}
		opts := &v1.PodLogOptions{Follow: true}
		stream, err := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts).Stream(streamCtx)
		if err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] log stream: "+err.Error())
			return
		}
		defer stream.Close()
		scanner := bufio.NewScanner(stream)
		for scanner.Scan() {
			select {
			case <-streamCtx.Done():
				return
			default:
			}
			line := scanner.Text()
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, line)
		}
		if err := scanner.Err(); err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] scan error: "+err.Error())
		}
		runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[stream closed]")
	}()
}

// StreamPodContainerLogs streams logs for a pod container and emits each line as a Wails event
func (a *App) StreamPodContainerLogs(podName string, container string) {
	// stop any previous stream for this pod
	a.StopPodLogs(podName)

	go func() {
		streamCtx, cancel := context.WithCancel(a.ctx)
		a.logMu.Lock()
		a.logCancels[podName] = cancel
		a.logMu.Unlock()
		defer func() {
			a.logMu.Lock()
			delete(a.logCancels, podName)
			a.logMu.Unlock()
			cancel()
		}()

		configPath := a.getKubeConfigPath()
		config, err := clientcmd.LoadFromFile(configPath)
		if err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] loading kubeconfig: "+err.Error())
			return
		}
		if a.currentKubeContext == "" {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] no kube context selected")
			return
		}
		clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
		restConfig, err := clientConfig.ClientConfig()
		if err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] client config: "+err.Error())
			return
		}
		clientset, err := kubernetes.NewForConfig(restConfig)
		if err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] clientset: "+err.Error())
			return
		}
		if a.currentNamespace == "" {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] no namespace selected")
			return
		}
		opts := &v1.PodLogOptions{Follow: true, Container: container}
		stream, err := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts).Stream(streamCtx)
		if err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] log stream: "+err.Error())
			return
		}
		defer stream.Close()
		scanner := bufio.NewScanner(stream)
		for scanner.Scan() {
			select {
			case <-streamCtx.Done():
				return
			default:
			}
			line := scanner.Text()
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, line)
		}
		if err := scanner.Err(); err != nil {
			runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[error] scan error: "+err.Error())
		}
		runtime.EventsEmit(a.ctx, "podlogs:"+podName, "[stream closed]")
	}()
}

// GetPodLog returns the full log content of a pod (no follow)
func (a *App) GetPodLog(podName string) (string, error) {
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return "", err
	}
	if a.currentKubeContext == "" {
		return "", fmt.Errorf("no kube context selected")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return "", err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return "", err
	}
	if a.currentNamespace == "" {
		return "", fmt.Errorf("no namespace selected")
	}
	opts := &v1.PodLogOptions{Follow: false}
	req := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts)
	data, err := req.Do(a.ctx).Raw()
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// GetPodContainerLog returns the full log content of a specific container (no follow)
func (a *App) GetPodContainerLog(podName string, container string) (string, error) {
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return "", err
	}
	if a.currentKubeContext == "" {
		return "", fmt.Errorf("no kube context selected")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return "", err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return "", err
	}
	if a.currentNamespace == "" {
		return "", fmt.Errorf("no namespace selected")
	}
	opts := &v1.PodLogOptions{Follow: false, Container: container}
	req := clientset.CoreV1().Pods(a.currentNamespace).GetLogs(podName, opts)
	data, err := req.Do(a.ctx).Raw()
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// EventInfo is a simplified event record for UI display
type EventInfo struct {
	Type           string    `json:"type"`
	Reason         string    `json:"reason"`
	Message        string    `json:"message"`
	Count          int32     `json:"count"`
	FirstTimestamp time.Time `json:"firstTimestamp"`
	LastTimestamp  time.Time `json:"lastTimestamp"`
	Source         string    `json:"source"`
}

// GetPodEvents returns events related to the given pod (from all available time in cluster retention)
func (a *App) GetPodEvents(namespace string, podName string) ([]EventInfo, error) {
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return nil, err
	}
	if a.currentKubeContext == "" {
		return nil, fmt.Errorf("no kube context selected")
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
	if namespace == "" {
		if a.currentNamespace == "" {
			return nil, fmt.Errorf("no namespace selected")
		}
		namespace = a.currentNamespace
	}

	var res []EventInfo

	// Core/v1 Events
	if list, err := clientset.CoreV1().Events(namespace).List(a.ctx, metav1.ListOptions{}); err == nil {
		for _, e := range list.Items {
			if e.InvolvedObject.Name != podName {
				continue
			}
			first := e.FirstTimestamp.Time
			last := e.LastTimestamp.Time
			if last.IsZero() && !e.EventTime.Time.IsZero() {
				last = e.EventTime.Time
			}
			if first.IsZero() && !e.EventTime.Time.IsZero() {
				first = e.EventTime.Time
			}
			source := ""
			if e.Source.Component != "" || e.Source.Host != "" {
				source = fmt.Sprintf("%s/%s", e.Source.Component, e.Source.Host)
			}
			res = append(res, EventInfo{
				Type:           e.Type,
				Reason:         e.Reason,
				Message:        e.Message,
				Count:          e.Count,
				FirstTimestamp: first,
				LastTimestamp:  last,
				Source:         source,
			})
		}
	}

	// events.k8s.io/v1 Events
	if list, err := clientset.EventsV1().Events(namespace).List(a.ctx, metav1.ListOptions{}); err == nil {
		for _, e := range list.Items {
			if e.Regarding.Name != podName {
				continue
			}
			first := e.DeprecatedFirstTimestamp.Time
			last := e.EventTime.Time
			if last.IsZero() && !e.DeprecatedLastTimestamp.Time.IsZero() {
				last = e.DeprecatedLastTimestamp.Time
			}
			if first.IsZero() && !e.EventTime.Time.IsZero() {
				first = e.EventTime.Time
			}
			count := int32(0)
			if e.Series != nil {
				count = int32(e.Series.Count)
			} else if e.DeprecatedCount != 0 {
				count = int32(e.DeprecatedCount)
			}
			source := ""
			if e.DeprecatedSource.Component != "" || e.DeprecatedSource.Host != "" {
				source = fmt.Sprintf("%s/%s", e.DeprecatedSource.Component, e.DeprecatedSource.Host)
			}
			msg := e.Note
			res = append(res, EventInfo{
				Type:           e.Type,
				Reason:         e.Reason,
				Message:        msg,
				Count:          count,
				FirstTimestamp: first,
				LastTimestamp:  last,
				Source:         source,
			})
		}
	}

	sort.Slice(res, func(i, j int) bool {
		return res[i].LastTimestamp.After(res[j].LastTimestamp)
	})
	return res, nil
}

// Backwards-compat wrapper (deprecated)
func (a *App) GetPodEventsLegacy(podName string) ([]EventInfo, error) {
	return a.GetPodEvents("", podName)
}

// GetPodYAML returns the live Pod manifest as YAML
func (a *App) GetPodYAML(podName string) (string, error) {
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return "", err
	}
	if a.currentKubeContext == "" {
		return "", fmt.Errorf("no kube context selected")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return "", err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return "", err
	}
	if a.currentNamespace == "" {
		return "", fmt.Errorf("no namespace selected")
	}
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	out, err := yaml.Marshal(pod)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

// GetPodContainers returns the list of container names for the pod (regular containers only)
func (a *App) GetPodContainers(podName string) ([]string, error) {
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return nil, err
	}
	if a.currentKubeContext == "" {
		return nil, fmt.Errorf("no kube context selected")
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
	if a.currentNamespace == "" {
		return nil, fmt.Errorf("no namespace selected")
	}
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(pod.Spec.Containers))
	for _, c := range pod.Spec.Containers {
		names = append(names, c.Name)
	}
	return names, nil
}

// PodSummary returns basic properties for a pod
type PodSummary struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Created   time.Time         `json:"created"`
	Labels    map[string]string `json:"labels"`
	Status    string            `json:"status"`
}

// GetPodSummary fetches a pod and returns a concise summary
func (a *App) GetPodSummary(podName string) (PodSummary, error) {
	var out PodSummary
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return out, err
	}
	if a.currentKubeContext == "" {
		return out, fmt.Errorf("no kube context selected")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return out, err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return out, err
	}
	if a.currentNamespace == "" {
		return out, fmt.Errorf("no namespace selected")
	}
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return out, err
	}
	status := string(pod.Status.Phase)
	out = PodSummary{
		Name:      pod.Name,
		Namespace: pod.Namespace,
		Created:   pod.CreationTimestamp.Time,
		Labels:    pod.Labels,
		Status:    status,
	}
	return out, nil
}
