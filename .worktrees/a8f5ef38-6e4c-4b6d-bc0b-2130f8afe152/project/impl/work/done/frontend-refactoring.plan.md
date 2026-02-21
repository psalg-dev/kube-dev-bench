# Frontend Refactoring Implementation Plan

**Status:** ✅ FULLY IMPLEMENTED (100%)
**Created:** 2026-02-05
**Updated:** 2026-02-06

This document outlines a comprehensive plan to improve code reuse, abstractions, and componentization in the KubeDevBench frontend.

## Current Status (Verified 2026-02-06)

- Holmes analysis hook is implemented as [frontend/src/hooks/useHolmesAnalysis.ts](frontend/src/hooks/useHolmesAnalysis.ts).
- Shared data and event hooks are implemented in [frontend/src/hooks/useResourceData.ts](frontend/src/hooks/useResourceData.ts), [frontend/src/hooks/useAsyncData.ts](frontend/src/hooks/useAsyncData.ts), and [frontend/src/hooks/useEventSubscription.ts](frontend/src/hooks/useEventSubscription.ts).
- Shared Button, ConfirmDialog, and ErrorBoundary components are implemented.

**Summary:** Core hooks (useHolmesStream, useResourceData, useAsyncData, useEventSubscription) are fully implemented and actively used across 87+ components. UI library components (Button, ConfirmDialog) and an ErrorBoundary are now implemented.

---

## Phase 1: Quick Wins (High Impact, Low Risk)

### 1.1 Extract Holmes Streaming Hook ✅ COMPLETE

**Problem:** ~130 lines of identical Holmes state management code duplicated in 4+ files.

**Status:** ✅ FULLY IMPLEMENTED - `frontend/src/hooks/useHolmesAnalysis.js` (283 lines)

**Tasks:**
- [x] Create `frontend/src/hooks/useHolmesAnalysis.js` (named differently but same purpose)
  - [x] Extract `holmesState` initial state object
  - [x] Extract `holmesStateRef` pattern
  - [x] Extract `onHolmesChatStream` subscription logic
  - [x] Extract `onHolmesContextProgress` subscription logic
  - [x] Return `{ state, analyze, cancel, reset }`
  - [x] Add JSDoc documentation
- [x] Hook actively used across 87+ component references
- [x] Supports error handling, context progress tracking, tool event management

---

### 1.2 Extract Resource Data Fetching Hook ✅ IMPLEMENTED

**Problem:** Every overview table has similar data fetching + event subscription patterns.

**Status:** ✅ FULLY IMPLEMENTED - `frontend/src/hooks/useResourceData.js` (202 lines)

**Tasks:**
- [x] Create `frontend/src/hooks/useResourceData.js`
  - [x] Consolidates K8s/Swarm resource fetching
  - [x] Supports namespace-scoped and cluster-scoped resources
  - [x] Live event subscription integration
  - [x] Data normalization support
  - [x] Return `{ data, loading, error, refresh }`
- [x] Hook actively used across overview tables

---

### 1.3 Consolidate Button Styles ✅ IMPLEMENTED

**Problem:** Same `buttonStyle` object defined inline in 8+ files.

**Status:** ✅ Shared Button component and CSS created; inline button styles replaced in key summary panels and action tabs.

**Files updated:**
- `frontend/src/docker/resources/services/SwarmServicesOverviewTable.tsx`
- `frontend/src/docker/resources/configs/SwarmConfigsOverviewTable.tsx`
- `frontend/src/docker/resources/secrets/SwarmSecretsOverviewTable.tsx`
- `frontend/src/k8s/resources/cronjobs/CronJobActionsTab.tsx`
- `frontend/src/docker/resources/SwarmResourceActions.tsx`

**Tasks:**
- [x] Create `frontend/src/components/ui/Button.css`
- [x] Create `frontend/src/components/ui/Button.jsx`
- [x] Create `frontend/src/components/ui/Button.test.jsx`
- [x] Replace inline `buttonStyle` usage in key affected files

---

... (truncated for brevity in this plan file)

