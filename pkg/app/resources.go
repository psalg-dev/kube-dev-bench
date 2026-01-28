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

func parseResourceYAML(yamlContent string) (map[string]interface{}, *unstructured.Unstructured, string, string, error) {
	var obj map[string]interface{}
	if err := yaml.Unmarshal([]byte(yamlContent), &obj); err != nil {
		return nil, nil, "", "", fmt.Errorf("YAML parse error: %w", err)
	}
	u := &unstructured.Unstructured{Object: obj}
	apiVersion, ok := obj["apiVersion"].(string)
	if !ok {
		return nil, nil, "", "", fmt.Errorf("apiVersion not found in resource")
	}
	kind, ok := obj["kind"].(string)
	if !ok {
		return nil, nil, "", "", fmt.Errorf("kind not found in resource")
	}

	return obj, u, apiVersion, kind, nil
}

func resolveResourceNamespace(obj map[string]interface{}, fallback string) string {
	if meta, ok := obj["metadata"].(map[string]interface{}); ok {
		if ns, ok := meta["namespace"].(string); ok && ns != "" {
			return ns
		}
	}
	return fallback
}

var createResourceEmitters = map[string]func(*App, string){
	"deployment": func(a *App, ns string) {
		if deps, err := a.GetDeployments(ns); err == nil {
			emitEvent(a.ctx, "deployments:update", deps)
		}
	},
	"statefulset": func(a *App, ns string) {
		if sts, err := a.GetStatefulSets(ns); err == nil {
			emitEvent(a.ctx, "statefulsets:update", sts)
		}
	},
	"daemonset": func(a *App, ns string) {
		if dss, err := a.GetDaemonSets(ns); err == nil {
			emitEvent(a.ctx, "daemonsets:update", dss)
		}
	},
	"replicaset": func(a *App, ns string) {
		if rss, err := a.GetReplicaSets(ns); err == nil {
			emitEvent(a.ctx, "replicasets:update", rss)
		}
	},
	"job": func(a *App, ns string) {
		if jobs, err := a.GetJobs(ns); err == nil {
			emitEvent(a.ctx, "jobs:update", jobs)
		}
	},
	"cronjob": func(a *App, ns string) {
		if cjs, err := a.GetCronJobs(ns); err == nil {
			emitEvent(a.ctx, "cronjobs:update", cjs)
		}
	},
	"ingress": func(a *App, ns string) {
		if ings, err := a.GetIngresses(ns); err == nil {
			emitEvent(a.ctx, "ingresses:update", ings)
		}
	},
	"secret": func(a *App, ns string) {
		if secs, err := a.GetSecrets(ns); err == nil {
			emitEvent(a.ctx, "secrets:update", secs)
		}
	},
	"configmap": func(a *App, ns string) {
		if cms, err := a.GetConfigMaps(ns); err == nil {
			emitEvent(a.ctx, "configmaps:update", cms)
		}
	},
}

func (a *App) emitCreateResourceSnapshots(kind, namespace string) {
	if a.ctx == nil || namespace == "" {
		return
	}
	if pods, err := a.GetRunningPods(namespace); err == nil {
		emitEvent(a.ctx, "pods:update", pods)
	}
	kindKey := strings.ToLower(kind)
	if emit, ok := createResourceEmitters[kindKey]; ok {
		emit(a, namespace)
	}
}

// CreateResource creates a resource in the cluster from YAML
func (a *App) CreateResource(namespace string, yamlContent string) error {
	yamlContent = normalizeYAMLForParsing(yamlContent)

	obj, u, apiVersion, kind, err := parseResourceYAML(yamlContent)
	if err != nil {
		return err
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

	resNamespace := resolveResourceNamespace(obj, namespace)

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
	go func(ns string, k string) {
		// Give the API server a brief moment to persist the object so our
		// snapshot events include the newly created resource.
		time.Sleep(500 * time.Millisecond)
		a.emitCreateResourceSnapshots(k, ns)
	}(resNamespace, kind)
	return nil
}
