---
title: "Kubernetes Watch/Informer Migration Plan"
date: "2026-02-11"
owner: "team"
status: "draft"
---

# Goal
Replace polling-based Kubernetes data refresh with watch/informer-driven updates to reduce traffic while keeping UI behavior stable.

# Scope
- Kubernetes resources currently polled in the backend and surfaced in the frontend tables/bottom panel.
- Wails RPC and event wiring used to deliver updates to the frontend.
- No change to stable DOM selectors or UI layout.

# Non-Goals
- No new resource types.
- No UI redesign.
- No changes to authentication/cluster connection workflows.

# Plan

## 1) Inventory and baseline
- [ ] Locate all polling loops, timers, and periodic refresh triggers in the backend.
- [ ] Identify resource-specific entry points (pods, deployments, services, jobs, etc.).
- [ ] Map which frontend views rely on polling and how they consume data.
- [ ] Capture baseline metrics: poll interval, API QPS, bandwidth, and UI refresh frequency.
- [ ] Document current error/retry behavior on transient API failures.

## 2) Informer architecture design
- [ ] Decide watcher scope per resource (all namespaces vs selected namespace).
- [ ] Define a shared informer factory lifecycle per cluster context.
- [ ] Establish a cache strategy: per-resource listers feeding the UI.
- [ ] Define event types to surface to frontend (add/update/delete, plus resync).
- [ ] Specify fallback behavior on watch failures (relist + backoff).
- [ ] Determine resync period (long interval) to guard against missed events.
- [ ] Define how age auto-refresh will be handled in UI without polling API.

## 3) Backend implementation plan (no code yet)
- [ ] Add a cluster-scoped informer manager in `pkg/app/` with start/stop methods.
- [ ] Tie informer lifecycle to context selection and kubeconfig changes.
- [ ] For each resource type, define:
  - [ ] Informer creation and handler registration.
  - [ ] Cache access path for initial list responses.
  - [ ] Event payload shape for Wails event emission.
- [ ] Define a consistent event naming scheme for frontend subscriptions.
- [ ] Ensure thread-safe access to caches and clean shutdown on context switch.
- [ ] Ensure backend errors are surfaced to the UI notification system.
- [ ] Document that changing Go signatures requires regenerating Wails bindings.

## 4) Frontend data flow plan (no code yet)
- [ ] Identify where data refresh is triggered per resource view.
- [ ] Add subscriptions to backend events for each resource table.
- [ ] Plan a local reducer/merge strategy for add/update/delete events.
- [ ] Keep CreateManifestOverlay behavior consistent with current UX.
- [ ] Keep bottom-panel detail view stable on updates (avoid flicker).
- [ ] Preserve stable DOM selectors for E2E tests.
- [ ] Decide whether to keep a manual refresh button and what it triggers.

## 5) Error handling and reconnects
- [ ] Define UI behavior when the watch stream drops (warning + auto-reconnect).
- [ ] Ensure reconnects do not duplicate rows or break selection state.
- [ ] Decide how to handle missing permissions (RBAC errors) per resource type.
- [ ] Add a safety fallback to a one-time list fetch after reconnect.

## 6) Testing strategy
- [ ] Backend: add table-driven tests for informer wiring and event translation.
- [ ] Frontend: add unit tests for reducer/merge logic on add/update/delete.
- [ ] E2E: update or add Playwright tests to confirm live updates appear without manual refresh.
- [ ] Document any E2E fix attempts in `project/e2e/fixes/` if failures occur.

## 7) Rollout and validation
- [ ] Add feature flag or config switch to enable informers per resource type.
- [ ] Roll out in phases: start with one low-risk resource (e.g., namespaces).
- [ ] Compare traffic and UI update latency against baseline.
- [ ] Remove legacy polling once parity is confirmed.
- [ ] Update docs (README or internal notes) describing the new event flow.

# Deliverables
- [ ] Updated backend data flow design (short doc or comments).
- [ ] Updated frontend subscription plan per resource.
- [ ] Test coverage updates.
- [ ] Updated docs describing the watch-based refresh model.

# Risks and mitigations
- [ ] Watch stream instability: mitigate with reconnect + relist.
- [ ] Cache staleness: mitigate with periodic resync.
- [ ] UI flicker: mitigate with stable selection state and diff-based updates.
- [ ] Increased complexity: mitigate with a centralized informer manager.
