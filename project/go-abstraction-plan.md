# Go Codebase Abstraction Plan

This document outlines a refactoring plan to reduce code duplication in the Go backend (`pkg/app/`). The analysis identified ~1,435 lines of duplicated code that can be reduced by ~735 lines through targeted abstractions.

## Executive Summary

| Phase | Focus Area | Lines Saved | Files Affected |
|-------|------------|-------------|----------------|
| 1 | Generic Polling | ~290 | 13 files |
| 2 | Client Initialization | ~80 | 7 files |
| 3 | Transform Helpers | ~300 | 12+ files |
| 4 | Delete/Restart Registry | ~70 | 3 files |

---

## Phase 1: Generic Polling Abstraction

**Priority**: HIGH
**Estimated Lines Saved**: ~290
**Risk**: Medium (affects real-time updates)

### Problem

13 polling functions contain nearly identical goroutine structures:

```go
func (a *App) Start[Resource]Polling() {
    go func() {
        ticker := time.NewTicker(time.Second)
        defer ticker.Stop()
        for {
            ctx := a.ctx
            if ctx == nil {
                <-ticker.C
                continue
            }
            select {
            case <-ctx.Done():
                return
            case <-ticker.C:
            }
            // Resource-specific fetch logic
            emitEvent(ctx, "[resource]:update", data)
        }
    }()
}
```

### Affected Files

| File | Function | Lines |
|------|----------|-------|
| `pods.go` | `StartPodPolling` | 603-637 |
| `deployments.go` | `StartDeploymentPolling` | 99-132 |
| `cronjobs.go` | `StartCronJobPolling` | 128-161 |
| `daemonsets.go` | `StartDaemonSetPolling` | 88-121 |
| `statefulsets.go` | `StartStatefulSetPolling` | 74-107 |
| `replicasets.go` | `StartReplicaSetPolling` | 74-107 |
| `docker_integration.go` | `StartSwarmServicePolling` | 1148-1173 |
| `docker_integration.go` | `StartSwarmTaskPolling` | 1177-1202 |
| `docker_integration.go` | `StartSwarmNodePolling` | 1206-1231 |
| `docker_integration.go` | `StartSwarmResourceCountsPolling` | 1235-1257 |

### Solution

Create a new file `pkg/app/polling.go`:

```go
package app

import (
    "context"
    "time"
)

// PollerConfig defines configuration for a resource poller
type PollerConfig struct {
    Name      string
    Interval  time.Duration
    EventName string
}

// NamespacedFetcher fetches resources across namespaces
type NamespacedFetcher[T any] func(namespace string) ([]*T, error)

// SimpleFetcher fetches resources without namespace scope
type SimpleFetcher[T any] func() ([]T, error)

// StartNamespacedPolling starts polling for namespaced Kubernetes resources
func (a *App) StartNamespacedPolling[T any](config PollerConfig, fetch NamespacedFetcher[T]) {
    go func() {
        ticker := time.NewTicker(config.Interval)
        defer ticker.Stop()

        for {
            ctx := a.ctx
            if ctx == nil {
                <-ticker.C
                continue
            }

            select {
            case <-ctx.Done():
                return
            case <-ticker.C:
            }

            nsList := a.preferredNamespaces
            if len(nsList) == 0 && a.currentNamespace != "" {
                nsList = []string{a.currentNamespace}
            }
            if len(nsList) == 0 {
                continue
            }

            var all []*T
            for _, ns := range nsList {
                items, err := fetch(ns)
                if err != nil {
                    continue
                }
                all = append(all, items...)
            }

            emitEvent(ctx, config.EventName, all)
        }
    }()
}

// StartSimplePolling starts polling for non-namespaced resources (Docker Swarm, etc.)
func (a *App) StartSimplePolling[T any](config PollerConfig, fetch SimpleFetcher[T]) {
    go func() {
        ticker := time.NewTicker(config.Interval)
        defer ticker.Stop()

        for {
            ctx := a.ctx
            if ctx == nil {
                <-ticker.C
                continue
            }

            select {
            case <-ctx.Done():
                return
            case <-ticker.C:
            }

            items, err := fetch()
            if err != nil {
                continue
            }

            emitEvent(ctx, config.EventName, items)
        }
    }()
}
```

### Migration Steps

1. Create `pkg/app/polling.go` with generic polling functions
2. Add unit tests in `pkg/app/polling_test.go`
3. Migrate one resource at a time, starting with `deployments.go`:

**Before** (`deployments.go:99-132`):
```go
func (a *App) StartDeploymentPolling() {
    go func() {
        ticker := time.NewTicker(time.Second)
        defer ticker.Stop()
        for {
            // ... 30+ lines of boilerplate
        }
    }()
}
```

**After**:
```go
func (a *App) StartDeploymentPolling() {
    a.StartNamespacedPolling(PollerConfig{
        Name:      "deployments",
        Interval:  time.Second,
        EventName: "deployments:update",
    }, a.GetDeployments)
}
```

4. Migrate remaining Kubernetes resources
5. Migrate Docker Swarm resources using `StartSimplePolling`
6. Remove old polling code after verification

### Testing Strategy

- Unit test the generic polling functions with mock fetchers
- Integration test each migrated resource
- Verify WebSocket events still emit correctly
- Test context cancellation behavior

---

## Phase 2: Client Initialization Standardization

**Priority**: HIGH
**Estimated Lines Saved**: ~80
**Risk**: Low

### Problem

Multiple files manually create Kubernetes clients instead of using the existing `getKubernetesInterface()` helper:

```go
// BAD: Manual client creation (repeated in 7+ files)
configPath := a.getKubeConfigPath()
config, err := clientcmd.LoadFromFile(configPath)
if err != nil {
    return nil, err
}
clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
restConfig, err := clientConfig.ClientConfig()
if err != nil {
    return nil, err
}
clientset, err := kubernetes.NewForConfig(restConfig)
```

```go
// GOOD: Using existing helper
clientset, err := a.getKubernetesInterface()
if err != nil {
    return nil, err
}
```

### Affected Files

| File | Lines | Current Pattern |
|------|-------|-----------------|
| `cronjobs.go` | 21-37 | Manual kubeconfig load |
| `daemonsets.go` | 20-36 | Manual kubeconfig load |
| `configmaps.go` | 20-36 | Manual kubeconfig load |
| `secrets.go` | 22-31 | Mixed pattern |
| `services.go` | 15-25 | Manual kubeconfig load |
| `ingresses.go` | 12-22 | Manual kubeconfig load |
| `persistentvolumeclaims.go` | 15-25 | Manual kubeconfig load |

### Solution

Replace manual client creation with the existing helper in each file.

### Migration Steps

1. For each affected file:
   - Locate the manual client creation code
   - Replace with `clientset, err := a.getKubernetesInterface()`
   - Remove unused imports (`clientcmd`, etc.)
   - Run tests to verify behavior

2. Example migration for `cronjobs.go`:

**Before** (lines 21-37):
```go
func (a *App) GetCronJobs(namespace string) ([]*CronJobInfo, error) {
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
    // ...
}
```

**After**:
```go
func (a *App) GetCronJobs(namespace string) ([]*CronJobInfo, error) {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return nil, err
    }
    // ...
}
```

### Testing Strategy

- Run existing unit tests after each file migration
- Verify test injection (`testClientset`) still works
- Integration test with real cluster connection

---

## Phase 3: Transform Helper Functions

**Priority**: HIGH
**Estimated Lines Saved**: ~300
**Risk**: Low

### Problem

Resource listing functions repeat the same transformation logic:

1. **Age formatting** - Called 15+ times
2. **Image extraction** - Same 3-line pattern in 12+ files
3. **Label merging** - Same 10-line pattern in 5+ files
4. **Replica handling** - Same nil-check pattern in 3 files

### Solution

Create `pkg/app/transform.go`:

```go
package app

import (
    "time"

    corev1 "k8s.io/api/core/v1"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// formatAge returns a human-readable age string from a creation timestamp
func formatAge(creationTime metav1.Time) string {
    if creationTime.IsZero() {
        return "-"
    }
    return formatDuration(time.Since(creationTime.Time))
}

// extractFirstImage returns the image from the first container, or empty string
func extractFirstImage(spec *corev1.PodSpec) string {
    if spec == nil || len(spec.Containers) == 0 {
        return ""
    }
    return spec.Containers[0].Image
}

// extractAllImages returns all container images from a pod spec
func extractAllImages(spec *corev1.PodSpec) []string {
    if spec == nil {
        return nil
    }
    images := make([]string, 0, len(spec.Containers))
    for _, c := range spec.Containers {
        images = append(images, c.Image)
    }
    return images
}

// mergeLabels combines metadata labels with template labels
// Template labels are only added if they don't already exist in metadata
func mergeLabels(metaLabels, templateLabels map[string]string) map[string]string {
    result := make(map[string]string, len(metaLabels)+len(templateLabels))

    for k, v := range metaLabels {
        result[k] = v
    }

    for k, v := range templateLabels {
        if _, exists := result[k]; !exists {
            result[k] = v
        }
    }

    return result
}

// getReplicas safely dereferences a replica count pointer
func getReplicas(replicas *int32) int32 {
    if replicas == nil {
        return 0
    }
    return *replicas
}

// getReplicasWithDefault safely dereferences with a custom default
func getReplicasWithDefault(replicas *int32, defaultVal int32) int32 {
    if replicas == nil {
        return defaultVal
    }
    return *replicas
}
```

### Files to Update

| File | Pattern to Replace | Approx Lines |
|------|-------------------|--------------|
| `deployments.go` | Age, image, labels | ~20 |
| `cronjobs.go` | Age, image, labels | ~20 |
| `daemonsets.go` | Age, image, labels | ~20 |
| `statefulsets.go` | Age, image, labels, replicas | ~25 |
| `replicasets.go` | Age, image, labels, replicas | ~25 |
| `pods.go` | Age, image | ~15 |
| `services.go` | Age, labels | ~10 |
| `secrets.go` | Age | ~5 |
| `configmaps.go` | Age | ~5 |
| `ingresses.go` | Age | ~5 |
| `jobs.go` | Age, image | ~10 |

### Migration Example

**Before** (`deployments.go:45-70`):
```go
age := "-"
if deployment.CreationTimestamp.Time != (time.Time{}) {
    age = formatDuration(time.Now().Sub(deployment.CreationTimestamp.Time))
}

image := ""
if len(deployment.Spec.Template.Spec.Containers) > 0 {
    image = deployment.Spec.Template.Spec.Containers[0].Image
}

labels := map[string]string{}
for k, v := range deployment.Labels {
    labels[k] = v
}
if deployment.Spec.Template.Labels != nil {
    for k, v := range deployment.Spec.Template.Labels {
        if _, exists := labels[k]; !exists {
            labels[k] = v
        }
    }
}
```

**After**:
```go
age := formatAge(deployment.CreationTimestamp)
image := extractFirstImage(&deployment.Spec.Template.Spec)
labels := mergeLabels(deployment.Labels, deployment.Spec.Template.Labels)
```

### Testing Strategy

- Unit test each helper function in `transform_test.go`
- Test edge cases (nil inputs, empty maps, zero times)
- Verify existing tests pass after migration

---

## Phase 4: Delete/Restart Operation Registry

**Priority**: MEDIUM
**Estimated Lines Saved**: ~70
**Risk**: Low

### Problem

11 nearly-identical delete functions in `resource_actions.go`:

```go
func (a *App) DeleteDeployment(namespace, name string) error {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return err
    }
    return clientset.AppsV1().Deployments(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

func (a *App) DeleteStatefulSet(namespace, name string) error {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return err
    }
    return clientset.AppsV1().StatefulSets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}
// ... 9 more identical functions
```

Additionally, `delete_resource.go` duplicates this in a switch statement.

### Solution

Create `pkg/app/resource_registry.go`:

```go
package app

import (
    "context"
    "fmt"
    "strings"

    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/client-go/kubernetes"
)

// ResourceDeleter defines how to delete a specific resource type
type ResourceDeleter func(ctx context.Context, client kubernetes.Interface, namespace, name string) error

// resourceDeleters maps resource kinds to their delete functions
var resourceDeleters = map[string]ResourceDeleter{
    "pod": func(ctx context.Context, client kubernetes.Interface, ns, name string) error {
        return client.CoreV1().Pods(ns).Delete(ctx, name, metav1.DeleteOptions{})
    },
    "deployment": func(ctx context.Context, client kubernetes.Interface, ns, name string) error {
        return client.AppsV1().Deployments(ns).Delete(ctx, name, metav1.DeleteOptions{})
    },
    "statefulset": func(ctx context.Context, client kubernetes.Interface, ns, name string) error {
        return client.AppsV1().StatefulSets(ns).Delete(ctx, name, metav1.DeleteOptions{})
    },
    "daemonset": func(ctx context.Context, client kubernetes.Interface, ns, name string) error {
        return client.AppsV1().DaemonSets(ns).Delete(ctx, name, metav1.DeleteOptions{})
    },
    "replicaset": func(ctx context.Context, client kubernetes.Interface, ns, name string) error {
        return client.AppsV1().ReplicaSets(ns).Delete(ctx, name, metav1.DeleteOptions{})
    },
    "configmap": func(ctx context.Context, client kubernetes.Interface, ns, name string) error {
        return client.CoreV1().ConfigMaps(ns).Delete(ctx, name, metav1.DeleteOptions{})
    },
    "secret": func(ctx context.Context, client kubernetes.Interface, ns, name string) error {
        return client.CoreV1().Secrets(ns).Delete(ctx, name, metav1.DeleteOptions{})
    },
    "service": func(ctx context.Context, client kubernetes.Interface, ns, name string) error {
        return client.CoreV1().Services(ns).Delete(ctx, name, metav1.DeleteOptions{})
    },
    "ingress": func(ctx context.Context, client kubernetes.Interface, ns, name string) error {
        return client.NetworkingV1().Ingresses(ns).Delete(ctx, name, metav1.DeleteOptions{})
    },
    "persistentvolumeclaim": func(ctx context.Context, client kubernetes.Interface, ns, name string) error {
        return client.CoreV1().PersistentVolumeClaims(ns).Delete(ctx, name, metav1.DeleteOptions{})
    },
    "persistentvolume": func(ctx context.Context, client kubernetes.Interface, ns, name string) error {
        return client.CoreV1().PersistentVolumes().Delete(ctx, name, metav1.DeleteOptions{})
    },
}

// DeleteResource deletes any supported Kubernetes resource
func (a *App) DeleteResource(kind, namespace, name string) error {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return err
    }

    normalizedKind := strings.ToLower(strings.TrimSuffix(kind, "s"))

    deleter, ok := resourceDeleters[normalizedKind]
    if !ok {
        return fmt.Errorf("unsupported resource kind: %s", kind)
    }

    return deleter(a.ctx, clientset, namespace, name)
}
```

### Similar Pattern for Restart Operations

```go
// ResourceRestarter defines how to restart a workload
type ResourceRestarter func(ctx context.Context, client kubernetes.Interface, namespace, name string, patch []byte) error

var resourceRestarters = map[string]ResourceRestarter{
    "deployment": func(ctx context.Context, client kubernetes.Interface, ns, name string, patch []byte) error {
        _, err := client.AppsV1().Deployments(ns).Patch(ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
        return err
    },
    "statefulset": func(ctx context.Context, client kubernetes.Interface, ns, name string, patch []byte) error {
        _, err := client.AppsV1().StatefulSets(ns).Patch(ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
        return err
    },
    "daemonset": func(ctx context.Context, client kubernetes.Interface, ns, name string, patch []byte) error {
        _, err := client.AppsV1().DaemonSets(ns).Patch(ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
        return err
    },
}

// RestartWorkload restarts any supported workload type
func (a *App) RestartWorkload(kind, namespace, name string) error {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return err
    }

    normalizedKind := strings.ToLower(strings.TrimSuffix(kind, "s"))

    restarter, ok := resourceRestarters[normalizedKind]
    if !ok {
        return fmt.Errorf("unsupported workload kind for restart: %s", kind)
    }

    patch := []byte(fmt.Sprintf(
        `{"spec":{"template":{"metadata":{"annotations":{"kube-dev-bench/restartedAt":"%s"}}}}}`,
        time.Now().Format(time.RFC3339),
    ))

    return restarter(a.ctx, clientset, namespace, name, patch)
}
```

### Migration Steps

1. Create `pkg/app/resource_registry.go`
2. Add comprehensive unit tests
3. Update `delete_resource.go` to use `DeleteResource()`
4. Keep individual `Delete*` functions as thin wrappers for backward compatibility:
   ```go
   func (a *App) DeleteDeployment(namespace, name string) error {
       return a.DeleteResource("deployment", namespace, name)
   }
   ```
5. Update restart functions similarly
6. Remove duplicated code from `resource_actions.go`

### Testing Strategy

- Unit test registry with mock clientset
- Test unknown resource kind handling
- Integration test with real cluster
- Verify Wails bindings still work

---

## Implementation Schedule

### Week 1: Foundation
- [ ] Create `pkg/app/polling.go` with generic polling functions
- [ ] Create `pkg/app/polling_test.go` with unit tests
- [ ] Migrate 2 resource polling functions as proof of concept

### Week 2: Polling Migration
- [ ] Migrate remaining Kubernetes polling functions
- [ ] Migrate Docker Swarm polling functions
- [ ] Remove old polling code

### Week 3: Client & Transform
- [ ] Standardize client initialization in all affected files
- [ ] Create `pkg/app/transform.go` with helper functions
- [ ] Create `pkg/app/transform_test.go`
- [ ] Migrate transformation code in resource handlers

### Week 4: Registry & Cleanup
- [ ] Create `pkg/app/resource_registry.go`
- [ ] Migrate delete operations
- [ ] Migrate restart operations
- [ ] Final cleanup and documentation

---

## Testing Requirements

Each phase must maintain:
- **Unit test coverage**: >= 70% for new code
- **Existing tests**: All must pass
- **E2E tests**: No regressions in Playwright tests

### Test Commands

```bash
# Run Go unit tests with coverage
go test -cover ./pkg/app/...

# Generate coverage report
go test -coverprofile=coverage.out ./pkg/app/...
go tool cover -html=coverage.out

# Run frontend tests (verify Wails bindings)
cd frontend && npm test

# Run E2E tests
cd e2e && npx playwright test
```

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking Wails bindings | High | Keep existing function signatures as thin wrappers |
| Polling timing changes | Medium | Use exact same intervals; add integration tests |
| Test injection breaks | Medium | Verify `testClientset` pattern works with new code |
| Generic type constraints | Low | Go 1.18+ required (already in use) |

---

## Success Metrics

- [ ] ~735 lines of code removed
- [ ] All unit tests passing with >= 70% coverage
- [ ] All E2E tests passing
- [ ] No new Wails binding changes required
- [ ] Code review approved
