# Rich Bottom Panel Tabs - TODO

## Current State (UPDATED)

| Resource | Tabs Now Available |
|----------|--------------------------|
| **Pods** | Summary, Logs, Events, YAML, Console, Port Forward, Files, Mounts |
| **Deployments** | Summary, Pods, Rollout, Logs, Events, YAML |
| **StatefulSets** | Summary, Pods ✅, PVCs ✅, Logs, Events ✅, YAML |
| **DaemonSets** | Summary, Pods ✅, Node Coverage ✅, Logs, Events ✅, YAML |
| **ReplicaSets** | Summary, Pods ✅, Owner ✅, Events ✅, YAML |
| **Jobs** | Summary, Pods, Logs, Events ✅, YAML |
| **CronJobs** | Summary, Job History, Next Runs ✅, Actions ✅, Events ✅, YAML |
| **ConfigMaps** | Summary, Data, Consumers ✅, Events ✅, YAML |
| **Secrets** | Summary, Data ✅, Consumers ✅, Events, YAML |
| **PersistentVolumes** | Summary, Bound PVC ✅, Events ✅, YAML |
| **PersistentVolumeClaims** | Summary, Events ✅, YAML, Files |
| **Ingresses** | Summary, Rules ✅, Events ✅, YAML |

Notes:
- Deployments: Rollout + aggregate logs are exposed via dedicated tabs.
- Secrets: Data/Consumers tabs are now wired into the bottom panel.

---

## Implementation Status

### ✅ Completed Enhancements

### 1. Deployments
- [x] **Pods Tab** - List pods owned by this deployment with status
- [x] **Events Tab** - Real events from the API

### 2. StatefulSets
- [x] **Pods Tab** - List pods with ordinal index
- [x] **Events Tab** - Real events
- [x] **PVCs Tab** - List associated PersistentVolumeClaims

### 3. DaemonSets
- [x] **Pods Tab** - List pods per node, show node name
- [x] **Events Tab** - Real events

### 4. ReplicaSets
- [x] **Pods Tab** - List pods owned by this ReplicaSet
- [x] **Events Tab** - Real events
- [x] **Owner Tab** - Show owning Deployment (if any)

### 5. Jobs
- [x] **Events Tab** - Real events

### 6. CronJobs
- [x] **Events Tab** - Real events
- [x] **Actions Tab** - Trigger Now and Suspend/Resume actions

### 7. ConfigMaps
- [x] **Events Tab** - Real events
- [x] **Data Tab** - Already existed (view key-value pairs)

### 8. Secrets
- [x] **Events Tab** - Real events (replaced mock)

### 9. PersistentVolumes
- [x] **Bound PVC Tab** - Show linked PVC (if bound)
- [x] **Events Tab** - Real events

### 10. PersistentVolumeClaims
- [x] **Events Tab** - Real events

### 11. Ingresses
- [x] **Rules Tab** - Visual representation of host → path → service mappings
- [x] **Events Tab** - Real events (replaced mock)

---

## New Reusable Components Created

| Component | Location | Purpose |
|-----------|----------|---------|
| ResourceEventsTab | `frontend/src/components/ResourceEventsTab.jsx` | Generic events tab for any resource |
| ResourcePodsTab | `frontend/src/components/ResourcePodsTab.jsx` | Generic pods tab for workloads |
| StatefulSetPVCsTab | `frontend/src/k8s/resources/statefulsets/StatefulSetPVCsTab.jsx` | PVCs for StatefulSets |
| ReplicaSetOwnerTab | `frontend/src/k8s/resources/replicasets/ReplicaSetOwnerTab.jsx` | Owner info for ReplicaSets |
| CronJobActionsTab | `frontend/src/k8s/resources/cronjobs/CronJobActionsTab.jsx` | Actions for CronJobs |
| PVBoundPVCTab | `frontend/src/k8s/resources/persistentvolumes/PVBoundPVCTab.jsx` | Bound PVC info for PVs |
| IngressRulesTab | `frontend/src/k8s/resources/ingresses/IngressRulesTab.jsx` | Routing rules for Ingresses |

---

## Proposed Future Enhancements (Not Yet Implemented)

### Deployments
- [x] **Rollout History Tab** - Show revision history + allow rollback to a previous revision
- [x] **Scale Action** - Inline scale replicas up/down
- [x] **Logs Tab** - Aggregate logs from all pods in the deployment

### StatefulSets
- [x] **Scale Action** - Inline scale replicas
- [x] **Logs Tab** - Aggregate logs from all pods

### DaemonSets
- [x] **Logs Tab** - Aggregate logs from all pods
- [x] **Node Coverage Tab** - Show which nodes have a running pod vs. which are missing

### ReplicaSets
- [x] **Scale Action** - Inline scale replicas

### Jobs
- [x] **Logs Tab** - Aggregate logs from job pods
- [x] **Rerun Action** - Action button to re-run a Job
	- Implemented as a **Start** action in the Summary header actions (calls `StartJob`).

### CronJobs
- [x] **Next Runs Tab** - Show upcoming scheduled runs (next 5)

### ConfigMaps
- [x] **Consumers Tab** - List pods/deployments that reference this ConfigMap
- [x] **Edit Action** - Inline edit data keys (with save confirmation)

### Secrets
- [x] **Data Tab** - Show keys with masked values; reveal on click (base64-decoded)
- [x] **Consumers Tab** - List pods/deployments that reference this Secret
- [x] **Edit Action** - Inline edit (with base64 encoding)
- [x] **Copy Action** - Copy decoded value to clipboard

### PersistentVolumes
- [x] **Annotations Tab** - Expand to full view
- [x] **Capacity Usage Tab** - If metrics available, show usage % (shows a best-effort placeholder when metrics are unavailable)

### PersistentVolumeClaims
- [x] **Bound PV Tab** - Show linked PV, click to navigate
- [x] **Consumers Tab** - List pods mounting this PVC
- [x] **Resize Action** - Action to request storage expansion (if storage class supports)

### Ingresses
- [x] **TLS Tab** - Show TLS secrets and their expiry dates
	- Note: TLS configuration (secret name + hosts) is already displayed in the Rules-related UI, but expiry dates are not.
- [x] **Backend Services Tab** - List referenced services, click to navigate
- [x] **Test Endpoint Action** - Button to open host URL in browser

---

## Backend APIs Added

| API | Location | Purpose |
|-----|----------|---------|
| GetResourceEvents | `pkg/app/events.go` | Generic event fetching for any resource kind |

---

## Summary of New Actions (Header Buttons)

| Resource | Actions Implemented Now |
|----------|--------------------------|
| Deployments | Restart ✅, Scale ✅, Delete ✅ |
| StatefulSets | Restart ✅, Scale ✅, Delete ✅ |
| DaemonSets | Restart ✅, Scale (disabled), Delete ✅ |
| ReplicaSets | Scale ✅, Delete ✅ |
| Jobs | Start (re-run) ✅, Delete ✅ |
| CronJobs | Start (manual trigger) ✅, Suspend ✅, Resume ✅, Delete ✅ |
| ConfigMaps | Delete ✅ |
| Secrets | Delete ✅ |
| PersistentVolumes | Delete ✅ |
| PersistentVolumeClaims | Delete ✅ |
| Ingresses | Delete ✅ |

