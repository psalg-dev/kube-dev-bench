package app

import (
	"fmt"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/restmapper"
)

func normalizeYAMLForParsing(input string) string {
	// Normalize line endings and remove common invisible characters that can break YAML parsing.
	s := strings.ReplaceAll(input, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")

	// Trim UTF-8 BOM (U+FEFF) at start, and remove any stray occurrences.
	s = strings.TrimPrefix(s, "\uFEFF")
	s = strings.ReplaceAll(s, "\uFEFF", "")

	// Remove zero-width spaces that can be introduced by copy/paste.
	s = strings.ReplaceAll(s, "\u200B", "")

	// Replace leading indentation that uses tabs or NBSP with spaces (YAML forbids tabs for indentation).
	// We only normalize indentation prefix, so we don't alter literal values inside the document.
	lines := strings.Split(s, "\n")
	for i, line := range lines {
		if line == "" {
			continue
		}
		// Convert leading \t or NBSP (U+00A0) into 2 spaces per character.
		j := 0
		for j < len(line) {
			c := line[j]
			if c == '\t' {
				j++
				continue
			}
			// NBSP in UTF-8 is 0xC2 0xA0
			if c == 0xC2 && j+1 < len(line) && line[j+1] == 0xA0 {
				j += 2
				continue
			}
			break
		}
		if j == 0 {
			continue
		}
		prefix := line[:j]
		rest := line[j:]
		// Replace each tab with 2 spaces. Replace each NBSP byte-pair with 2 spaces.
		prefix = strings.ReplaceAll(prefix, "\t", "  ")
		prefix = strings.ReplaceAll(prefix, string([]byte{0xC2, 0xA0}), "  ")
		lines[i] = prefix + rest
	}
	s = strings.Join(lines, "\n")

	return s
}

// parseResourceYAML parses YAML content into an unstructured object and extracts apiVersion/kind
func parseResourceYAML(yamlContent string) (*unstructured.Unstructured, string, string, error) {
	var obj map[string]interface{}
	if err := yaml.Unmarshal([]byte(yamlContent), &obj); err != nil {
		return nil, "", "", fmt.Errorf("YAML parse error: %w", err)
	}

	apiVersion, ok := obj["apiVersion"].(string)
	if !ok {
		return nil, "", "", fmt.Errorf("apiVersion not found in resource")
	}

	kind, ok := obj["kind"].(string)
	if !ok {
		return nil, "", "", fmt.Errorf("kind not found in resource")
	}

	return &unstructured.Unstructured{Object: obj}, apiVersion, kind, nil
}

// extractResourceNamespace determines the namespace from the resource metadata or uses the default
func extractResourceNamespace(obj map[string]interface{}, defaultNS string) string {
	if meta, ok := obj["metadata"].(map[string]interface{}); ok {
		if ns, ok := meta["namespace"].(string); ok && ns != "" {
			return ns
		}
	}
	return defaultNS
}

// getResourceInterface returns the appropriate dynamic resource interface based on scope
func getResourceInterface(dynClient dynamic.Interface, mapping *meta.RESTMapping, namespace string) (dynamic.ResourceInterface, error) {
	if mapping.Scope.Name() == "namespace" {
		if namespace == "" {
			return nil, fmt.Errorf("namespace must be specified for namespaced resource")
		}
		return dynClient.Resource(mapping.Resource).Namespace(namespace), nil
	}
	return dynClient.Resource(mapping.Resource), nil
}

// CreateResource creates a resource in the cluster from YAML
func (a *App) CreateResource(namespace string, yamlContent string) error {
	yamlContent = normalizeYAMLForParsing(yamlContent)

	u, apiVersion, kind, err := parseResourceYAML(yamlContent)
	if err != nil {
		return err
	}

	if a.currentKubeContext == "" {
		return fmt.Errorf("Kein Kontext gewählt")
	}

	restCfg, err := a.getRESTConfig()
	if err != nil {
		return err
	}

	dynClient, err := dynamic.NewForConfig(restCfg)
	if err != nil {
		return err
	}

	dc, err := discovery.NewDiscoveryClientForConfig(restCfg)
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

	resNamespace := extractResourceNamespace(u.Object, namespace)

	ri, err := getResourceInterface(dynClient, mapping, resNamespace)
	if err != nil {
		return err
	}

	if _, err = ri.Create(a.ctx, u, metav1.CreateOptions{}); err != nil {
		if strings.Contains(err.Error(), "already exists") {
			return fmt.Errorf("Resource already exists: %w", err)
		}
		return err
	}

	// Emit updated lists shortly after creating a resource
	go a.emitResourceUpdateEvents(resNamespace, kind)
	return nil
}

// emitResourceUpdateEvents emits update events for the created resource type
func (a *App) emitResourceUpdateEvents(ns, kind string) {
	// Give the API server a brief moment to persist the object so our
	// snapshot events include the newly created resource.
	time.Sleep(500 * time.Millisecond)

	if a.ctx == nil || ns == "" {
		return
	}

	// Always emit pods snapshot for now (existing behavior)
	if pods, err := a.GetRunningPods(ns); err == nil {
		emitEvent(a.ctx, "pods:update", pods)
	}

	// Emit resource-specific event based on kind
	a.emitKindSpecificUpdate(ns, kind)
}

// emitKindSpecificUpdate emits an update event for the specific resource kind
func (a *App) emitKindSpecificUpdate(ns, kind string) {
	kindLower := strings.ToLower(kind)

	type resourceFetcher struct {
		eventName string
		fetch     func() (interface{}, error)
	}

	fetchers := map[string]resourceFetcher{
		"deployment":  {"deployments:update", func() (interface{}, error) { return a.GetDeployments(ns) }},
		"statefulset": {"statefulsets:update", func() (interface{}, error) { return a.GetStatefulSets(ns) }},
		"daemonset":   {"daemonsets:update", func() (interface{}, error) { return a.GetDaemonSets(ns) }},
		"replicaset":  {"replicasets:update", func() (interface{}, error) { return a.GetReplicaSets(ns) }},
		"job":         {"jobs:update", func() (interface{}, error) { return a.GetJobs(ns) }},
		"cronjob":     {"cronjobs:update", func() (interface{}, error) { return a.GetCronJobs(ns) }},
		"ingress":     {"ingresses:update", func() (interface{}, error) { return a.GetIngresses(ns) }},
		"secret":      {"secrets:update", func() (interface{}, error) { return a.GetSecrets(ns) }},
		"configmap":   {"configmaps:update", func() (interface{}, error) { return a.GetConfigMaps(ns) }},
	}

	if fetcher, ok := fetchers[kindLower]; ok {
		if data, err := fetcher.fetch(); err == nil {
			emitEvent(a.ctx, fetcher.eventName, data)
		}
	}
}
