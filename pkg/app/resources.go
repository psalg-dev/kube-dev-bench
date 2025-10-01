package app

import (
	"fmt"
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
	"k8s.io/client-go/restmapper"
	"k8s.io/client-go/tools/clientcmd"
)

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
		if strings.Contains(err.Error(), "already exists") {
			return fmt.Errorf("Resource already exists: %w", err)
		}
		return err
	}
	// Emit updated lists shortly after creating a resource
	go func(ns string, k string) {
		time.Sleep(100 * time.Millisecond)
		if a.ctx != nil && ns != "" {
			// Always emit pods snapshot for now (existing behavior)
			if pods, err := a.GetRunningPods(ns); err == nil {
				runtime.EventsEmit(a.ctx, "pods:update", pods)
			}
			// If we created a Deployment, also emit deployments snapshot
			if strings.EqualFold(k, "Deployment") {
				if deps, err := a.GetDeployments(ns); err == nil {
					runtime.EventsEmit(a.ctx, "deployments:update", deps)
				}
			}
		}
	}(resNamespace, kind)
	return nil
}
