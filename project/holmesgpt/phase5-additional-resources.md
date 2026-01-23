# Phase 5: Holmes Analysis for Additional Kubernetes Resources

**Status**: Planned
**Duration**: 2-3 Sprints (4-6 weeks)
**Prerequisites**: Phases 1-4 complete
**Goal**: Extend Holmes analysis to CronJob, Job, Ingress, PVC, Node, and HPA resources

---

## Overview

### Current Holmes Integration
Resources WITH Holmes analysis:
- Kubernetes: Pod, Deployment, StatefulSet, DaemonSet, Service
- Docker Swarm: Service, Task
- Pod Logs analysis

### Phase 5 Scope
Add Holmes analysis to:

| Priority | Resource | Frontend Exists | Complexity |
|----------|----------|-----------------|------------|
| High | CronJob | ✅ Yes | Medium |
| High | Job | ✅ Yes | Medium |
| High | Ingress | ✅ Yes | Medium |
| High | PersistentVolumeClaim | ✅ Yes | Medium |
| Medium | Node | ❌ No | High |
| Medium | HorizontalPodAutoscaler | ❌ No | High |

### Success Criteria
- [ ] All 6 resource types have "Ask Holmes" functionality
- [ ] Context gathering captures relevant troubleshooting data
- [ ] Streaming responses work correctly
- [ ] Holmes tab appears in bottom panels
- [ ] Unit tests with >= 70% coverage
- [ ] E2E tests for each resource type

---

## Implementation Order

```
1. CronJob  ─────► Simple, high user value for batch job debugging
2. Job      ─────► Builds on CronJob patterns
3. Ingress  ─────► Self-contained, routing/TLS troubleshooting
4. PVC      ─────► Storage issues are common pain points
5. Node     ─────► Requires full frontend implementation
6. HPA      ─────► Most complex, autoscaling API
```

---

## High Priority Resources (Existing Frontend)

### 1. CronJob Integration

**Use Cases:**
- Failed scheduled jobs
- Missed job runs
- Stuck or suspended CronJobs
- Concurrency policy issues
- Schedule syntax problems

**Context to Gather:**
```
- CronJob spec: schedule, suspend, concurrencyPolicy, successfulJobsHistoryLimit
- Last schedule time, next scheduled run
- Active jobs count
- Recent job history (last 5 jobs with statuses)
- Failed job reasons
- Events (FailedCreate, SuccessfulCreate, SawCompletedJob)
- Logs from most recent job's pod
```

**Files to Modify:**

| File | Changes |
|------|---------|
| `pkg/app/holmes_context.go` | Add `getCronJobContext()` |
| `pkg/app/holmes_integration.go` | Add `AnalyzeCronJob()`, `AnalyzeCronJobStream()`, update routers |
| `frontend/src/holmes/holmesApi.js` | Export `AnalyzeCronJobStream` |
| `frontend/src/k8s/resources/cronjobs/CronJobsOverviewTable.jsx` | Add Holmes integration |

**Backend Implementation:**

```go
// pkg/app/holmes_context.go
func (a *App) getCronJobContext(namespace, name string) (string, error) {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return "", err
    }

    ctx := a.ctx
    if ctx == nil {
        ctx = context.Background()
    }

    var sb strings.Builder

    // 1. Fetch CronJob details
    a.emitHolmesContextProgress("CronJob", namespace, name, "Fetching cronjob details", "running", "")
    cronJobCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
    defer cancel()
    cronJob, err := clientset.BatchV1().CronJobs(namespace).Get(cronJobCtx, name, metav1.GetOptions{})
    if err != nil {
        return "", fmt.Errorf("failed to get cronjob: %w", err)
    }
    a.emitHolmesContextProgress("CronJob", namespace, name, "Fetching cronjob details", "done", "")

    // Basic info
    sb.WriteString(fmt.Sprintf("CronJob: %s/%s\n", namespace, name))
    sb.WriteString(fmt.Sprintf("Schedule: %s\n", cronJob.Spec.Schedule))
    sb.WriteString(fmt.Sprintf("Suspend: %v\n", cronJob.Spec.Suspend != nil && *cronJob.Spec.Suspend))
    sb.WriteString(fmt.Sprintf("Concurrency Policy: %s\n", cronJob.Spec.ConcurrencyPolicy))

    if cronJob.Status.LastScheduleTime != nil {
        sb.WriteString(fmt.Sprintf("Last Schedule Time: %s\n", cronJob.Status.LastScheduleTime.Format(time.RFC3339)))
    }
    if cronJob.Status.LastSuccessfulTime != nil {
        sb.WriteString(fmt.Sprintf("Last Successful Time: %s\n", cronJob.Status.LastSuccessfulTime.Format(time.RFC3339)))
    }
    sb.WriteString(fmt.Sprintf("Active Jobs: %d\n", len(cronJob.Status.Active)))

    // 2. List recent jobs
    a.emitHolmesContextProgress("CronJob", namespace, name, "Listing recent jobs", "running", "")
    jobsCtx, jobsCancel := context.WithTimeout(ctx, 8*time.Second)
    jobs, err := clientset.BatchV1().Jobs(namespace).List(jobsCtx, metav1.ListOptions{
        LabelSelector: fmt.Sprintf("job-name=%s", name),
    })
    jobsCancel()
    if err == nil && len(jobs.Items) > 0 {
        sb.WriteString("\nRecent Jobs (last 5):\n")
        count := 0
        for i := len(jobs.Items) - 1; i >= 0 && count < 5; i-- {
            job := jobs.Items[i]
            status := "Unknown"
            if job.Status.Succeeded > 0 {
                status = "Succeeded"
            } else if job.Status.Failed > 0 {
                status = "Failed"
            } else if job.Status.Active > 0 {
                status = "Active"
            }
            sb.WriteString(fmt.Sprintf("  %s: %s (completions: %d/%d)\n",
                job.Name, status, job.Status.Succeeded, *job.Spec.Completions))
            count++
        }
    }
    a.emitHolmesContextProgress("CronJob", namespace, name, "Listing recent jobs", "done", "")

    // 3. Collect events
    a.emitHolmesContextProgress("CronJob", namespace, name, "Collecting recent events", "running", "")
    eventsCtx, eventsCancel := context.WithTimeout(ctx, 8*time.Second)
    appendRecentEvents(eventsCtx, &sb, clientset.CoreV1().Events(namespace), name, "CronJob")
    eventsCancel()
    a.emitHolmesContextProgress("CronJob", namespace, name, "Collecting recent events", "done", "")

    // 4. Get logs from most recent job's pod
    if len(jobs.Items) > 0 {
        a.emitHolmesContextProgress("CronJob", namespace, name, "Collecting recent logs", "running", "")
        mostRecentJob := jobs.Items[len(jobs.Items)-1]
        logs := a.getJobLogs(namespace, mostRecentJob.Name, 50)
        if logs != "" {
            sb.WriteString("\nRecent Logs (from latest job):\n")
            sb.WriteString(logs)
        }
        a.emitHolmesContextProgress("CronJob", namespace, name, "Collecting recent logs", "done", "")
    }

    return sb.String(), nil
}
```

**Question Prompt:**
```
Analyze this Kubernetes CronJob and explain any issues:

CronJob: {namespace}/{name}

{context}

What problems do you see? Is the schedule working correctly? Are jobs completing successfully?
```

---

### 2. Job Integration

**Use Cases:**
- Failed job completions
- Backoff limit exceeded
- Parallelism configuration issues
- Pod failures within jobs
- Stuck jobs

**Context to Gather:**
```
- Job spec: completions, parallelism, backoffLimit, activeDeadlineSeconds
- Job status: succeeded, failed, active counts, startTime, completionTime
- Conditions (Complete, Failed, Suspended)
- Pod list with individual statuses
- Events (SuccessfulCreate, BackoffLimitExceeded)
- Aggregated logs from job pods
```

**Files to Modify:**

| File | Changes |
|------|---------|
| `pkg/app/holmes_context.go` | Add `getJobContext()`, `getJobLogs()` helper |
| `pkg/app/holmes_integration.go` | Add `AnalyzeJob()`, `AnalyzeJobStream()`, update routers |
| `frontend/src/holmes/holmesApi.js` | Export `AnalyzeJobStream` |
| `frontend/src/k8s/resources/jobs/JobsOverviewTable.jsx` | Add Holmes integration |

**Backend Implementation:**

```go
// pkg/app/holmes_context.go
func (a *App) getJobContext(namespace, name string) (string, error) {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return "", err
    }

    ctx := a.ctx
    if ctx == nil {
        ctx = context.Background()
    }

    var sb strings.Builder

    // 1. Fetch Job details
    a.emitHolmesContextProgress("Job", namespace, name, "Fetching job details", "running", "")
    jobCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
    defer cancel()
    job, err := clientset.BatchV1().Jobs(namespace).Get(jobCtx, name, metav1.GetOptions{})
    if err != nil {
        return "", fmt.Errorf("failed to get job: %w", err)
    }
    a.emitHolmesContextProgress("Job", namespace, name, "Fetching job details", "done", "")

    // Basic info
    sb.WriteString(fmt.Sprintf("Job: %s/%s\n", namespace, name))
    completions := int32(1)
    if job.Spec.Completions != nil {
        completions = *job.Spec.Completions
    }
    parallelism := int32(1)
    if job.Spec.Parallelism != nil {
        parallelism = *job.Spec.Parallelism
    }
    sb.WriteString(fmt.Sprintf("Completions: %d (target: %d)\n", job.Status.Succeeded, completions))
    sb.WriteString(fmt.Sprintf("Parallelism: %d\n", parallelism))
    sb.WriteString(fmt.Sprintf("Active: %d, Succeeded: %d, Failed: %d\n",
        job.Status.Active, job.Status.Succeeded, job.Status.Failed))
    if job.Spec.BackoffLimit != nil {
        sb.WriteString(fmt.Sprintf("Backoff Limit: %d\n", *job.Spec.BackoffLimit))
    }

    // Conditions
    if len(job.Status.Conditions) > 0 {
        sb.WriteString("\nConditions:\n")
        for _, cond := range job.Status.Conditions {
            sb.WriteString(fmt.Sprintf("  %s: %s\n", cond.Type, cond.Status))
            if cond.Message != "" {
                sb.WriteString(fmt.Sprintf("    Message: %s\n", cond.Message))
            }
        }
    }

    // 2. List pods
    a.emitHolmesContextProgress("Job", namespace, name, "Listing related pods", "running", "")
    podsCtx, podsCancel := context.WithTimeout(ctx, 8*time.Second)
    pods, err := clientset.CoreV1().Pods(namespace).List(podsCtx, metav1.ListOptions{
        LabelSelector: fmt.Sprintf("job-name=%s", name),
    })
    podsCancel()
    if err == nil {
        sb.WriteString(fmt.Sprintf("\nPods (%d):\n", len(pods.Items)))
        for _, pod := range pods.Items {
            sb.WriteString(fmt.Sprintf("  %s: %s\n", pod.Name, pod.Status.Phase))
            // Show container exit codes for failed pods
            if pod.Status.Phase == corev1.PodFailed {
                for _, cs := range pod.Status.ContainerStatuses {
                    if cs.State.Terminated != nil && cs.State.Terminated.ExitCode != 0 {
                        sb.WriteString(fmt.Sprintf("    Container %s: exit code %d - %s\n",
                            cs.Name, cs.State.Terminated.ExitCode, cs.State.Terminated.Reason))
                    }
                }
            }
        }
    }
    a.emitHolmesContextProgress("Job", namespace, name, "Listing related pods", "done", "")

    // 3. Events
    a.emitHolmesContextProgress("Job", namespace, name, "Collecting recent events", "running", "")
    eventsCtx, eventsCancel := context.WithTimeout(ctx, 8*time.Second)
    appendRecentEvents(eventsCtx, &sb, clientset.CoreV1().Events(namespace), name, "Job")
    eventsCancel()
    a.emitHolmesContextProgress("Job", namespace, name, "Collecting recent events", "done", "")

    // 4. Logs from failed/recent pods
    a.emitHolmesContextProgress("Job", namespace, name, "Collecting recent logs", "running", "")
    logs := a.getJobLogs(namespace, name, 50)
    if logs != "" {
        sb.WriteString("\nRecent Logs:\n")
        sb.WriteString(logs)
    }
    a.emitHolmesContextProgress("Job", namespace, name, "Collecting recent logs", "done", "")

    return sb.String(), nil
}

// Helper to get logs from job pods
func (a *App) getJobLogs(namespace, jobName string, lines int) string {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return ""
    }

    pods, err := clientset.CoreV1().Pods(namespace).List(context.Background(), metav1.ListOptions{
        LabelSelector: fmt.Sprintf("job-name=%s", jobName),
    })
    if err != nil || len(pods.Items) == 0 {
        return ""
    }

    // Get logs from the most recent pod
    var mostRecent *corev1.Pod
    for i := range pods.Items {
        if mostRecent == nil || pods.Items[i].CreationTimestamp.After(mostRecent.CreationTimestamp.Time) {
            mostRecent = &pods.Items[i]
        }
    }

    if mostRecent != nil {
        return a.getRecentPodLogs(namespace, mostRecent.Name, lines)
    }
    return ""
}
```

---

### 3. Ingress Integration

**Use Cases:**
- Routing not working (503 errors)
- TLS certificate issues
- Backend service connectivity
- Missing or incorrect annotations
- Ingress class configuration

**Context to Gather:**
```
- Ingress spec: ingressClassName, defaultBackend
- Rules: hosts, paths, backend services
- TLS configuration (hosts, secret names)
- Load balancer status (IP/hostname)
- Backend service health (do services exist? have endpoints?)
- Annotations (controller-specific config)
- Events (Sync, AddedOrUpdated)
```

**Files to Modify:**

| File | Changes |
|------|---------|
| `pkg/app/holmes_context.go` | Add `getIngressContext()` |
| `pkg/app/holmes_integration.go` | Add `AnalyzeIngress()`, `AnalyzeIngressStream()`, update routers |
| `frontend/src/holmes/holmesApi.js` | Export `AnalyzeIngressStream` |
| `frontend/src/k8s/resources/ingresses/IngressesOverviewTable.jsx` | Add Holmes integration |

**Backend Implementation:**

```go
// pkg/app/holmes_context.go
func (a *App) getIngressContext(namespace, name string) (string, error) {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return "", err
    }

    ctx := a.ctx
    if ctx == nil {
        ctx = context.Background()
    }

    var sb strings.Builder

    // 1. Fetch Ingress details
    a.emitHolmesContextProgress("Ingress", namespace, name, "Fetching ingress details", "running", "")
    ingressCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
    defer cancel()
    ingress, err := clientset.NetworkingV1().Ingresses(namespace).Get(ingressCtx, name, metav1.GetOptions{})
    if err != nil {
        return "", fmt.Errorf("failed to get ingress: %w", err)
    }
    a.emitHolmesContextProgress("Ingress", namespace, name, "Fetching ingress details", "done", "")

    // Basic info
    sb.WriteString(fmt.Sprintf("Ingress: %s/%s\n", namespace, name))
    if ingress.Spec.IngressClassName != nil {
        sb.WriteString(fmt.Sprintf("Ingress Class: %s\n", *ingress.Spec.IngressClassName))
    }

    // Load balancer status
    if len(ingress.Status.LoadBalancer.Ingress) > 0 {
        sb.WriteString("Load Balancer:\n")
        for _, lb := range ingress.Status.LoadBalancer.Ingress {
            if lb.IP != "" {
                sb.WriteString(fmt.Sprintf("  IP: %s\n", lb.IP))
            }
            if lb.Hostname != "" {
                sb.WriteString(fmt.Sprintf("  Hostname: %s\n", lb.Hostname))
            }
        }
    } else {
        sb.WriteString("Load Balancer: NOT ASSIGNED\n")
    }

    // Rules
    if len(ingress.Spec.Rules) > 0 {
        sb.WriteString("\nRules:\n")
        for _, rule := range ingress.Spec.Rules {
            host := rule.Host
            if host == "" {
                host = "*"
            }
            sb.WriteString(fmt.Sprintf("  Host: %s\n", host))
            if rule.HTTP != nil {
                for _, path := range rule.HTTP.Paths {
                    pathType := "Prefix"
                    if path.PathType != nil {
                        pathType = string(*path.PathType)
                    }
                    sb.WriteString(fmt.Sprintf("    %s (%s) -> %s:%d\n",
                        path.Path, pathType,
                        path.Backend.Service.Name,
                        path.Backend.Service.Port.Number))
                }
            }
        }
    }

    // TLS
    if len(ingress.Spec.TLS) > 0 {
        sb.WriteString("\nTLS Configuration:\n")
        for _, tls := range ingress.Spec.TLS {
            sb.WriteString(fmt.Sprintf("  Secret: %s\n", tls.SecretName))
            sb.WriteString(fmt.Sprintf("  Hosts: %v\n", tls.Hosts))
        }
    }

    // Important annotations
    if len(ingress.Annotations) > 0 {
        sb.WriteString("\nAnnotations:\n")
        for k, v := range ingress.Annotations {
            sb.WriteString(fmt.Sprintf("  %s: %s\n", k, v))
        }
    }

    // 2. Check backend services
    a.emitHolmesContextProgress("Ingress", namespace, name, "Checking backend services", "running", "")
    sb.WriteString("\nBackend Service Status:\n")
    for _, rule := range ingress.Spec.Rules {
        if rule.HTTP != nil {
            for _, path := range rule.HTTP.Paths {
                svcName := path.Backend.Service.Name
                svc, err := clientset.CoreV1().Services(namespace).Get(ctx, svcName, metav1.GetOptions{})
                if err != nil {
                    sb.WriteString(fmt.Sprintf("  %s: NOT FOUND\n", svcName))
                } else {
                    endpoints, err := clientset.CoreV1().Endpoints(namespace).Get(ctx, svcName, metav1.GetOptions{})
                    endpointCount := 0
                    if err == nil {
                        for _, subset := range endpoints.Subsets {
                            endpointCount += len(subset.Addresses)
                        }
                    }
                    sb.WriteString(fmt.Sprintf("  %s: %s, %d endpoints\n", svcName, svc.Spec.Type, endpointCount))
                }
            }
        }
    }
    a.emitHolmesContextProgress("Ingress", namespace, name, "Checking backend services", "done", "")

    // 3. Events
    a.emitHolmesContextProgress("Ingress", namespace, name, "Collecting recent events", "running", "")
    eventsCtx, eventsCancel := context.WithTimeout(ctx, 8*time.Second)
    appendRecentEvents(eventsCtx, &sb, clientset.CoreV1().Events(namespace), name, "Ingress")
    eventsCancel()
    a.emitHolmesContextProgress("Ingress", namespace, name, "Collecting recent events", "done", "")

    return sb.String(), nil
}
```

---

### 4. PersistentVolumeClaim Integration

**Use Cases:**
- PVC stuck in Pending state
- Storage class issues
- Capacity problems
- Access mode mismatches
- Volume not mounting to pods

**Context to Gather:**
```
- PVC spec: storageClassName, accessModes, resources.requests
- PVC status: phase, capacity, accessModes
- Bound PV details (reclaim policy, storage class, capacity)
- Pods consuming this PVC
- StorageClass configuration
- Events (ProvisioningSucceeded, ProvisioningFailed, WaitForFirstConsumer)
```

**Files to Modify:**

| File | Changes |
|------|---------|
| `pkg/app/holmes_context.go` | Add `getPersistentVolumeClaimContext()` |
| `pkg/app/holmes_integration.go` | Add `AnalyzePVC()`, `AnalyzePVCStream()`, update routers |
| `frontend/src/holmes/holmesApi.js` | Export `AnalyzePVCStream` |
| `frontend/src/k8s/resources/persistentvolumeclaims/PersistentVolumeClaimsOverviewTable.jsx` | Add Holmes integration |

**Backend Implementation:**

```go
// pkg/app/holmes_context.go
func (a *App) getPersistentVolumeClaimContext(namespace, name string) (string, error) {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return "", err
    }

    ctx := a.ctx
    if ctx == nil {
        ctx = context.Background()
    }

    var sb strings.Builder

    // 1. Fetch PVC details
    a.emitHolmesContextProgress("PersistentVolumeClaim", namespace, name, "Fetching PVC details", "running", "")
    pvcCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
    defer cancel()
    pvc, err := clientset.CoreV1().PersistentVolumeClaims(namespace).Get(pvcCtx, name, metav1.GetOptions{})
    if err != nil {
        return "", fmt.Errorf("failed to get pvc: %w", err)
    }
    a.emitHolmesContextProgress("PersistentVolumeClaim", namespace, name, "Fetching PVC details", "done", "")

    // Basic info
    sb.WriteString(fmt.Sprintf("PersistentVolumeClaim: %s/%s\n", namespace, name))
    sb.WriteString(fmt.Sprintf("Status: %s\n", pvc.Status.Phase))
    if pvc.Spec.StorageClassName != nil {
        sb.WriteString(fmt.Sprintf("Storage Class: %s\n", *pvc.Spec.StorageClassName))
    }
    sb.WriteString(fmt.Sprintf("Access Modes: %v\n", pvc.Spec.AccessModes))
    if storage, ok := pvc.Spec.Resources.Requests[corev1.ResourceStorage]; ok {
        sb.WriteString(fmt.Sprintf("Requested Storage: %s\n", storage.String()))
    }
    if pvc.Status.Capacity != nil {
        if storage, ok := pvc.Status.Capacity[corev1.ResourceStorage]; ok {
            sb.WriteString(fmt.Sprintf("Actual Capacity: %s\n", storage.String()))
        }
    }

    // 2. Bound PV details
    if pvc.Spec.VolumeName != "" {
        a.emitHolmesContextProgress("PersistentVolumeClaim", namespace, name, "Fetching bound PV details", "running", "")
        pvCtx, pvCancel := context.WithTimeout(ctx, 8*time.Second)
        pv, err := clientset.CoreV1().PersistentVolumes().Get(pvCtx, pvc.Spec.VolumeName, metav1.GetOptions{})
        pvCancel()
        if err == nil {
            sb.WriteString(fmt.Sprintf("\nBound PersistentVolume: %s\n", pv.Name))
            sb.WriteString(fmt.Sprintf("  Reclaim Policy: %s\n", pv.Spec.PersistentVolumeReclaimPolicy))
            sb.WriteString(fmt.Sprintf("  Status: %s\n", pv.Status.Phase))
            if pv.Spec.StorageClassName != "" {
                sb.WriteString(fmt.Sprintf("  Storage Class: %s\n", pv.Spec.StorageClassName))
            }
        }
        a.emitHolmesContextProgress("PersistentVolumeClaim", namespace, name, "Fetching bound PV details", "done", "")
    } else {
        sb.WriteString("\nBound PersistentVolume: NONE (PVC not bound)\n")
    }

    // 3. Find consuming pods
    a.emitHolmesContextProgress("PersistentVolumeClaim", namespace, name, "Finding consuming pods", "running", "")
    podsCtx, podsCancel := context.WithTimeout(ctx, 8*time.Second)
    pods, err := clientset.CoreV1().Pods(namespace).List(podsCtx, metav1.ListOptions{})
    podsCancel()
    if err == nil {
        var consumers []string
        for _, pod := range pods.Items {
            for _, vol := range pod.Spec.Volumes {
                if vol.PersistentVolumeClaim != nil && vol.PersistentVolumeClaim.ClaimName == name {
                    consumers = append(consumers, fmt.Sprintf("%s (%s)", pod.Name, pod.Status.Phase))
                    break
                }
            }
        }
        if len(consumers) > 0 {
            sb.WriteString(fmt.Sprintf("\nConsuming Pods (%d):\n", len(consumers)))
            for _, c := range consumers {
                sb.WriteString(fmt.Sprintf("  %s\n", c))
            }
        } else {
            sb.WriteString("\nConsuming Pods: NONE\n")
        }
    }
    a.emitHolmesContextProgress("PersistentVolumeClaim", namespace, name, "Finding consuming pods", "done", "")

    // 4. Events
    a.emitHolmesContextProgress("PersistentVolumeClaim", namespace, name, "Collecting recent events", "running", "")
    eventsCtx, eventsCancel := context.WithTimeout(ctx, 8*time.Second)
    appendRecentEvents(eventsCtx, &sb, clientset.CoreV1().Events(namespace), name, "PersistentVolumeClaim")
    eventsCancel()
    a.emitHolmesContextProgress("PersistentVolumeClaim", namespace, name, "Collecting recent events", "done", "")

    return sb.String(), nil
}
```

---

## Medium Priority Resources (Full Implementation)

### 5. Node Integration

**Requires:** Full backend + frontend implementation

**Use Cases:**
- Node not ready
- Resource pressure (memory, disk, PID)
- Scheduling issues
- Taint/toleration problems
- Node capacity exhaustion

**Context to Gather:**
```
- Node conditions: Ready, MemoryPressure, DiskPressure, PIDPressure, NetworkUnavailable
- Allocatable vs capacity: cpu, memory, pods, ephemeral-storage
- Taints
- Labels (kubernetes.io/os, node.kubernetes.io/instance-type, node-role labels)
- Node info: kubelet version, container runtime, OS
- Pods running on node (count and list of non-Running)
- Events
```

**Files to Create/Modify:**

| File | Changes |
|------|---------|
| `pkg/app/nodes.go` | NEW: `GetNodes()`, `GetNode()` |
| `pkg/app/types.go` | Add `NodeInfo` struct |
| `pkg/app/holmes_context.go` | Add `getNodeContext()` (no namespace) |
| `pkg/app/holmes_integration.go` | Add `AnalyzeNode()`, `AnalyzeNodeStream()`, update routers |
| `frontend/src/holmes/holmesApi.js` | Export `AnalyzeNodeStream` |
| `frontend/src/k8s/resources/nodes/` | NEW directory with full implementation |

**Backend Types:**

```go
// pkg/app/types.go
type NodeInfo struct {
    Name             string            `json:"name"`
    Status           string            `json:"status"`
    Roles            []string          `json:"roles"`
    Age              string            `json:"age"`
    Version          string            `json:"version"`
    InternalIP       string            `json:"internalIP"`
    ExternalIP       string            `json:"externalIP"`
    OSImage          string            `json:"osImage"`
    KernelVersion    string            `json:"kernelVersion"`
    ContainerRuntime string            `json:"containerRuntime"`
    CPUCapacity      string            `json:"cpuCapacity"`
    MemoryCapacity   string            `json:"memoryCapacity"`
    PodCapacity      string            `json:"podCapacity"`
    CPUAllocatable   string            `json:"cpuAllocatable"`
    MemoryAllocatable string           `json:"memoryAllocatable"`
    PodAllocatable   string            `json:"podAllocatable"`
    Conditions       []NodeCondition   `json:"conditions"`
    Taints           []NodeTaint       `json:"taints"`
    Labels           map[string]string `json:"labels"`
}

type NodeCondition struct {
    Type    string `json:"type"`
    Status  string `json:"status"`
    Reason  string `json:"reason"`
    Message string `json:"message"`
}

type NodeTaint struct {
    Key    string `json:"key"`
    Value  string `json:"value"`
    Effect string `json:"effect"`
}
```

**Context Gathering:**

```go
// pkg/app/holmes_context.go
func (a *App) getNodeContext(name string) (string, error) {
    // Note: Nodes are cluster-scoped, no namespace parameter
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return "", err
    }

    ctx := a.ctx
    if ctx == nil {
        ctx = context.Background()
    }

    var sb strings.Builder

    // 1. Fetch Node details
    a.emitHolmesContextProgress("Node", "", name, "Fetching node details", "running", "")
    nodeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
    defer cancel()
    node, err := clientset.CoreV1().Nodes().Get(nodeCtx, name, metav1.GetOptions{})
    if err != nil {
        return "", fmt.Errorf("failed to get node: %w", err)
    }
    a.emitHolmesContextProgress("Node", "", name, "Fetching node details", "done", "")

    // Basic info
    sb.WriteString(fmt.Sprintf("Node: %s\n", name))

    // Roles
    var roles []string
    for label := range node.Labels {
        if strings.HasPrefix(label, "node-role.kubernetes.io/") {
            role := strings.TrimPrefix(label, "node-role.kubernetes.io/")
            roles = append(roles, role)
        }
    }
    if len(roles) > 0 {
        sb.WriteString(fmt.Sprintf("Roles: %s\n", strings.Join(roles, ", ")))
    }

    // Conditions
    sb.WriteString("\nConditions:\n")
    for _, cond := range node.Status.Conditions {
        sb.WriteString(fmt.Sprintf("  %s: %s\n", cond.Type, cond.Status))
        if cond.Message != "" {
            sb.WriteString(fmt.Sprintf("    Message: %s\n", cond.Message))
        }
    }

    // Capacity vs Allocatable
    sb.WriteString("\nResources:\n")
    sb.WriteString(fmt.Sprintf("  CPU: %s allocatable / %s capacity\n",
        node.Status.Allocatable.Cpu().String(),
        node.Status.Capacity.Cpu().String()))
    sb.WriteString(fmt.Sprintf("  Memory: %s allocatable / %s capacity\n",
        node.Status.Allocatable.Memory().String(),
        node.Status.Capacity.Memory().String()))
    sb.WriteString(fmt.Sprintf("  Pods: %s allocatable / %s capacity\n",
        node.Status.Allocatable.Pods().String(),
        node.Status.Capacity.Pods().String()))

    // Taints
    if len(node.Spec.Taints) > 0 {
        sb.WriteString("\nTaints:\n")
        for _, taint := range node.Spec.Taints {
            sb.WriteString(fmt.Sprintf("  %s=%s:%s\n", taint.Key, taint.Value, taint.Effect))
        }
    }

    // Node info
    sb.WriteString("\nSystem Info:\n")
    sb.WriteString(fmt.Sprintf("  Kubelet Version: %s\n", node.Status.NodeInfo.KubeletVersion))
    sb.WriteString(fmt.Sprintf("  Container Runtime: %s\n", node.Status.NodeInfo.ContainerRuntimeVersion))
    sb.WriteString(fmt.Sprintf("  OS: %s\n", node.Status.NodeInfo.OSImage))

    // 2. List pods on this node
    a.emitHolmesContextProgress("Node", "", name, "Listing pods on node", "running", "")
    podsCtx, podsCancel := context.WithTimeout(ctx, 8*time.Second)
    pods, err := clientset.CoreV1().Pods("").List(podsCtx, metav1.ListOptions{
        FieldSelector: fmt.Sprintf("spec.nodeName=%s", name),
    })
    podsCancel()
    if err == nil {
        runningCount := 0
        var nonRunning []string
        for _, pod := range pods.Items {
            if pod.Status.Phase == corev1.PodRunning {
                runningCount++
            } else {
                nonRunning = append(nonRunning, fmt.Sprintf("%s/%s: %s",
                    pod.Namespace, pod.Name, pod.Status.Phase))
            }
        }
        sb.WriteString(fmt.Sprintf("\nPods: %d running, %d other\n", runningCount, len(nonRunning)))
        if len(nonRunning) > 0 && len(nonRunning) <= 10 {
            sb.WriteString("Non-running pods:\n")
            for _, p := range nonRunning {
                sb.WriteString(fmt.Sprintf("  %s\n", p))
            }
        }
    }
    a.emitHolmesContextProgress("Node", "", name, "Listing pods on node", "done", "")

    // 3. Events
    a.emitHolmesContextProgress("Node", "", name, "Collecting recent events", "running", "")
    eventsCtx, eventsCancel := context.WithTimeout(ctx, 8*time.Second)
    // Node events are in default namespace
    appendRecentEvents(eventsCtx, &sb, clientset.CoreV1().Events(""), name, "Node")
    eventsCancel()
    a.emitHolmesContextProgress("Node", "", name, "Collecting recent events", "done", "")

    return sb.String(), nil
}
```

**Frontend Files to Create:**

```
frontend/src/k8s/resources/nodes/
├── NodesOverviewTable.jsx      # Main table with Holmes integration
├── NodeSummaryPanel.jsx        # Summary tab content
├── NodeConditionsTab.jsx       # Conditions tab
├── NodePodsTab.jsx             # Pods running on node
├── NodeResourcesTab.jsx        # Resource usage
└── index.js                    # Exports
```

---

### 6. HorizontalPodAutoscaler Integration

**Requires:** Full backend + frontend implementation

**Use Cases:**
- HPA not scaling
- Metrics unavailable
- Scale target not found
- Thrashing (rapid scale up/down)
- Min/max replica misconfiguration

**Context to Gather:**
```
- HPA spec: minReplicas, maxReplicas, metrics (CPU/memory targets)
- HPA status: currentReplicas, desiredReplicas, currentMetrics
- Conditions: AbleToScale, ScalingActive, ScalingLimited
- Target resource (Deployment/StatefulSet) status
- Recent scaling events
- Metrics server availability
```

**Files to Create/Modify:**

| File | Changes |
|------|---------|
| `pkg/app/hpa.go` | NEW: `GetHPAs()`, `GetHPA()` |
| `pkg/app/types.go` | Add `HPAInfo` struct |
| `pkg/app/holmes_context.go` | Add `getHPAContext()` |
| `pkg/app/holmes_integration.go` | Add `AnalyzeHPA()`, `AnalyzeHPAStream()`, update routers |
| `frontend/src/holmes/holmesApi.js` | Export `AnalyzeHPAStream` |
| `frontend/src/k8s/resources/hpa/` | NEW directory with full implementation |

**Backend Types:**

```go
// pkg/app/types.go
type HPAInfo struct {
    Name            string       `json:"name"`
    Namespace       string       `json:"namespace"`
    ScaleTargetRef  string       `json:"scaleTargetRef"`
    MinReplicas     int32        `json:"minReplicas"`
    MaxReplicas     int32        `json:"maxReplicas"`
    CurrentReplicas int32        `json:"currentReplicas"`
    DesiredReplicas int32        `json:"desiredReplicas"`
    Metrics         []HPAMetric  `json:"metrics"`
    Conditions      []string     `json:"conditions"`
    Age             string       `json:"age"`
}

type HPAMetric struct {
    Type         string `json:"type"`
    Name         string `json:"name"`
    CurrentValue string `json:"currentValue"`
    TargetValue  string `json:"targetValue"`
}
```

---

## Shared Refactoring Opportunities

### 1. Extract Holmes State Hook

Create a reusable hook to reduce duplication across resource tables:

```javascript
// frontend/src/holmes/useHolmesResourceAnalysis.js
import { useState, useRef, useEffect, useCallback } from 'react';
import { onHolmesChatStream, onHolmesContextProgress, CancelHolmesStream } from './holmesApi';

export function useHolmesResourceAnalysis() {
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

    const holmesStateRef = useRef(holmesState);
    useEffect(() => {
        holmesStateRef.current = holmesState;
    }, [holmesState]);

    // Subscribe to stream events
    useEffect(() => {
        const unsubscribeChat = onHolmesChatStream((payload) => {
            // ... event handling logic (extracted from existing implementations)
        });

        const unsubscribeProgress = onHolmesContextProgress((event) => {
            // ... progress handling logic
        });

        return () => {
            unsubscribeChat();
            unsubscribeProgress();
        };
    }, []);

    const startAnalysis = useCallback((key, streamId) => {
        setHolmesState({
            loading: true,
            response: null,
            error: null,
            key,
            streamId,
            streamingText: '',
            reasoningText: '',
            queryTimestamp: new Date().toISOString(),
            contextSteps: [],
            toolEvents: [],
        });
    }, []);

    const cancelAnalysis = useCallback(async () => {
        const currentStreamId = holmesStateRef.current.streamId;
        if (!currentStreamId) return;
        setHolmesState(prev => ({ ...prev, loading: false, streamId: null }));
        try {
            await CancelHolmesStream(currentStreamId);
        } catch (err) {
            console.error('Failed to cancel Holmes stream:', err);
        }
    }, []);

    return {
        holmesState,
        setHolmesState,
        holmesStateRef,
        startAnalysis,
        cancelAnalysis,
    };
}
```

### 2. Update Router Methods

```go
// pkg/app/holmes_integration.go

func (a *App) AnalyzeResource(kind, namespace, name string) (*holmesgpt.HolmesResponse, error) {
    switch strings.ToLower(kind) {
    case "pod", "pods":
        return a.AnalyzePod(namespace, name)
    case "deployment", "deployments":
        return a.AnalyzeDeployment(namespace, name)
    case "statefulset", "statefulsets":
        return a.AnalyzeStatefulSet(namespace, name)
    case "daemonset", "daemonsets":
        return a.AnalyzeDaemonSet(namespace, name)
    case "service", "services":
        return a.AnalyzeService(namespace, name)
    // Phase 5 additions:
    case "cronjob", "cronjobs":
        return a.AnalyzeCronJob(namespace, name)
    case "job", "jobs":
        return a.AnalyzeJob(namespace, name)
    case "ingress", "ingresses":
        return a.AnalyzeIngress(namespace, name)
    case "persistentvolumeclaim", "persistentvolumeclaims", "pvc":
        return a.AnalyzePVC(namespace, name)
    case "node", "nodes":
        return a.AnalyzeNode(name)  // No namespace for nodes
    case "horizontalpodautoscaler", "horizontalpodautoscalers", "hpa":
        return a.AnalyzeHPA(namespace, name)
    default:
        return nil, fmt.Errorf("unsupported resource kind: %s", kind)
    }
}
```

---

## Frontend Integration Pattern

For each resource with existing frontend, add Holmes following this pattern:

```javascript
// In resource's OverviewTable.jsx

// 1. Imports
import { Analyze{Resource}Stream, CancelHolmesStream, onHolmesContextProgress, onHolmesChatStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';

// 2. State (add to component)
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
const holmesStateRef = React.useRef(holmesState);
React.useEffect(() => {
    holmesStateRef.current = holmesState;
}, [holmesState]);

// 3. Event subscriptions (add useEffect)
useEffect(() => {
    const unsubscribeChat = onHolmesChatStream((payload) => {
        // Copy from DeploymentsOverviewTable.jsx lines 184-308
    });
    const unsubscribeProgress = onHolmesContextProgress((event) => {
        // Copy from DeploymentsOverviewTable.jsx lines 310-330
    });
    return () => { unsubscribeChat(); unsubscribeProgress(); };
}, []);

// 4. Handler functions
const handleAnalyzeHolmes = async (row) => {
    const key = `${row.namespace}/${row.name}`;
    const streamId = `{resource}-${Date.now()}`;
    setHolmesState({
        loading: true, response: null, error: null, key, streamId,
        streamingText: '', reasoningText: '',
        queryTimestamp: new Date().toISOString(),
        contextSteps: [], toolEvents: [],
    });
    setBottomActiveTab('holmes');
    setBottomOpen(true);
    try {
        await Analyze{Resource}Stream(row.namespace, row.name, streamId);
    } catch (err) {
        setHolmesState(prev => ({ ...prev, loading: false, error: err?.message || String(err), key }));
    }
};

const handleCancelHolmes = async () => {
    const currentStreamId = holmesState.streamId;
    if (!currentStreamId) return;
    setHolmesState(prev => ({ ...prev, loading: false, streamId: null }));
    await CancelHolmesStream(currentStreamId);
};

// 5. Add to bottomTabs
const bottomTabs = [
    // ... existing tabs
    { key: 'holmes', label: 'Holmes' },
];

// 6. Add to renderPanelContent
if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
        <HolmesBottomPanel
            kind="{ResourceKind}"
            namespace={row.namespace}
            name={row.name}
            onAnalyze={() => handleAnalyzeHolmes(row)}
            onCancel={holmesState.key === key && holmesState.streamId ? handleCancelHolmes : null}
            response={holmesState.key === key ? holmesState.response : null}
            loading={holmesState.key === key && holmesState.loading}
            error={holmesState.key === key ? holmesState.error : null}
            queryTimestamp={holmesState.key === key ? holmesState.queryTimestamp : null}
            streamingText={holmesState.key === key ? holmesState.streamingText : ''}
            reasoningText={holmesState.key === key ? holmesState.reasoningText : ''}
            toolEvents={holmesState.key === key ? holmesState.toolEvents : []}
            contextSteps={holmesState.key === key ? holmesState.contextSteps : []}
        />
    );
}

// 7. Add to row actions
{
    label: holmesState.loading && holmesState.key === `${row.namespace}/${row.name}`
        ? 'Analyzing...' : 'Ask Holmes',
    icon: '🧠',
    disabled: holmesState.loading && holmesState.key === `${row.namespace}/${row.name}`,
    onClick: () => {
        handleAnalyzeHolmes(row);
        api?.openDetails?.('holmes');
    },
}
```

---

## Testing Requirements

### Go Unit Tests

For each resource, create tests in `pkg/app/holmes_context_test.go`:

```go
func TestGetCronJobContext(t *testing.T) {
    // Test with mock clientset containing:
    // - CronJob with various states
    // - Related Jobs
    // - Events
    // Verify context string contains expected information
}

func TestGetCronJobContext_NotFound(t *testing.T) {
    // Test error handling when CronJob doesn't exist
}
```

### Frontend Unit Tests

For each resource, test:
- Holmes state transitions
- Event subscription/unsubscription
- Cancel functionality
- Row action rendering

### E2E Tests

Create `e2e/tests/holmes/60-phase5-resources.spec.ts`:

```typescript
test.describe('Holmes Phase 5 Resources', () => {
    test('analyzes CronJob', async ({ page }) => {
        // Navigate to CronJobs
        // Click on a CronJob
        // Click "Ask Holmes"
        // Verify Holmes tab opens
        // Verify streaming response
    });

    // Similar tests for Job, Ingress, PVC, Node, HPA
});
```

---

## Implementation Checklist

### CronJob
- [ ] `getCronJobContext()` in `holmes_context.go`
- [ ] `AnalyzeCronJob()` and `AnalyzeCronJobStream()` in `holmes_integration.go`
- [ ] Update routers in `holmes_integration.go`
- [ ] Export in `holmesApi.js`
- [ ] Add Holmes to `CronJobsOverviewTable.jsx`
- [ ] Unit tests
- [ ] E2E test

### Job
- [ ] `getJobContext()` in `holmes_context.go`
- [ ] `getJobLogs()` helper in `holmes_context.go`
- [ ] `AnalyzeJob()` and `AnalyzeJobStream()` in `holmes_integration.go`
- [ ] Update routers
- [ ] Export in `holmesApi.js`
- [ ] Add Holmes to `JobsOverviewTable.jsx`
- [ ] Unit tests
- [ ] E2E test

### Ingress
- [ ] `getIngressContext()` in `holmes_context.go`
- [ ] `AnalyzeIngress()` and `AnalyzeIngressStream()` in `holmes_integration.go`
- [ ] Update routers
- [ ] Export in `holmesApi.js`
- [ ] Add Holmes to `IngressesOverviewTable.jsx`
- [ ] Unit tests
- [ ] E2E test

### PersistentVolumeClaim
- [ ] `getPersistentVolumeClaimContext()` in `holmes_context.go`
- [ ] `AnalyzePVC()` and `AnalyzePVCStream()` in `holmes_integration.go`
- [ ] Update routers
- [ ] Export in `holmesApi.js`
- [ ] Add Holmes to `PersistentVolumeClaimsOverviewTable.jsx`
- [ ] Unit tests
- [ ] E2E test

### Node (Full Implementation)
- [ ] Create `nodes.go` with `GetNodes()`, `GetNode()`
- [ ] Add `NodeInfo` type to `types.go`
- [ ] `getNodeContext()` in `holmes_context.go`
- [ ] `AnalyzeNode()` and `AnalyzeNodeStream()` in `holmes_integration.go`
- [ ] Update routers
- [ ] Export in `holmesApi.js`
- [ ] Create `frontend/src/k8s/resources/nodes/` directory
- [ ] Create `NodesOverviewTable.jsx` with full Holmes integration
- [ ] Create supporting tab components
- [ ] Add to sidebar navigation
- [ ] Unit tests
- [ ] E2E test

### HorizontalPodAutoscaler (Full Implementation)
- [ ] Create `hpa.go` with `GetHPAs()`, `GetHPA()`
- [ ] Add `HPAInfo` type to `types.go`
- [ ] `getHPAContext()` in `holmes_context.go`
- [ ] `AnalyzeHPA()` and `AnalyzeHPAStream()` in `holmes_integration.go`
- [ ] Update routers
- [ ] Export in `holmesApi.js`
- [ ] Create `frontend/src/k8s/resources/hpa/` directory
- [ ] Create `HPAOverviewTable.jsx` with full Holmes integration
- [ ] Create supporting tab components
- [ ] Add to sidebar navigation
- [ ] Unit tests
- [ ] E2E test

---

## Verification Steps

1. **Build and Run**
   ```bash
   wails dev
   ```

2. **Test Each Resource Type**
   - Navigate to resource view
   - Select a resource
   - Click "Ask Holmes" in row actions
   - Verify Holmes tab opens
   - Verify context progress steps appear
   - Verify streaming response renders correctly
   - Test cancel functionality

3. **Run Unit Tests**
   ```bash
   go test -cover ./pkg/app/...
   cd frontend && npm test
   ```

4. **Run E2E Tests**
   ```bash
   cd e2e && npx playwright test tests/holmes/
   ```

5. **Verify Coverage >= 70%**
   ```bash
   go test -coverprofile=coverage.out ./pkg/app/...
   go tool cover -func=coverage.out | grep total
   ```

---

## Documentation Updates

- [ ] Update `CLAUDE.md` with Phase 5 features
- [ ] Document new resource analysis capabilities
- [ ] Add troubleshooting section for new resource types
- [ ] Update Holmes configuration docs if needed

---

**Phase 5 Complete When:**
- All 6 resource types have working Holmes analysis
- Streaming responses work for all resources
- Context gathering provides relevant troubleshooting data
- Unit tests >= 70% coverage
- E2E tests passing for all resource types
- Documentation updated
