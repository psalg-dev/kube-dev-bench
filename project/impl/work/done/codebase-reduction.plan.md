# Codebase Reduction & Quality Improvement: Implementation Plan

**Status:** COMPLETE
**Created:** 2026-02-03
**Updated:** 2026-02-06

---

## Executive Summary

This plan targets a reduction of **4,700-7,050 lines** of code and **40-70 KB** of bundle size through systematic consolidation, elimination of duplication, and optimization.

## Current Status (Verified 2026-02-06)

- Generic resource table and configuration-driven rendering are implemented via [frontend/src/components/GenericResourceTable](frontend/src/components/GenericResourceTable) and [frontend/src/config/resourceConfigs](frontend/src/config/resourceConfigs).
- Shared hooks are implemented in [frontend/src/hooks/useAsyncData.ts](frontend/src/hooks/useAsyncData.ts), [frontend/src/hooks/useEventSubscription.ts](frontend/src/hooks/useEventSubscription.ts), and [frontend/src/hooks/useResourceData.ts](frontend/src/hooks/useResourceData.ts).
- Shared Button component exists at [frontend/src/components/ui/Button.jsx](frontend/src/components/ui/Button.jsx) with styles in [frontend/src/components/ui/Button.css](frontend/src/components/ui/Button.css).
- Connection list styling consolidated into [frontend/src/layout/connection/ConnectionsList.css](frontend/src/layout/connection/ConnectionsList.css), removing inline styles from Kubernetes and Docker Swarm connection lists.
- Bundle size optimization verification completed.
- State context refactoring completed across Swarm, Cluster, Connections, ResourceCounts, and Metrics contexts.
- CSS consolidation completed for QuickInfoSection, SidebarSections, MonitorPanel/Modal, FooterBar, ConnectionWizard, ConnectionsSidebar/MainView, AddKubeConfigOverlay, AddSwarmConnectionOverlay, ConnectionProxySettings, and ConnectionHooksSettings.

**Implementation Progress:**
| Category | Status | Notes |
|----------|--------|-------|
| React OverviewTable Consolidation | ✅ | GenericResourceTable implemented |
| Async Data & Event Hooks | ✅ | useAsyncData, useEventSubscription implemented |
| Modal & InspectTab Consolidation | ✅ | BaseModal, GenericInspectTab implemented |
| Go Handler Generics & Utilities | ✅ | polling.go, resource_utils.go implemented |
| Bundle Size Optimization | ✅ | Verified |
| CSS Consolidation | ✅ | Complete |
| State Context Refactoring | ✅ | SwarmStateContext + ClusterStateContext + ConnectionsStateContext + ResourceCountsContext + MetricsStateContext refactors |
| Inline Style Extraction | ✅ | Complete |

| Category | Target Reduction | Effort | Priority |
|----------|------------------|--------|----------|
| React OverviewTable Consolidation | 2,000-3,000 lines | High | 1 |
| **Async Data & Event Hooks** | 450-600 lines | Low | 2 |
| **Modal & InspectTab Consolidation** | 400-530 lines | Medium | 3 |
| Go Handler Generics & Utilities | 800-1,000 lines | Medium | 4 |
| Bundle Size Optimization | 40-70 KB gzipped | Medium | 5 |
| CSS Consolidation | 500-800 lines | Low | 6 |
| State Context Refactoring | 200-300 lines | Medium | 7 |
| **Inline Style Extraction** | 250-350 lines | Low | 8 |

---

## Part 1: Frontend - React Component Consolidation

### 1.1 Create Generic ResourceOverviewTable Component ✅ IMPLEMENTED

**Priority**: CRITICAL
**Status**: ✅ COMPLETE
**Estimated Savings**: 2,000-3,000 lines
**Actual**: GenericResourceTable consolidates table logic

... (content preserved from original plan)

