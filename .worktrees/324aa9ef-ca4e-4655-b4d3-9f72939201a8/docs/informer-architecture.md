# Informer Architecture (Kubernetes)

## Overview

KubeDevBench now supports a watch/informer update mode for Kubernetes resources, controlled by the backend config flag `useInformers`.

- `useInformers=false` (default): existing ticker polling remains active.
- `useInformers=true`: backend starts informer-driven updates and stops polling loops.

Core implementation lives in `pkg/app/informer_manager.go`.

## Lifecycle

1. `Startup()` loads config.
2. If `useInformers` is enabled and a kube context is selected, `InformerManager` starts.
3. On namespace/context changes (`SetCurrentKubeContext`, `SetCurrentNamespace`, `SetPreferredNamespaces`) manager restarts with new namespace scope.
4. `Shutdown()` stops informer manager and polling loops.

## Event Flow

Kubernetes API (watch)
→ client-go shared informers
→ debounced snapshot emitters
→ Wails events (`*:update`)
→ frontend table subscriptions (`EventsOn(...)`)

Implemented informer snapshot events include:

- `pods:update`
- `deployments:update`
- `statefulsets:update`
- `daemonsets:update`
- `replicasets:update`
- `jobs:update`
- `cronjobs:update`
- `services:update`
- `configmaps:update`
- `secrets:update`
- `persistentvolumeclaims:update`
- `ingresses:update`
- `roles:update`
- `rolebindings:update`
- `clusterroles:update`
- `clusterrolebindings:update`

System events:

- `k8s:cache:synced`
- `k8s:informer:error`
- `k8s:informer:reconnected`

## Counts Refresh Integration

`runResourceCountsAggregator()` now suppresses periodic polling refresh when `useInformers` is enabled. Counts refreshes are requested by informer snapshot emissions and explicit context/namespace changes.

## Frontend Changes in This Phase

The following views were converted from timer-heavy polling windows to event-driven updates:

- `ConfigMapsOverviewTable.tsx`
- `PersistentVolumeClaimsOverviewTable.tsx`

A reusable hook was added:

- `frontend/src/hooks/useResourceWatch.ts`

## Current Limitations

- Backend GET/LIST RPCs still use existing API paths; informer snapshots currently trigger those getters for normalized payload emission.
- Runtime reconnection uses informer watch error callbacks and snapshot recovery; full exponential backoff orchestration is not yet implemented.
- Settings UI toggle for `useInformers` is not added yet (backend methods exist).

## Validation

- Go tests: `pkg/app` passed.
- Frontend unit test added for `useResourceWatch` and passing.
