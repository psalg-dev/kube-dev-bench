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
	go func(ns string, k string) {
		// Give the API server a brief moment to persist the object so our
		// snapshot events include the newly created resource.
		time.Sleep(500 * time.Millisecond)
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
			// If we created a StatefulSet, emit statefulsets snapshot
			if strings.EqualFold(k, "StatefulSet") {
				if sts, err := a.GetStatefulSets(ns); err == nil {
					runtime.EventsEmit(a.ctx, "statefulsets:update", sts)
				}
			}
			// If we created a DaemonSet, emit daemonsets snapshot
			if strings.EqualFold(k, "DaemonSet") {
				if dss, err := a.GetDaemonSets(ns); err == nil {
					runtime.EventsEmit(a.ctx, "daemonsets:update", dss)
				}
			}
			// If we created a ReplicaSet, emit replicasets snapshot
			if strings.EqualFold(k, "ReplicaSet") {
				if rss, err := a.GetReplicaSets(ns); err == nil {
					runtime.EventsEmit(a.ctx, "replicasets:update", rss)
				}
			}
			// If we created a Job, emit jobs snapshot
			if strings.EqualFold(k, "Job") {
				if jobs, err := a.GetJobs(ns); err == nil {
					runtime.EventsEmit(a.ctx, "jobs:update", jobs)
				}
			}
			// If we created a CronJob, emit cronjobs snapshot
			if strings.EqualFold(k, "CronJob") {
				if cjs, err := a.GetCronJobs(ns); err == nil {
					runtime.EventsEmit(a.ctx, "cronjobs:update", cjs)
				}
			}
			// If we created an Ingress, emit ingresses snapshot
			if strings.EqualFold(k, "Ingress") {
				if ings, err := a.GetIngresses(ns); err == nil {
					runtime.EventsEmit(a.ctx, "ingresses:update", ings)
				}
			}
			// If we created a Secret, emit secrets snapshot
			if strings.EqualFold(k, "Secret") {
				if secs, err := a.GetSecrets(ns); err == nil {
					runtime.EventsEmit(a.ctx, "secrets:update", secs)
				}
			}
			// If we created a ConfigMap, emit configmaps snapshot
			if strings.EqualFold(k, "ConfigMap") {
				if cms, err := a.GetConfigMaps(ns); err == nil {
					runtime.EventsEmit(a.ctx, "configmaps:update", cms)
				}
			}
		}
	}(resNamespace, kind)
	return nil
}
