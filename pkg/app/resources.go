package app

import (
	"fmt"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
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

// CreateResource creates a resource in the cluster from YAML
func (a *App) CreateResource(namespace string, yamlContent string) error {
	yamlContent = normalizeYAMLForParsing(yamlContent)

	// Parse YAML into map
	var obj map[string]interface{}
	if err := yaml.Unmarshal([]byte(yamlContent), &obj); err != nil {
		return fmt.Errorf("YAML parse error: %w", err)
	}
	// Convert to unstructured
	u := &unstructured.Unstructured{Object: obj}
	// Extract apiVersion and kind
	apiVersion, ok := obj["apiVersion"].(string)
	if !ok {
		return fmt.Errorf("apiVersion not found in resource")
	}
	kind, ok := obj["kind"].(string)
	if !ok {
		return fmt.Errorf("kind not found in resource")
	}
	if a.currentKubeContext == "" {
		return fmt.Errorf("Kein Kontext gewählt")
	}

	// Centralized REST config (handles insecure fallback)
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

	resNamespace := namespace
	if meta, ok := obj["metadata"].(map[string]interface{}); ok {
		if ns, ok := meta["namespace"].(string); ok && ns != "" {
			resNamespace = ns
		}
	}

	var ri dynamic.ResourceInterface
	if mapping.Scope.Name() == "namespace" {
		if resNamespace == "" {
			return fmt.Errorf("namespace must be specified for namespaced resource")
		}
		ri = dynClient.Resource(mapping.Resource).Namespace(resNamespace)
	} else {
		ri = dynClient.Resource(mapping.Resource)
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

// emitResourceUpdateEvents emits events for resource updates after a brief delay
func (a *App) emitResourceUpdateEvents(namespace, kind string) {
	// Give the API server a brief moment to persist the object so our
	// snapshot events include the newly created resource.
	time.Sleep(500 * time.Millisecond)
	
	if a.ctx == nil || namespace == "" {
		return
	}

	// Always emit pods snapshot for now (existing behavior)
	if pods, err := a.GetRunningPods(namespace); err == nil {
		emitEvent(a.ctx, "pods:update", pods)
	}

	// Emit resource-specific snapshot based on kind
	a.emitResourceSpecificEvent(namespace, kind)
}

// emitResourceSpecificEvent emits an event for a specific resource type
func (a *App) emitResourceSpecificEvent(namespace, kind string) {
	switch strings.ToLower(kind) {
	case "deployment":
		if deps, err := a.GetDeployments(namespace); err == nil {
			emitEvent(a.ctx, "deployments:update", deps)
		}
	case "statefulset":
		if sts, err := a.GetStatefulSets(namespace); err == nil {
			emitEvent(a.ctx, "statefulsets:update", sts)
		}
	case "daemonset":
		if dss, err := a.GetDaemonSets(namespace); err == nil {
			emitEvent(a.ctx, "daemonsets:update", dss)
		}
	case "replicaset":
		if rss, err := a.GetReplicaSets(namespace); err == nil {
			emitEvent(a.ctx, "replicasets:update", rss)
		}
	case "job":
		if jobs, err := a.GetJobs(namespace); err == nil {
			emitEvent(a.ctx, "jobs:update", jobs)
		}
	case "cronjob":
		if cjs, err := a.GetCronJobs(namespace); err == nil {
			emitEvent(a.ctx, "cronjobs:update", cjs)
		}
	case "ingress":
		if ings, err := a.GetIngresses(namespace); err == nil {
			emitEvent(a.ctx, "ingresses:update", ings)
		}
	case "secret":
		if secs, err := a.GetSecrets(namespace); err == nil {
			emitEvent(a.ctx, "secrets:update", secs)
		}
	case "configmap":
		if cms, err := a.GetConfigMaps(namespace); err == nil {
			emitEvent(a.ctx, "configmaps:update", cms)
		}
	}
}
