package main

import (
	"context"
	"fmt"
	"gopkg.in/yaml.v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"os"
	"path/filepath"
)

// App struct
type App struct {
	ctx                context.Context
	kubeConfig         string // nicht mehr benötigt, aber für Kompatibilität belassen
	currentKubeContext string // aktuell gewählter Kontextname
	currentNamespace   string // aktuell gewählter Namespace
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// SetKubeConfig speichert den übergebenen Kubernetes-Kontext
func (a *App) SetKubeConfig(config string) {
	a.kubeConfig = config
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
	return names, nil
}

// SetCurrentKubeContext speichert den gewählten Kontextnamen
func (a *App) SetCurrentKubeContext(name string) {
	a.currentKubeContext = name
}

// SetCurrentNamespace speichert den gewählten Namespace
func (a *App) SetCurrentNamespace(ns string) {
	a.currentNamespace = ns
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
	return namespaces, nil
}
