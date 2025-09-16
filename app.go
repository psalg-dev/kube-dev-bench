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
	return nil
}

// saveConfig persists the current configuration to disk
func (a *App) saveConfig() error {
	config := AppConfig{
		CurrentContext:    a.currentKubeContext,
		CurrentNamespace:  a.currentNamespace,
		RememberContext:   a.rememberContext,
		RememberNamespace: a.rememberNamespace,
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

// GetKubeContexts liest ~/.kube/config und gibt die Namen aller Kontexte zurück
func (a *App) GetKubeContexts() ([]string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	configPath := filepath.Join(home, ".kube", "config")
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
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	configPath := filepath.Join(home, ".kube", "config")
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
	Name   string `json:"name"`
	Uptime string `json:"uptime"`
}

// GetOverview gibt die Anzahl von Pods, Deployments und Jobs im Namespace zurück
func (a *App) GetOverview(namespace string) (OverviewInfo, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return OverviewInfo{}, err
	}
	configPath := filepath.Join(home, ".kube", "config")
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

// GetRunningPods gibt alle laufenden Pods (Name, Uptime) im Namespace zurück
func (a *App) GetRunningPods(namespace string) ([]PodInfo, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	configPath := filepath.Join(home, ".kube", "config")
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
			if pod.Status.StartTime != nil {
				dur := now.Sub(pod.Status.StartTime.Time)
				uptime = dur.Truncate(time.Second).String()
			}
			result = append(result, PodInfo{
				Name:   pod.Name,
				Uptime: uptime,
			})
		}
	}
	return result, nil
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
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	configPath := filepath.Join(home, ".kube", "config")
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
	return nil
}
