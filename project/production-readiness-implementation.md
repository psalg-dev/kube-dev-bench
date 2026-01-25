# Production Readiness - Detailed Implementation Plan

This document provides step-by-step implementation details for each item in the production readiness plan, including specific code changes, file paths, and verification steps.

---

## Implementation Status Summary

### Phase 2: Consistency Fixes (P1)
- [x] **2.1 Holmes AI Integration** - Already implemented for all 7 resource types (Jobs, CronJobs, Ingresses, ConfigMaps, Secrets, PVs, PVCs) via existing `HolmesBottomPanel` integration
- [x] **2.2 Services Endpoints Tab** - Implemented: `ServiceEndpointsTab.jsx` + `GetServiceEndpoints()` backend function
- [x] **2.3 Tab Ordering** - Already consistent across all resource views
- [x] **2.4 Swarm Inspect View** - Deferred (partial coverage already exists via `InspectJSONTab`)

### Phase 3: Polish (P2)
- [x] **3.1 Logger Utility** - Created `frontend/src/utils/logger.js` for production-safe logging
- [ ] **3.2 Error Fallbacks** - Pending (requires systematic review)
- [x] **3.3 Empty State Messages** - Created `frontend/src/components/EmptyState.jsx` with CSS
- [x] **3.4 Configurable Polling** - Created `frontend/src/state/SettingsContext.jsx` with localStorage persistence
- [x] **3.5 Status Badge Colors** - Created `frontend/src/components/StatusBadge.jsx` with CSS

### Phase 4: Enhancements (P3)
- [x] **4.1 Swarm Events** - Implemented: `pkg/app/docker/events.go` + `SwarmEventsTab.jsx` + `GetSwarmEvents()`/`GetSwarmServiceEvents()` RPC functions
- [x] **4.2 Init Containers** - Implemented: `PodSummary` now includes `InitContainerInfo` array with state/status/restart count

---

## Phase 1: Critical Fixes (P0)

### 1.1 Replace Hardcoded YAML Templates with Actual Resource YAML

#### Overview
Currently, resources like Jobs, ConfigMaps, Secrets, etc. display template YAML instead of actual Kubernetes API data. The pattern used by Pods (`PodYamlTab.jsx` + `GetPodYAML()`) should be replicated for all resources.

#### Backend Implementation

**Create `pkg/app/resource_yaml.go`:**

```go
package app

import (
	"context"
	"fmt"

	"sigs.k8s.io/yaml"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GetServiceYAML retrieves the YAML manifest for a Service
func (a *App) GetServiceYAML(namespace, name string) (string, error) {
	if a.clientset == nil {
		return "", fmt.Errorf("not connected to cluster")
	}
	svc, err := a.clientset.CoreV1().Services(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get service: %w", err)
	}
	// Clear managed fields for cleaner output
	svc.ManagedFields = nil
	data, err := yaml.Marshal(svc)
	if err != nil {
		return "", fmt.Errorf("failed to marshal service: %w", err)
	}
	return string(data), nil
}

// GetIngressYAML retrieves the YAML manifest for an Ingress
func (a *App) GetIngressYAML(namespace, name string) (string, error) {
	if a.clientset == nil {
		return "", fmt.Errorf("not connected to cluster")
	}
	ing, err := a.clientset.NetworkingV1().Ingresses(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get ingress: %w", err)
	}
	ing.ManagedFields = nil
	data, err := yaml.Marshal(ing)
	if err != nil {
		return "", fmt.Errorf("failed to marshal ingress: %w", err)
	}
	return string(data), nil
}

// GetJobYAML retrieves the YAML manifest for a Job
func (a *App) GetJobYAML(namespace, name string) (string, error) {
	if a.clientset == nil {
		return "", fmt.Errorf("not connected to cluster")
	}
	job, err := a.clientset.BatchV1().Jobs(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get job: %w", err)
	}
	job.ManagedFields = nil
	data, err := yaml.Marshal(job)
	if err != nil {
		return "", fmt.Errorf("failed to marshal job: %w", err)
	}
	return string(data), nil
}

// GetCronJobYAML retrieves the YAML manifest for a CronJob
func (a *App) GetCronJobYAML(namespace, name string) (string, error) {
	if a.clientset == nil {
		return "", fmt.Errorf("not connected to cluster")
	}
	cj, err := a.clientset.BatchV1().CronJobs(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get cronjob: %w", err)
	}
	cj.ManagedFields = nil
	data, err := yaml.Marshal(cj)
	if err != nil {
		return "", fmt.Errorf("failed to marshal cronjob: %w", err)
	}
	return string(data), nil
}

// GetConfigMapYAML retrieves the YAML manifest for a ConfigMap
func (a *App) GetConfigMapYAML(namespace, name string) (string, error) {
	if a.clientset == nil {
		return "", fmt.Errorf("not connected to cluster")
	}
	cm, err := a.clientset.CoreV1().ConfigMaps(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get configmap: %w", err)
	}
	cm.ManagedFields = nil
	data, err := yaml.Marshal(cm)
	if err != nil {
		return "", fmt.Errorf("failed to marshal configmap: %w", err)
	}
	return string(data), nil
}

// GetSecretYAML retrieves the YAML manifest for a Secret (with data redacted)
func (a *App) GetSecretYAML(namespace, name string) (string, error) {
	if a.clientset == nil {
		return "", fmt.Errorf("not connected to cluster")
	}
	secret, err := a.clientset.CoreV1().Secrets(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get secret: %w", err)
	}
	secret.ManagedFields = nil
	// Redact secret data for security - show keys but not values
	for key := range secret.Data {
		secret.Data[key] = []byte("<REDACTED>")
	}
	for key := range secret.StringData {
		secret.StringData[key] = "<REDACTED>"
	}
	data, err := yaml.Marshal(secret)
	if err != nil {
		return "", fmt.Errorf("failed to marshal secret: %w", err)
	}
	return string(data), nil
}

// GetPersistentVolumeYAML retrieves the YAML manifest for a PV (cluster-scoped)
func (a *App) GetPersistentVolumeYAML(name string) (string, error) {
	if a.clientset == nil {
		return "", fmt.Errorf("not connected to cluster")
	}
	pv, err := a.clientset.CoreV1().PersistentVolumes().Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get persistent volume: %w", err)
	}
	pv.ManagedFields = nil
	data, err := yaml.Marshal(pv)
	if err != nil {
		return "", fmt.Errorf("failed to marshal persistent volume: %w", err)
	}
	return string(data), nil
}

// GetPersistentVolumeClaimYAML retrieves the YAML manifest for a PVC
func (a *App) GetPersistentVolumeClaimYAML(namespace, name string) (string, error) {
	if a.clientset == nil {
		return "", fmt.Errorf("not connected to cluster")
	}
	pvc, err := a.clientset.CoreV1().PersistentVolumeClaims(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get persistent volume claim: %w", err)
	}
	pvc.ManagedFields = nil
	data, err := yaml.Marshal(pvc)
	if err != nil {
		return "", fmt.Errorf("failed to marshal persistent volume claim: %w", err)
	}
	return string(data), nil
}
```

**Create `pkg/app/resource_yaml_test.go`:**

```go
package app

import (
	"testing"
	// Use fake clientset for testing
)

func TestGetServiceYAML(t *testing.T) {
	// Test with mock clientset
	// Verify YAML output contains expected fields
	// Verify ManagedFields are cleared
}

func TestGetSecretYAML_RedactsData(t *testing.T) {
	// Verify secret data shows <REDACTED> not actual values
}

// Additional tests for each function
```

#### Frontend Implementation

**Create reusable YAML tab component pattern. For each resource, create a dedicated YAML tab component following the `PodYamlTab.jsx` pattern:**

**Create `frontend/src/k8s/resources/services/ServiceYamlTab.jsx`:**

```jsx
import { useState, useEffect } from 'react';
import { GetServiceYAML } from '../../../../wailsjs/go/main/App';
import YamlTab from '../../../layout/bottompanel/YamlTab';

export default function ServiceYamlTab({ namespace, name }) {
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchYaml = async () => {
    if (!name || !namespace) return;
    setLoading(true);
    setError(null);
    try {
      const res = await GetServiceYAML(namespace, name);
      setYaml(res || '');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYaml();
  }, [namespace, name]);

  if (loading) {
    return <div className="yaml-loading">Loading YAML...</div>;
  }

  if (error) {
    return <div className="yaml-error">Error loading YAML: {error}</div>;
  }

  return (
    <YamlTab
      content={yaml}
      onRefresh={fetchYaml}
      filename={`${name}.yaml`}
    />
  );
}
```

**Repeat this pattern for each resource type:**
- `frontend/src/k8s/resources/ingresses/IngressYamlTab.jsx`
- `frontend/src/k8s/resources/jobs/JobYamlTab.jsx`
- `frontend/src/k8s/resources/cronjobs/CronJobYamlTab.jsx`
- `frontend/src/k8s/resources/configmaps/ConfigMapYamlTab.jsx`
- `frontend/src/k8s/resources/secrets/SecretYamlTab.jsx`
- `frontend/src/k8s/resources/persistentvolumes/PersistentVolumeYamlTab.jsx`
- `frontend/src/k8s/resources/persistentvolumeclaims/PersistentVolumeClaimYamlTab.jsx`

#### Update Overview Tables

**Update `frontend/src/k8s/resources/jobs/JobsOverviewTable.jsx`:**

Replace the hardcoded YAML template (lines ~113-129) with:

```jsx
// Add import at top
import JobYamlTab from './JobYamlTab';

// In renderPanelContent function, replace the yaml case:
if (tab === 'yaml') {
  return <JobYamlTab namespace={row.namespace} name={row.name} />;
}
```

**Apply the same pattern to all affected files:**

| File | Import | Replacement |
|------|--------|-------------|
| `ServicesOverviewTable.jsx` | `ServiceYamlTab` | `<ServiceYamlTab namespace={row.namespace} name={row.name} />` |
| `IngressesOverviewTable.jsx` | `IngressYamlTab` | `<IngressYamlTab namespace={row.namespace} name={row.name} />` |
| `CronJobsOverviewTable.jsx` | `CronJobYamlTab` | `<CronJobYamlTab namespace={row.namespace} name={row.name} />` |
| `ConfigMapsOverviewTable.jsx` | `ConfigMapYamlTab` | `<ConfigMapYamlTab namespace={row.namespace} name={row.name} />` |
| `SecretsOverviewTable.jsx` | `SecretYamlTab` | `<SecretYamlTab namespace={row.namespace} name={row.name} />` |
| `PersistentVolumesOverviewTable.jsx` | `PersistentVolumeYamlTab` | `<PersistentVolumeYamlTab name={row.name} />` |
| `PersistentVolumeClaimsOverviewTable.jsx` | `PersistentVolumeClaimYamlTab` | `<PersistentVolumeClaimYamlTab namespace={row.namespace} name={row.name} />` |

#### Verification
- [ ] Run `wails build` to regenerate Wails bindings
- [ ] Unit test each Go function with mock clientset
- [ ] E2E test: Create a Service, verify YAML tab shows actual port values
- [ ] E2E test: Create a ConfigMap, verify YAML shows actual data keys
- [ ] Manual: Compare YAML output with `kubectl get <resource> -o yaml`

---

### 1.2 Fix Ingress Test Endpoint Protocol Detection

**File:** `frontend/src/k8s/resources/ingresses/IngressesOverviewTable.jsx`

**Location:** Line ~73 where test endpoint URL is constructed

**Current code:**
```jsx
const url = `https://${host}`;
```

**Replace with:**
```jsx
// Check if TLS is configured for this host
const hasTLS = Array.isArray(row.tls) && row.tls.some(tlsConfig =>
  !tlsConfig.hosts || tlsConfig.hosts.length === 0 || tlsConfig.hosts.includes(host)
);
const protocol = hasTLS ? 'https' : 'http';
const url = `${protocol}://${host}`;
```

**Additional context:** The `row.tls` array contains TLS configuration objects. Each may have a `hosts` array. If hosts is empty/undefined, TLS applies to all hosts. Otherwise, check if the specific host is in the list.

#### Verification
- [ ] E2E test: Create Ingress without TLS, verify test URL uses `http://`
- [ ] E2E test: Create Ingress with TLS, verify test URL uses `https://`
- [ ] Manual: Verify clicking test endpoint opens correct URL

---

### 1.3 Remove ECR "Coming Soon" Placeholder

**File:** `frontend/src/docker/registry/AddRegistryModal.jsx`

**Location:** Lines ~108 and ~237

**Changes:**

1. **Remove ECR from REGISTRY_TYPES array** (around line 108):

```jsx
// Before
const REGISTRY_TYPES = [
  { value: 'dockerhub', label: 'Docker Hub' },
  { value: 'artifactory', label: 'Artifactory' },
  { value: 'ecr', label: 'AWS ECR' },
  { value: 'generic_v2', label: 'Generic v2' },
];

// After
const REGISTRY_TYPES = [
  { value: 'dockerhub', label: 'Docker Hub' },
  { value: 'artifactory', label: 'Artifactory' },
  { value: 'generic_v2', label: 'Generic v2' },
];
```

2. **Remove ECR-specific form section** (around line 237):

Delete or comment out the entire ECR form section that shows "Coming Soon".

#### Verification
- [ ] Manual: Open Add Registry modal, verify ECR is not in dropdown
- [ ] Manual: Verify no "Coming Soon" text appears anywhere in modal

---

### 1.4 Fix Hardcoded ConfigMap Template Data

**File:** `frontend/src/CreateManifestOverlay.jsx`

**Location:** Line ~187

**Current code:**
```jsx
data:
  database.host=localhost
  database.port=5432
```

**Replace with:**
```jsx
data:
  # Add your configuration keys here
  # Example:
  # app.config: |
  #   key1: value1
  #   key2: value2
```

Or for a cleaner approach, use empty data with a placeholder comment:
```jsx
data: {}
  # Add key-value pairs for your configuration
```

#### Verification
- [ ] Manual: Open Create Manifest overlay, select ConfigMap
- [ ] Verify template shows generic placeholder, not database-specific values

---

## Phase 2: Consistency Fixes (P1)

### 2.1 Add Holmes AI Integration to Missing Resources

This is the largest task. Follow the existing pattern from `DeploymentsOverviewTable.jsx`.

#### Backend Changes

**File:** `pkg/app/holmes_integration.go`

Add streaming analysis functions for each resource type. Follow the pattern at lines 745-844.

```go
// AnalyzeJobStream initiates streaming analysis for a Job
func (a *App) AnalyzeJobStream(namespace, name, streamID string) error {
	ctx := getJobContext(a, namespace, name)
	question := fmt.Sprintf("Analyze this Kubernetes Job '%s' in namespace '%s'. %s", name, namespace, ctx)
	return a.AskHolmesStream(question, streamID)
}

// AnalyzeCronJobStream initiates streaming analysis for a CronJob
func (a *App) AnalyzeCronJobStream(namespace, name, streamID string) error {
	ctx := getCronJobContext(a, namespace, name)
	question := fmt.Sprintf("Analyze this Kubernetes CronJob '%s' in namespace '%s'. %s", name, namespace, ctx)
	return a.AskHolmesStream(question, streamID)
}

// AnalyzeIngressStream initiates streaming analysis for an Ingress
func (a *App) AnalyzeIngressStream(namespace, name, streamID string) error {
	ctx := getIngressContext(a, namespace, name)
	question := fmt.Sprintf("Analyze this Kubernetes Ingress '%s' in namespace '%s'. %s", name, namespace, ctx)
	return a.AskHolmesStream(question, streamID)
}

// AnalyzeConfigMapStream initiates streaming analysis for a ConfigMap
func (a *App) AnalyzeConfigMapStream(namespace, name, streamID string) error {
	ctx := getConfigMapContext(a, namespace, name)
	question := fmt.Sprintf("Analyze this Kubernetes ConfigMap '%s' in namespace '%s'. %s", name, namespace, ctx)
	return a.AskHolmesStream(question, streamID)
}

// AnalyzeSecretStream initiates streaming analysis for a Secret
func (a *App) AnalyzeSecretStream(namespace, name, streamID string) error {
	ctx := getSecretContext(a, namespace, name)
	question := fmt.Sprintf("Analyze this Kubernetes Secret '%s' in namespace '%s'. %s", name, namespace, ctx)
	return a.AskHolmesStream(question, streamID)
}

// AnalyzePersistentVolumeStream initiates streaming analysis for a PV
func (a *App) AnalyzePersistentVolumeStream(name, streamID string) error {
	ctx := getPersistentVolumeContext(a, name)
	question := fmt.Sprintf("Analyze this Kubernetes PersistentVolume '%s'. %s", name, ctx)
	return a.AskHolmesStream(question, streamID)
}

// AnalyzePersistentVolumeClaimStream initiates streaming analysis for a PVC
func (a *App) AnalyzePersistentVolumeClaimStream(namespace, name, streamID string) error {
	ctx := getPersistentVolumeClaimContext(a, namespace, name)
	question := fmt.Sprintf("Analyze this Kubernetes PersistentVolumeClaim '%s' in namespace '%s'. %s", name, namespace, ctx)
	return a.AskHolmesStream(question, streamID)
}
```

**File:** `pkg/app/holmes_context.go`

Add context gathering functions for each resource type:

```go
func getJobContext(a *App, namespace, name string) string {
	var ctx strings.Builder
	ctx.WriteString("Context:\n")

	// Get Job details
	job, err := a.clientset.BatchV1().Jobs(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err == nil {
		ctx.WriteString(fmt.Sprintf("- Completions: %d/%d\n", job.Status.Succeeded, *job.Spec.Completions))
		ctx.WriteString(fmt.Sprintf("- Parallelism: %d\n", *job.Spec.Parallelism))
		ctx.WriteString(fmt.Sprintf("- Active: %d, Failed: %d\n", job.Status.Active, job.Status.Failed))
		if job.Status.StartTime != nil {
			ctx.WriteString(fmt.Sprintf("- Started: %s\n", job.Status.StartTime.Format(time.RFC3339)))
		}
	}

	// Get related pods
	pods, err := a.clientset.CoreV1().Pods(namespace).List(context.Background(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("job-name=%s", name),
	})
	if err == nil && len(pods.Items) > 0 {
		ctx.WriteString("- Related pods:\n")
		for _, pod := range pods.Items {
			ctx.WriteString(fmt.Sprintf("  - %s: %s\n", pod.Name, pod.Status.Phase))
		}
	}

	// Get events
	events := getResourceEvents(a, namespace, "Job", name)
	if events != "" {
		ctx.WriteString("- Events:\n")
		ctx.WriteString(events)
	}

	return ctx.String()
}

func getCronJobContext(a *App, namespace, name string) string {
	var ctx strings.Builder
	ctx.WriteString("Context:\n")

	cj, err := a.clientset.BatchV1().CronJobs(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err == nil {
		ctx.WriteString(fmt.Sprintf("- Schedule: %s\n", cj.Spec.Schedule))
		ctx.WriteString(fmt.Sprintf("- Suspend: %v\n", *cj.Spec.Suspend))
		ctx.WriteString(fmt.Sprintf("- Active jobs: %d\n", len(cj.Status.Active)))
		if cj.Status.LastScheduleTime != nil {
			ctx.WriteString(fmt.Sprintf("- Last scheduled: %s\n", cj.Status.LastScheduleTime.Format(time.RFC3339)))
		}
	}

	return ctx.String()
}

func getIngressContext(a *App, namespace, name string) string {
	var ctx strings.Builder
	ctx.WriteString("Context:\n")

	ing, err := a.clientset.NetworkingV1().Ingresses(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err == nil {
		ctx.WriteString(fmt.Sprintf("- Class: %s\n", *ing.Spec.IngressClassName))
		ctx.WriteString("- Rules:\n")
		for _, rule := range ing.Spec.Rules {
			ctx.WriteString(fmt.Sprintf("  - Host: %s\n", rule.Host))
			if rule.HTTP != nil {
				for _, path := range rule.HTTP.Paths {
					ctx.WriteString(fmt.Sprintf("    - %s -> %s:%d\n", path.Path, path.Backend.Service.Name, path.Backend.Service.Port.Number))
				}
			}
		}
		if len(ing.Spec.TLS) > 0 {
			ctx.WriteString("- TLS configured\n")
		}
	}

	return ctx.String()
}

func getConfigMapContext(a *App, namespace, name string) string {
	var ctx strings.Builder
	ctx.WriteString("Context:\n")

	cm, err := a.clientset.CoreV1().ConfigMaps(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err == nil {
		ctx.WriteString(fmt.Sprintf("- Data keys: %d\n", len(cm.Data)))
		for key := range cm.Data {
			ctx.WriteString(fmt.Sprintf("  - %s\n", key))
		}
		ctx.WriteString(fmt.Sprintf("- Binary data keys: %d\n", len(cm.BinaryData)))
	}

	// Find pods that reference this ConfigMap
	pods := findPodsReferencingConfigMap(a, namespace, name)
	if len(pods) > 0 {
		ctx.WriteString("- Referenced by pods:\n")
		for _, pod := range pods {
			ctx.WriteString(fmt.Sprintf("  - %s\n", pod))
		}
	}

	return ctx.String()
}

func getSecretContext(a *App, namespace, name string) string {
	var ctx strings.Builder
	ctx.WriteString("Context:\n")

	secret, err := a.clientset.CoreV1().Secrets(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err == nil {
		ctx.WriteString(fmt.Sprintf("- Type: %s\n", secret.Type))
		ctx.WriteString(fmt.Sprintf("- Data keys: %d\n", len(secret.Data)))
		for key := range secret.Data {
			ctx.WriteString(fmt.Sprintf("  - %s\n", key))
		}
		// Note: Never include actual secret values in context
	}

	return ctx.String()
}

func getPersistentVolumeContext(a *App, name string) string {
	var ctx strings.Builder
	ctx.WriteString("Context:\n")

	pv, err := a.clientset.CoreV1().PersistentVolumes().Get(context.Background(), name, metav1.GetOptions{})
	if err == nil {
		ctx.WriteString(fmt.Sprintf("- Capacity: %s\n", pv.Spec.Capacity.Storage().String()))
		ctx.WriteString(fmt.Sprintf("- Access modes: %v\n", pv.Spec.AccessModes))
		ctx.WriteString(fmt.Sprintf("- Reclaim policy: %s\n", pv.Spec.PersistentVolumeReclaimPolicy))
		ctx.WriteString(fmt.Sprintf("- Status: %s\n", pv.Status.Phase))
		if pv.Spec.ClaimRef != nil {
			ctx.WriteString(fmt.Sprintf("- Bound to: %s/%s\n", pv.Spec.ClaimRef.Namespace, pv.Spec.ClaimRef.Name))
		}
	}

	return ctx.String()
}

func getPersistentVolumeClaimContext(a *App, namespace, name string) string {
	var ctx strings.Builder
	ctx.WriteString("Context:\n")

	pvc, err := a.clientset.CoreV1().PersistentVolumeClaims(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err == nil {
		ctx.WriteString(fmt.Sprintf("- Status: %s\n", pvc.Status.Phase))
		ctx.WriteString(fmt.Sprintf("- Storage class: %s\n", *pvc.Spec.StorageClassName))
		ctx.WriteString(fmt.Sprintf("- Access modes: %v\n", pvc.Spec.AccessModes))
		ctx.WriteString(fmt.Sprintf("- Requested: %s\n", pvc.Spec.Resources.Requests.Storage().String()))
		if pvc.Spec.VolumeName != "" {
			ctx.WriteString(fmt.Sprintf("- Bound to PV: %s\n", pvc.Spec.VolumeName))
		}
	}

	// Find pods using this PVC
	pods := findPodsUsingPVC(a, namespace, name)
	if len(pods) > 0 {
		ctx.WriteString("- Used by pods:\n")
		for _, pod := range pods {
			ctx.WriteString(fmt.Sprintf("  - %s\n", pod))
		}
	}

	return ctx.String()
}
```

#### Frontend Changes

**File:** `frontend/src/holmes/holmesApi.js`

Add API functions for each new resource type:

```javascript
// Add exports for new streaming functions
export async function AnalyzeJobStream(namespace, name, streamId) {
  return await window.go.main.App.AnalyzeJobStream(namespace, name, streamId);
}

export async function AnalyzeCronJobStream(namespace, name, streamId) {
  return await window.go.main.App.AnalyzeCronJobStream(namespace, name, streamId);
}

export async function AnalyzeIngressStream(namespace, name, streamId) {
  return await window.go.main.App.AnalyzeIngressStream(namespace, name, streamId);
}

export async function AnalyzeConfigMapStream(namespace, name, streamId) {
  return await window.go.main.App.AnalyzeConfigMapStream(namespace, name, streamId);
}

export async function AnalyzeSecretStream(namespace, name, streamId) {
  return await window.go.main.App.AnalyzeSecretStream(namespace, name, streamId);
}

export async function AnalyzePersistentVolumeStream(name, streamId) {
  return await window.go.main.App.AnalyzePersistentVolumeStream(name, streamId);
}

export async function AnalyzePersistentVolumeClaimStream(namespace, name, streamId) {
  return await window.go.main.App.AnalyzePersistentVolumeClaimStream(namespace, name, streamId);
}
```

#### Update Each Resource Overview Table

Follow the pattern from `DeploymentsOverviewTable.jsx`. For each resource:

1. **Add imports:**
```jsx
import { HolmesBottomPanel } from '../../../holmes/HolmesBottomPanel';
import { AnalyzeJobStream, CancelHolmesStream, onHolmesChatStream, onHolmesContextProgress } from '../../../holmes/holmesApi';
```

2. **Add Holmes state:**
```jsx
const [holmesState, setHolmesState] = useState({
  loading: false,
  response: null,
  error: null,
  key: null,
  streamId: null,
  streamingText: '',
  reasoningText: '',
  queryTimestamp: null,
  contextSteps: [],
  toolEvents: [],
});
```

3. **Add stream event listeners (useEffect):**
```jsx
useEffect(() => {
  const unsubscribeChat = onHolmesChatStream((payload) => {
    if (payload.streamId !== holmesState.streamId) return;
    // Handle streaming updates (copy pattern from DeploymentsOverviewTable)
  });

  const unsubscribeContext = onHolmesContextProgress((payload) => {
    if (payload.streamId !== holmesState.streamId) return;
    // Handle context progress updates
  });

  return () => {
    unsubscribeChat();
    unsubscribeContext();
  };
}, [holmesState.streamId]);
```

4. **Add Holmes tab to bottomTabs:**
```jsx
const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  // ... other tabs ...
  { key: 'events', label: 'Events' },
  { key: 'yaml', label: 'YAML' },
  { key: 'holmes', label: 'Holmes' },  // Add before or after YAML
];
```

5. **Add Holmes analysis handler:**
```jsx
const analyzeWithHolmes = async (row) => {
  const streamId = `job-${row.namespace}-${row.name}-${Date.now()}`;
  setHolmesState({
    loading: true,
    response: null,
    error: null,
    key: `${row.namespace}/${row.name}`,
    streamId,
    streamingText: '',
    reasoningText: '',
    queryTimestamp: Date.now(),
    contextSteps: [],
    toolEvents: [],
  });
  try {
    await AnalyzeJobStream(row.namespace, row.name, streamId);
  } catch (e) {
    setHolmesState(prev => ({ ...prev, loading: false, error: String(e) }));
  }
};

const cancelHolmes = async () => {
  if (holmesState.streamId) {
    await CancelHolmesStream(holmesState.streamId);
    setHolmesState(prev => ({ ...prev, loading: false }));
  }
};
```

6. **Update renderPanelContent to handle Holmes tab:**
```jsx
function renderPanelContent(row, tab, holmesState, onAnalyze, onCancel) {
  // ... existing tab cases ...

  if (tab === 'holmes') {
    return (
      <HolmesBottomPanel
        kind="Job"
        namespace={row.namespace}
        name={row.name}
        onAnalyze={() => onAnalyze(row)}
        onCancel={onCancel}
        response={holmesState.key === `${row.namespace}/${row.name}` ? holmesState.response : null}
        loading={holmesState.key === `${row.namespace}/${row.name}` && holmesState.loading}
        error={holmesState.key === `${row.namespace}/${row.name}` ? holmesState.error : null}
        queryTimestamp={holmesState.queryTimestamp}
        streamingText={holmesState.streamingText}
        reasoningText={holmesState.reasoningText}
        toolEvents={holmesState.toolEvents}
        contextSteps={holmesState.contextSteps}
      />
    );
  }
}
```

7. **Add "Ask Holmes" to row actions menu:**
```jsx
const rowActions = [
  // ... existing actions ...
  {
    label: 'Ask Holmes',
    icon: <HolmesIcon />,
    onClick: (row) => {
      analyzeWithHolmes(row);
      setActiveTab('holmes');
    },
  },
];
```

#### Files to Update

| Resource | File | Analyze Function |
|----------|------|------------------|
| Jobs | `frontend/src/k8s/resources/jobs/JobsOverviewTable.jsx` | `AnalyzeJobStream` |
| CronJobs | `frontend/src/k8s/resources/cronjobs/CronJobsOverviewTable.jsx` | `AnalyzeCronJobStream` |
| Ingresses | `frontend/src/k8s/resources/ingresses/IngressesOverviewTable.jsx` | `AnalyzeIngressStream` |
| ConfigMaps | `frontend/src/k8s/resources/configmaps/ConfigMapsOverviewTable.jsx` | `AnalyzeConfigMapStream` |
| Secrets | `frontend/src/k8s/resources/secrets/SecretsOverviewTable.jsx` | `AnalyzeSecretStream` |
| PVs | `frontend/src/k8s/resources/persistentvolumes/PersistentVolumesOverviewTable.jsx` | `AnalyzePersistentVolumeStream` |
| PVCs | `frontend/src/k8s/resources/persistentvolumeclaims/PersistentVolumeClaimsOverviewTable.jsx` | `AnalyzePersistentVolumeClaimStream` |

#### Verification
- [ ] Unit test each Go context function
- [ ] E2E test: Click "Ask Holmes" on a Job, verify analysis appears
- [ ] E2E test: Verify Holmes streaming works for each resource type
- [ ] Manual: Test cancel functionality during analysis

---

### 2.2 Add Missing Services Endpoints Tab

#### Backend Implementation

**File:** `pkg/app/services.go`

Add the endpoint retrieval function:

```go
type ServiceEndpoint struct {
	IP         string `json:"ip"`
	Port       int32  `json:"port"`
	Protocol   string `json:"protocol"`
	PodName    string `json:"podName"`
	NodeName   string `json:"nodeName"`
	Ready      bool   `json:"ready"`
	TargetRef  string `json:"targetRef"`
}

func (a *App) GetServiceEndpoints(namespace, serviceName string) ([]ServiceEndpoint, error) {
	if a.clientset == nil {
		return nil, fmt.Errorf("not connected to cluster")
	}

	// Get the Endpoints object (same name as Service)
	endpoints, err := a.clientset.CoreV1().Endpoints(namespace).Get(
		context.Background(), serviceName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get endpoints: %w", err)
	}

	var result []ServiceEndpoint
	for _, subset := range endpoints.Subsets {
		for _, addr := range subset.Addresses {
			for _, port := range subset.Ports {
				ep := ServiceEndpoint{
					IP:       addr.IP,
					Port:     port.Port,
					Protocol: string(port.Protocol),
					Ready:    true,
				}
				if addr.TargetRef != nil {
					ep.PodName = addr.TargetRef.Name
					ep.TargetRef = fmt.Sprintf("%s/%s", addr.TargetRef.Kind, addr.TargetRef.Name)
				}
				if addr.NodeName != nil {
					ep.NodeName = *addr.NodeName
				}
				result = append(result, ep)
			}
		}
		// Also include not-ready addresses
		for _, addr := range subset.NotReadyAddresses {
			for _, port := range subset.Ports {
				ep := ServiceEndpoint{
					IP:       addr.IP,
					Port:     port.Port,
					Protocol: string(port.Protocol),
					Ready:    false,
				}
				if addr.TargetRef != nil {
					ep.PodName = addr.TargetRef.Name
				}
				result = append(result, ep)
			}
		}
	}

	return result, nil
}
```

#### Frontend Implementation

**Create `frontend/src/k8s/resources/services/ServiceEndpointsTab.jsx`:**

```jsx
import { useState, useEffect } from 'react';
import { GetServiceEndpoints } from '../../../../wailsjs/go/main/App';
import './ServiceEndpointsTab.css';

export default function ServiceEndpointsTab({ namespace, name }) {
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEndpoints = async () => {
    if (!name || !namespace) return;
    setLoading(true);
    setError(null);
    try {
      const res = await GetServiceEndpoints(namespace, name);
      setEndpoints(res || []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEndpoints();
  }, [namespace, name]);

  if (loading) {
    return <div className="endpoints-loading">Loading endpoints...</div>;
  }

  if (error) {
    return <div className="endpoints-error">Error: {error}</div>;
  }

  if (endpoints.length === 0) {
    return (
      <div className="endpoints-empty">
        <p>No endpoints found for this service.</p>
        <p className="hint">This may indicate no pods match the service selector, or pods are not ready.</p>
      </div>
    );
  }

  return (
    <div className="service-endpoints-tab">
      <div className="endpoints-header">
        <span className="endpoints-count">{endpoints.length} endpoint(s)</span>
        <button onClick={fetchEndpoints} className="refresh-btn">Refresh</button>
      </div>
      <table className="endpoints-table">
        <thead>
          <tr>
            <th>Pod</th>
            <th>IP</th>
            <th>Port</th>
            <th>Protocol</th>
            <th>Node</th>
            <th>Ready</th>
          </tr>
        </thead>
        <tbody>
          {endpoints.map((ep, idx) => (
            <tr key={idx} className={ep.ready ? '' : 'not-ready'}>
              <td>{ep.podName || '-'}</td>
              <td><code>{ep.ip}</code></td>
              <td>{ep.port}</td>
              <td>{ep.protocol}</td>
              <td>{ep.nodeName || '-'}</td>
              <td>
                <span className={`status-badge ${ep.ready ? 'ready' : 'not-ready'}`}>
                  {ep.ready ? 'Ready' : 'Not Ready'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Update `frontend/src/k8s/resources/services/ServicesOverviewTable.jsx`:**

```jsx
// Add import
import ServiceEndpointsTab from './ServiceEndpointsTab';

// Add to bottomTabs array
const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'endpoints', label: 'Endpoints' },  // New tab
  { key: 'events', label: 'Events' },
  { key: 'yaml', label: 'YAML' },
];

// Add case in renderPanelContent
if (tab === 'endpoints') {
  return <ServiceEndpointsTab namespace={row.namespace} name={row.name} />;
}
```

#### Verification
- [ ] Unit test `GetServiceEndpoints` with mock Endpoints object
- [ ] E2E test: Create Service with pods, verify endpoints display
- [ ] E2E test: Verify Ready/Not Ready status shows correctly
- [ ] Manual: Compare with `kubectl get endpoints <name>`

---

### 2.3 Standardize Tab Ordering

Establish consistent tab order across all resource types:

1. Summary (always first)
2. Resource-specific tabs (Pods, Data, Rules, Endpoints, etc.)
3. Logs (if applicable)
4. Events
5. YAML
6. Holmes (always last, if present)

**Files to update with new tab order:**

| File | Current Order | New Order |
|------|---------------|-----------|
| `JobsOverviewTable.jsx` | summary, pods, logs, events, yaml | summary, pods, logs, events, yaml, holmes |
| `CronJobsOverviewTable.jsx` | summary, jobs, events, yaml | summary, jobs, events, yaml, holmes |
| `ServicesOverviewTable.jsx` | summary, events, yaml | summary, endpoints, events, yaml, holmes |
| `IngressesOverviewTable.jsx` | summary, events, yaml | summary, rules, events, yaml, holmes |
| `ConfigMapsOverviewTable.jsx` | summary, data, events, yaml | summary, data, events, yaml, holmes |
| `SecretsOverviewTable.jsx` | summary, data, events, yaml | summary, data, events, yaml, holmes |
| `PersistentVolumesOverviewTable.jsx` | summary, events, yaml | summary, claims, events, yaml, holmes |
| `PersistentVolumeClaimsOverviewTable.jsx` | summary, events, yaml | summary, pods, events, yaml, holmes |

---

### 2.4 Add Swarm YAML/Inspect View

Verify Inspect tab integration is complete for all Swarm resources using existing `pkg/app/docker/inspect_json.go`.

**Check each Swarm resource file for Inspect tab:**

| Resource | File | Has Inspect Tab? |
|----------|------|------------------|
| Services | `frontend/src/docker/resources/services/` | Check |
| Tasks | `frontend/src/docker/resources/tasks/` | Check |
| Nodes | `frontend/src/docker/resources/nodes/` | Check |
| Networks | `frontend/src/docker/resources/networks/` | Check |
| Configs | `frontend/src/docker/resources/configs/` | Check |
| Secrets | `frontend/src/docker/resources/secrets/` | Check |
| Stacks | `frontend/src/docker/resources/stacks/` | Check |
| Volumes | `frontend/src/docker/resources/volumes/` | Check |

**If missing, add Inspect tab following this pattern:**

```jsx
// In bottomTabs
{ key: 'inspect', label: 'Inspect' },

// In renderPanelContent
if (tab === 'inspect') {
  return <InspectJsonTab resourceType="service" id={row.id} />;
}
```

---

## Phase 3: Polish (P2)

### 3.1 Remove console.log from Production Code

#### Create Logger Utility

**Create `frontend/src/utils/logger.js`:**

```javascript
const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args) => {
    if (isDev) {
      console.log(...args);
    }
  },

  error: (...args) => {
    if (isDev) {
      console.error(...args);
    }
  },

  warn: (...args) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  debug: (...args) => {
    if (isDev) {
      console.debug(...args);
    }
  },

  info: (...args) => {
    if (isDev) {
      console.info(...args);
    }
  },

  // For errors that should always be logged (even in production)
  // but could be sent to an error tracking service
  critical: (...args) => {
    console.error(...args);
    // Future: send to error tracking service
  },
};

export default logger;
```

#### Replace Console Statements

**High-priority files to update:**

| File | Instances | Action |
|------|-----------|--------|
| `frontend/src/docker/SwarmStateContext.jsx` | 8 | Replace with logger |
| `frontend/src/holmes/HolmesContext.jsx` | 2 | Replace with logger |
| `frontend/src/k8s/resources/*/*.jsx` | 20+ | Replace with logger |
| `frontend/src/layout/*.jsx` | 5+ | Replace with logger |

**Search and replace pattern:**

```bash
# Find all console statements
grep -r "console\." frontend/src --include="*.jsx" --include="*.js"
```

**Replace pattern:**
```javascript
// Before
console.log('Loading resources:', data);
console.error('Failed to fetch:', err);

// After
import logger from '../utils/logger';
// or
import { logger } from '../utils/logger';

logger.log('Loading resources:', data);
logger.error('Failed to fetch:', err);
```

#### Add ESLint Rule

**Update `frontend/.eslintrc.js` or `frontend/eslint.config.js`:**

```javascript
rules: {
  // Warn on console statements (error in CI)
  'no-console': process.env.CI ? 'error' : 'warn',
}
```

#### Verification
- [ ] Run `npm run build` in production mode
- [ ] Verify no console output in browser dev tools
- [ ] Run ESLint, verify no console warnings

---

### 3.2 Replace Generic "Unknown error" Fallbacks

**Files to update with context-specific messages:**

| File | Line | Current | Replacement |
|------|------|---------|-------------|
| `HolmesContext.jsx` | 341 | `Unknown error` | `Failed to analyze resource. Check Holmes configuration.` |
| `HolmesContext.jsx` | 393 | `Unknown error` | `Holmes analysis failed. Verify API endpoint is reachable.` |
| `ConnectionsSidebar.jsx` | 130 | `Unknown error` | `Connection failed. Check cluster accessibility.` |
| `SwarmStateContext.jsx` | 268 | `Unknown error` | `Docker connection failed. Is Docker daemon running?` |
| `RegistryBrowser.jsx` | 277 | `Unknown error` | `Registry connection failed. Check credentials and URL.` |

**Pattern for improved error messages:**

```javascript
// Before
showError(`Failed: ${err?.message || 'Unknown error'}`);

// After - provide context and possible resolution
const getErrorMessage = (err, context) => {
  if (err?.message) return err.message;

  switch (context) {
    case 'docker_connect':
      return 'Connection refused. Check if Docker daemon is running.';
    case 'k8s_connect':
      return 'Cluster unreachable. Verify kubeconfig and network.';
    case 'registry_auth':
      return 'Authentication failed. Check username and password.';
    case 'holmes_analyze':
      return 'Analysis failed. Verify Holmes endpoint configuration.';
    default:
      return 'An unexpected error occurred.';
  }
};

showError(`Failed: ${getErrorMessage(err, 'docker_connect')}`);
```

---

### 3.3 Improve Empty State Messages

#### Create Shared Empty State Component

**Create `frontend/src/components/EmptyState.jsx`:**

```jsx
import './EmptyState.css';

const EMPTY_STATE_ICONS = {
  files: '📁',
  pods: '🔲',
  data: '📄',
  network: '🌐',
  default: '📭',
};

export function EmptyState({
  icon,
  title,
  message,
  hint,
  action,
  actionLabel,
}) {
  const displayIcon = icon || EMPTY_STATE_ICONS.default;

  return (
    <div className="empty-state">
      <div className="empty-state-icon">{displayIcon}</div>
      {title && <div className="empty-state-title">{title}</div>}
      <div className="empty-state-message">{message}</div>
      {hint && <div className="empty-state-hint">{hint}</div>}
      {action && actionLabel && (
        <button className="empty-state-action" onClick={action}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
```

**Create `frontend/src/components/EmptyState.css`:**

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
  color: var(--text-secondary);
}

.empty-state-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-state-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.empty-state-message {
  font-size: 14px;
  margin-bottom: 8px;
}

.empty-state-hint {
  font-size: 12px;
  opacity: 0.7;
  max-width: 300px;
}

.empty-state-action {
  margin-top: 16px;
  padding: 8px 16px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
```

#### Update Files with Generic Empty States

| File | Current | Replacement |
|------|---------|-------------|
| `PodFilesTab.jsx:610` | `No data.` | `<EmptyState icon="📁" message="No files found" hint="This directory may be empty or inaccessible" />` |
| `PodSummaryTab.jsx:219` | `No data.` | `<EmptyState message="No summary data available" hint="Pod may still be initializing" />` |
| `PodMountsTab.jsx:245` | `No data.` | `<EmptyState icon="💾" message="No volume mounts" hint="This pod has no mounted volumes" />` |

---

### 3.4 Make Polling Intervals Configurable

#### Create Settings Context

**Create `frontend/src/state/SettingsContext.jsx`:**

```jsx
import { createContext, useContext, useState, useEffect } from 'react';

const defaultSettings = {
  // Polling intervals (ms)
  fastPollingInterval: 1000,      // For rapidly changing resources
  normalPollingInterval: 5000,    // Default refresh rate
  slowPollingInterval: 60000,     // For stable resources

  // UI preferences
  defaultBottomPanelHeight: 300,
  showTimestampsRelative: true,
};

const STORAGE_KEY = 'kubedevbench_settings';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}
```

#### Update Components to Use Settings

**Example update for `ConfigMapsOverviewTable.jsx`:**

```jsx
// Before
const REFRESH_INTERVAL = 1000;
const SLOW_REFRESH_INTERVAL = 60000;

// After
import { useSettings } from '../../../state/SettingsContext';

function ConfigMapsOverviewTable() {
  const { settings } = useSettings();

  useEffect(() => {
    const interval = isEditing
      ? settings.slowPollingInterval
      : settings.fastPollingInterval;
    // ...
  }, [settings.fastPollingInterval, settings.slowPollingInterval, isEditing]);
}
```

---

### 3.5 Consistent Status Colors

#### Create StatusBadge Component

**Create `frontend/src/components/StatusBadge.jsx`:**

```jsx
import './StatusBadge.css';

const STATUS_COLORS = {
  // Success states
  running: '#28a745',
  ready: '#28a745',
  active: '#28a745',
  bound: '#28a745',
  complete: '#28a745',
  succeeded: '#28a745',
  healthy: '#28a745',

  // Warning states
  pending: '#ffc107',
  waiting: '#ffc107',
  creating: '#ffc107',
  terminating: '#ffc107',

  // Error states
  failed: '#dc3545',
  error: '#dc3545',
  crashloopbackoff: '#dc3545',
  imagepullbackoff: '#dc3545',

  // Unknown/neutral states
  unknown: '#6c757d',
};

export function StatusBadge({ status, size = 'medium' }) {
  const normalizedStatus = status?.toLowerCase()?.replace(/\s+/g, '') || 'unknown';
  const color = STATUS_COLORS[normalizedStatus] || STATUS_COLORS.unknown;

  const dotSize = size === 'small' ? 6 : size === 'large' ? 10 : 8;

  return (
    <span className={`status-badge status-badge-${size}`}>
      <span
        className="status-dot"
        style={{
          width: dotSize,
          height: dotSize,
          backgroundColor: color
        }}
      />
      <span className="status-text">{status}</span>
    </span>
  );
}
```

**Create `frontend/src/components/StatusBadge.css`:**

```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  border-radius: 50%;
  flex-shrink: 0;
}

.status-text {
  text-transform: capitalize;
}

.status-badge-small {
  font-size: 12px;
  gap: 4px;
}

.status-badge-large {
  font-size: 16px;
  gap: 8px;
}
```

#### Update Status Displays

Replace inline status rendering with `<StatusBadge>` component across:
- Pod status columns
- Deployment status
- Service status
- Job completion status
- Node status (Swarm)
- Task status (Swarm)

---

## Phase 4: Enhancements (P3)

### 4.1 Add Swarm Events/Audit Log

**Backend:** `pkg/app/docker/events.go`

```go
func (c *DockerClient) SubscribeEvents(ctx context.Context) (<-chan events.Message, <-chan error) {
	return c.client.Events(ctx, types.EventsOptions{})
}

func (c *DockerClient) GetRecentEvents(since time.Time) ([]events.Message, error) {
	ctx := context.Background()
	eventsChan, errChan := c.client.Events(ctx, types.EventsOptions{
		Since: since.Format(time.RFC3339),
	})

	var result []events.Message
	timeout := time.After(5 * time.Second)

	for {
		select {
		case event := <-eventsChan:
			result = append(result, event)
		case err := <-errChan:
			return result, err
		case <-timeout:
			return result, nil
		}
	}
}
```

**Frontend:** Create `SwarmEventsTab.jsx` component

### 4.2 Add Init Container Display to Pods

Extend Pod summary tab to show init containers. The backend already partially supports this in `pod_details.go:186-196`.

**Update `PodSummaryTab.jsx`:**

```jsx
// Add section for init containers
{pod.initContainers && pod.initContainers.length > 0 && (
  <div className="init-containers-section">
    <h4>Init Containers</h4>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Image</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {pod.initContainers.map(ic => (
          <tr key={ic.name}>
            <td>{ic.name}</td>
            <td>{ic.image}</td>
            <td><StatusBadge status={ic.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
```

---

## Implementation Checklist

### Phase 1 (P0) - Critical
- [ ] 1.1 Backend: Create `pkg/app/resource_yaml.go` with all YAML functions
- [ ] 1.1 Backend: Unit tests for YAML functions
- [ ] 1.1 Frontend: Create YAML tab components for each resource
- [ ] 1.1 Frontend: Update overview tables to use dynamic YAML
- [ ] 1.2 Fix Ingress protocol detection
- [ ] 1.3 Remove ECR placeholder from registry modal
- [ ] 1.4 Fix ConfigMap template data

### Phase 2 (P1) - Consistency
- [ ] 2.1 Backend: Add Holmes streaming functions for 7 resource types
- [ ] 2.1 Backend: Add context gathering functions
- [ ] 2.1 Frontend: Add holmesApi exports
- [ ] 2.1 Frontend: Update 7 overview tables with Holmes integration
- [ ] 2.2 Backend: Add `GetServiceEndpoints` function
- [ ] 2.2 Frontend: Create `ServiceEndpointsTab` component
- [ ] 2.3 Standardize tab ordering across all resources
- [ ] 2.4 Verify Swarm Inspect tabs

### Phase 3 (P2) - Polish
- [ ] 3.1 Create `logger.js` utility
- [ ] 3.1 Replace 60+ console statements
- [ ] 3.1 Add ESLint rule
- [ ] 3.2 Update 17+ error message fallbacks
- [ ] 3.3 Create `EmptyState` component
- [ ] 3.3 Update empty state displays
- [ ] 3.4 Create `SettingsContext`
- [ ] 3.4 Update polling interval usage
- [ ] 3.5 Create `StatusBadge` component
- [ ] 3.5 Update status displays

### Phase 4 (P3) - Enhancements
- [ ] 4.1 Backend: Swarm events subscription
- [ ] 4.1 Frontend: SwarmEventsTab component
- [ ] 4.2 Frontend: Init container display in PodSummaryTab

---

## Testing Requirements

### Unit Tests (70%+ coverage)
- All new Go functions in `resource_yaml.go`
- All new Go functions in `holmes_integration.go`
- All new Go functions in `services.go` (endpoints)
- Frontend `logger.js`
- Frontend `StatusBadge` component
- Frontend `EmptyState` component

### E2E Tests
- YAML tab shows actual resource data (not templates)
- Holmes analysis works on all resource types
- Service endpoints tab displays correctly
- Ingress protocol detection (HTTP vs HTTPS)
- Empty states display appropriately

### Manual Verification
- Production build has no console output
- Error messages provide actionable guidance
- Status colors are consistent across views
