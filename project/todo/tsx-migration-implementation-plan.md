# TypeScript (TSX) Migration: Implementation Plan

**Date**: 2026-02-03
**Status**: Planning

---

## Executive Summary

This plan outlines the migration of the KubeDevBench frontend from JavaScript/JSX to TypeScript/TSX. The migration will leverage **4,003 lines of existing auto-generated Wails types** that are currently unused, introduce type safety across the application, and enable further codebase reduction through TypeScript generics.

| Category | Target Benefit | Effort | Priority |
|----------|----------------|--------|----------|
| Wails API Type Integration | Immediate type safety, IDE autocomplete | Low | 1 |
| Resource Config Generics | ~200 lines reduction, single source of truth | Medium | 2 |
| State Context Typing | Compile-time safety for 80% of app | Medium | 3 |
| Custom Hook Typing | Clear contracts, reduced documentation | Medium | 4 |
| Component Prop Interfaces | Self-documenting APIs, catch errors at compile | High | 5 |
| Full Migration | Complete type coverage | High | 6 |

**Estimated Total Impact:**
- **~300-500 lines** code reduction through generic typing
- **~100-200 lines** documentation eliminated (types are self-documenting)
- **4,003 lines** of Wails types activated
- **Compile-time error detection** instead of runtime failures
- **Significant DX improvement** (IDE autocomplete, refactoring safety)

---

## Current State Analysis

### TypeScript Usage: None in Source

| Metric | Value |
|--------|-------|
| JSX/JS files in `frontend/src/` | 395 |
| TSX/TS files in `frontend/src/` | 0 |
| Auto-generated Wails types | 4,003 lines (unused) |
| PropTypes usage | 0 files |
| JSDoc type hints | Minimal |

### Key Findings

1. **Wails bindings are already typed** - `frontend/wailsjs/go/models.ts` contains 100+ typed classes for all backend types
2. **No prop validation** - Components accept any props without runtime or compile-time checking
3. **Complex components have 20-35 undocumented parameters** - `OverviewTableWithPanel` has ~35 props
4. **12 resource config files repeat identical patterns** - Prime candidate for generic typing
5. **Two state contexts drive 80% of app** - Type safety here prevents cascading failures

---

## Part 1: Foundation Setup

### 1.1 TypeScript Configuration

**Priority**: CRITICAL
**Effort**: 2-4 hours
**Risk**: None

#### Implementation

**Create**: `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Type Checking - Start permissive, tighten over time */
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,

    /* Path aliases */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/hooks/*": ["src/hooks/*"],
      "@/config/*": ["src/config/*"],
      "@/types/*": ["src/types/*"],
      "@/wailsjs/*": ["wailsjs/*"]
    }
  },
  "include": ["src/**/*", "wailsjs/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Update**: `frontend/vite.config.js`

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/wailsjs': path.resolve(__dirname, './wailsjs'),
    },
  },
  // Enable .tsx file handling (already supported by Vite)
});
```

**Install dependencies**:

```bash
cd frontend
npm install --save-dev typescript @types/react @types/react-dom
```

#### Success Criteria
- [ ] `tsc --noEmit` runs without configuration errors
- [ ] Vite builds successfully
- [ ] Existing JSX files continue to work

---

### 1.2 Core Type Definitions

**Priority**: CRITICAL
**Effort**: 1 day
**Risk**: Low

#### Problem Statement

Common types are implicitly defined across the codebase. Centralizing them enables:
- Single source of truth
- Reuse across components
- IDE autocomplete

#### Implementation

**Create**: `frontend/src/types/index.ts`

```typescript
// ============================================
// Resource Table Types
// ============================================

export interface ColumnDef<T = Record<string, unknown>> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

export interface TabDef {
  key: string;
  label: string;
  countKey?: string;
  countable?: boolean;
  icon?: React.ReactNode;
}

export interface TabCounts {
  [key: string]: number;
}

export interface RowAction<T = Record<string, unknown>> {
  label: string;
  icon?: React.ReactNode;
  onClick: (row: T) => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

// ============================================
// Resource Configuration Types
// ============================================

export interface ResourceConfig<T> {
  resourceType: string;
  resourceKind: string;
  eventName: string;
  columns: ColumnDef<T>[];
  tabs: TabDef[];
  normalize: (data: unknown) => T;
  renderPanelContent: (
    row: T,
    tab: string,
    panelApi: PanelAPI
  ) => React.ReactNode;
  getRowActions?: (row: T, api: RowActionAPI) => RowAction<T>[];
  analyzeFn?: AnalyzeFunction;
  holmesKeyPrefix?: string;
  searchFields?: (keyof T)[];
}

export interface PanelAPI {
  closePanel: () => void;
  refreshData: () => void;
  namespace?: string;
}

export interface RowActionAPI {
  onRestart?: (namespace: string, name: string) => Promise<void>;
  onDelete?: (namespace: string, name: string) => Promise<void>;
  onScale?: (namespace: string, name: string, replicas: number) => Promise<void>;
}

export type AnalyzeFunction = (
  namespace: string,
  name: string,
  streamId: string
) => Promise<void>;

export type AnalyzeFunctionSwarm = (
  id: string,
  streamId: string
) => Promise<void>;

// ============================================
// Holmes Analysis Types
// ============================================

export interface HolmesState {
  loading: boolean;
  response: string | null;
  error: string | null;
  key: string | null;
  streamId: string | null;
  streamingText: string;
  reasoningText: string;
  queryTimestamp: string | null;
  contextSteps: ContextStep[];
  toolEvents: ToolEvent[];
}

export interface ContextStep {
  step: string;
  timestamp: string;
}

export interface ToolEvent {
  tool: string;
  input: unknown;
  output: unknown;
}

export interface UseHolmesAnalysisOptions {
  kind: string;
  analyzeFn: AnalyzeFunction | AnalyzeFunctionSwarm;
  keyPrefix?: string;
}

export interface UseHolmesAnalysisReturn {
  state: HolmesState;
  analyze: (...args: string[]) => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => void;
}

// ============================================
// Async Data Hook Types
// ============================================

export interface UseAsyncDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface UseResourceDataOptions<T, R = T> {
  fetchFn: (namespace: string) => Promise<T[]>;
  eventName: string;
  namespaces?: string[];
  namespace?: string;
  normalize?: (data: T) => R;
  clusterScoped?: boolean;
  enabled?: boolean;
}

export interface UseResourceDataReturn<T> {
  data: T[];
  loading: boolean;
  refresh: () => Promise<void>;
}

// ============================================
// State Context Types
// ============================================

export interface ClusterState {
  contexts: string[];
  namespaces: string[];
  selectedContext: string;
  selectedNamespaces: string[];
  loading: boolean;
  connectionStatus: ConnectionStatus | null;
  wizardOpen: boolean;
  clusterConnected: boolean;
}

export interface ClusterActions {
  selectContext: (context: string) => Promise<void>;
  selectNamespaces: (namespaces: string[]) => Promise<void>;
  reloadContexts: () => Promise<void>;
  reloadNamespaces: () => Promise<void>;
  openWizard: () => void;
  closeWizard: () => void;
  refreshConnectionStatus: () => Promise<void>;
}

export interface ClusterContextValue extends ClusterState {
  actions: ClusterActions;
}

export interface ConnectionStatus {
  connected: boolean;
  context: string;
  cluster: string;
  user: string;
  namespace: string;
}

export interface SwarmState {
  connected: boolean;
  swarmActive: boolean;
  nodeId: string;
  services: SwarmServiceInfo[];
  tasks: SwarmTaskInfo[];
  nodes: SwarmNodeInfo[];
  networks: SwarmNetworkInfo[];
  configs: SwarmConfigInfo[];
  secrets: SwarmSecretInfo[];
  stacks: SwarmStackInfo[];
  volumes: SwarmVolumeInfo[];
  loading: boolean;
}

// ============================================
// Modal Types
// ============================================

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  width?: number | string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export interface ModalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger';
}

// ============================================
// Re-export Wails types for convenience
// ============================================

export type {
  DeploymentInfo,
  StatefulSetInfo,
  DaemonSetInfo,
  PodInfo,
  ServiceInfo,
  ConfigMapInfo,
  SecretInfo,
  IngressInfo,
  JobInfo,
  CronJobInfo,
  ReplicaSetInfo,
  PersistentVolumeInfo,
  PersistentVolumeClaimInfo,
} from '@/wailsjs/go/models';

export type {
  SwarmServiceInfo,
  SwarmTaskInfo,
  SwarmNodeInfo,
  SwarmNetworkInfo,
  SwarmConfigInfo,
  SwarmSecretInfo,
  SwarmStackInfo,
  SwarmVolumeInfo,
} from '@/wailsjs/go/models';
```

**Create**: `frontend/src/types/resources.ts`

```typescript
/**
 * Base interface for all Kubernetes resources with common fields.
 */
export interface BaseK8sResource {
  name: string;
  namespace: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  creationTimestamp: string;
  age: string;
}

/**
 * Base interface for all Docker Swarm resources.
 */
export interface BaseSwarmResource {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Normalized resource with consistent casing.
 * Handles PascalCase to camelCase conversion from Go backend.
 */
export type NormalizedResource<T> = {
  [K in keyof T as Uncapitalize<string & K>]: T[K];
};

/**
 * Utility type for normalizer functions.
 */
export type Normalizer<TInput, TOutput> = (input: TInput) => TOutput;

/**
 * Creates a type-safe normalizer that handles PascalCase/camelCase.
 */
export function createNormalizer<T extends Record<string, unknown>>(
  fieldMappings: Partial<Record<keyof T, string>>
): Normalizer<Record<string, unknown>, T> {
  return (input: Record<string, unknown>): T => {
    const result = {} as T;
    for (const [key, pascalKey] of Object.entries(fieldMappings)) {
      const value = input[key] ?? input[pascalKey as string];
      (result as Record<string, unknown>)[key] = value;
    }
    return result;
  };
}
```

#### Files to Create
```
frontend/src/types/
  index.ts           # Main type exports
  resources.ts       # Resource-specific types
  api.ts             # API response types
  events.ts          # Event payload types
```

---

## Part 2: Wails API Integration

### 2.1 Typed API Wrapper Layer

**Priority**: HIGH
**Effort**: 0.5 days
**Risk**: Low

#### Problem Statement

The Wails bindings in `frontend/wailsjs/go/main/App.d.ts` provide full type coverage:

```typescript
// Already exists in App.d.ts
export function GetDeployments(arg1:string):Promise<Array<app.DeploymentInfo>>;
export function GetServices(arg1:string):Promise<Array<app.ServiceInfo>>;
```

But the frontend ignores these types:

```javascript
// Current: kubeApi.js - no types
import { GetDeployments } from '../wailsjs/go/main/App';
export { GetDeployments }; // Type information lost
```

#### Implementation

**Convert**: `frontend/src/k8s/resources/kubeApi.js` → `kubeApi.ts`

```typescript
// frontend/src/k8s/resources/kubeApi.ts
import * as App from '@/wailsjs/go/main/App';
import type { app } from '@/wailsjs/go/models';

// Re-export with preserved types
export const GetDeployments = App.GetDeployments;
export const GetStatefulSets = App.GetStatefulSets;
export const GetDaemonSets = App.GetDaemonSets;
export const GetPods = App.GetPods;
export const GetServices = App.GetServices;
export const GetConfigMaps = App.GetConfigMaps;
export const GetSecrets = App.GetSecrets;
export const GetIngresses = App.GetIngresses;
export const GetJobs = App.GetJobs;
export const GetCronJobs = App.GetCronJobs;
export const GetReplicaSets = App.GetReplicaSets;
export const GetPersistentVolumes = App.GetPersistentVolumes;
export const GetPersistentVolumeClaims = App.GetPersistentVolumeClaims;

// Holmes analysis functions
export const AnalyzeDeploymentStream = App.AnalyzeDeploymentStream;
export const AnalyzePodStream = App.AnalyzePodStream;
export const AnalyzeStatefulSetStream = App.AnalyzeStatefulSetStream;
export const AnalyzeDaemonSetStream = App.AnalyzeDaemonSetStream;
export const AnalyzeServiceStream = App.AnalyzeServiceStream;

// Resource operations
export const ScaleDeployment = App.ScaleDeployment;
export const RestartDeployment = App.RestartDeployment;
export const DeleteDeployment = App.DeleteDeployment;
export const GetDeploymentYAML = App.GetDeploymentYAML;

// Type exports for consumers
export type DeploymentInfo = app.DeploymentInfo;
export type StatefulSetInfo = app.StatefulSetInfo;
export type DaemonSetInfo = app.DaemonSetInfo;
export type PodInfo = app.PodInfo;
export type ServiceInfo = app.ServiceInfo;
// ... etc
```

**Convert**: `frontend/src/docker/swarmApi.js` → `swarmApi.ts`

```typescript
// frontend/src/docker/swarmApi.ts
import * as App from '@/wailsjs/go/main/App';
import type { app } from '@/wailsjs/go/models';

// Typed exports
export const GetDockerServices = App.GetDockerServices;
export const GetDockerTasks = App.GetDockerTasks;
export const GetDockerNodes = App.GetDockerNodes;
export const GetDockerNetworks = App.GetDockerNetworks;
export const GetDockerConfigs = App.GetDockerConfigs;
export const GetDockerSecrets = App.GetDockerSecrets;
export const GetDockerVolumes = App.GetDockerVolumes;
export const GetDockerStacks = App.GetDockerStacks;

// Operations
export const ScaleDockerService = App.ScaleDockerService;
export const RemoveDockerService = App.RemoveDockerService;
export const GetDockerServiceLogs = App.GetDockerServiceLogs;

// Type exports
export type SwarmServiceInfo = app.SwarmServiceInfo;
export type SwarmTaskInfo = app.SwarmTaskInfo;
export type SwarmNodeInfo = app.SwarmNodeInfo;
// ... etc
```

#### Immediate Benefits

```typescript
// Before: No autocomplete, no error checking
const deployments = await GetDeployments(namespace);
deployments.forEach(d => {
  console.log(d.wrongField); // No error - runtime failure
});

// After: Full IDE support, compile-time errors
const deployments = await GetDeployments(namespace);
deployments.forEach(d => {
  console.log(d.wrongField); // TS Error: Property 'wrongField' does not exist
  console.log(d.name);       // ✓ Autocomplete shows all valid fields
});
```

---

## Part 3: Resource Config Generics

### 3.1 Generic Resource Configuration

**Priority**: HIGH
**Estimated Savings**: ~200 lines through consolidation
**Effort**: 2 days
**Risk**: Medium

#### Problem Statement

12 resource config files repeat identical patterns:

```javascript
// deploymentConfig.jsx - repeated structure in 12 files
export const deploymentColumns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  // ...
];

export const deploymentTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'pods', label: 'Pods', countKey: 'pods' },
  // ...
];

export const normalizeDeployment = (d) => ({
  name: d.name ?? d.Name,
  namespace: d.namespace ?? d.Namespace,
  // ...manual PascalCase fallback
});
```

#### Implementation

**Create**: `frontend/src/config/resourceConfigs/createConfig.ts`

```typescript
import type { ColumnDef, TabDef, ResourceConfig } from '@/types';

/**
 * Factory function for creating type-safe resource configurations.
 * Eliminates boilerplate and ensures consistency across all resource types.
 */
export function createResourceConfig<T extends Record<string, unknown>>(
  config: ResourceConfig<T>
): ResourceConfig<T> {
  return {
    ...config,
    // Apply default search fields if not specified
    searchFields: config.searchFields ?? ['name', 'namespace'] as (keyof T)[],
  };
}

/**
 * Common column definitions reusable across resources.
 */
export const commonColumns = {
  name: <T extends { name: string }>(): ColumnDef<T> => ({
    key: 'name',
    label: 'Name',
    sortable: true,
  }),

  namespace: <T extends { namespace: string }>(): ColumnDef<T> => ({
    key: 'namespace',
    label: 'Namespace',
    sortable: true,
  }),

  age: <T extends { age: string }>(): ColumnDef<T> => ({
    key: 'age',
    label: 'Age',
    sortable: true,
  }),

  status: <T extends { status: string }>(
    render?: (status: string) => React.ReactNode
  ): ColumnDef<T> => ({
    key: 'status',
    label: 'Status',
    render: render ? (val) => render(val as string) : undefined,
  }),

  replicas: <T extends { replicas: number; readyReplicas: number }>(): ColumnDef<T> => ({
    key: 'replicas',
    label: 'Replicas',
    align: 'center',
    render: (_, row) => `${row.readyReplicas}/${row.replicas}`,
  }),
};

/**
 * Common tab definitions reusable across resources.
 */
export const commonTabs = {
  summary: (): TabDef => ({ key: 'summary', label: 'Summary', countable: false }),
  pods: (): TabDef => ({ key: 'pods', label: 'Pods', countKey: 'pods' }),
  events: (): TabDef => ({ key: 'events', label: 'Events', countKey: 'events' }),
  yaml: (): TabDef => ({ key: 'yaml', label: 'YAML', countable: false }),
  logs: (): TabDef => ({ key: 'logs', label: 'Logs', countable: false }),
  holmes: (): TabDef => ({ key: 'holmes', label: 'Holmes', countable: false }),
};

/**
 * Creates a normalizer that handles PascalCase/camelCase conversion.
 * Reduces ~10 lines per config file to 1.
 */
export function createNormalizer<T>(
  fields: (keyof T)[]
): (data: Record<string, unknown>) => T {
  return (data: Record<string, unknown>): T => {
    const result = {} as T;
    for (const field of fields) {
      const fieldStr = String(field);
      const pascalCase = fieldStr.charAt(0).toUpperCase() + fieldStr.slice(1);
      (result as Record<string, unknown>)[fieldStr] =
        data[fieldStr] ?? data[pascalCase];
    }
    return result;
  };
}
```

**Convert**: `frontend/src/config/resourceConfigs/deploymentConfig.jsx` → `deploymentConfig.tsx`

```typescript
// frontend/src/config/resourceConfigs/deploymentConfig.tsx
import type { DeploymentInfo } from '@/wailsjs/go/models';
import type { ResourceConfig } from '@/types';
import {
  createResourceConfig,
  commonColumns,
  commonTabs
} from './createConfig';
import { GetDeployments, AnalyzeDeploymentStream } from '@/k8s/resources/kubeApi';
import { renderDeploymentPanel } from '@/k8s/resources/deployments/DeploymentPanelContent';
import { getDeploymentRowActions } from '@/k8s/resources/deployments/deploymentActions';

// Typed deployment for normalized data
interface NormalizedDeployment {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  unavailableReplicas: number;
  age: string;
  image: string;
  labels: Record<string, string>;
  conditions: DeploymentCondition[];
}

export const deploymentConfig = createResourceConfig<NormalizedDeployment>({
  resourceType: 'deployment',
  resourceKind: 'Deployment',
  eventName: 'deployments:update',

  columns: [
    commonColumns.name(),
    commonColumns.namespace(),
    commonColumns.replicas(),
    {
      key: 'availableReplicas',
      label: 'Available',
      align: 'center',
    },
    commonColumns.age(),
    {
      key: 'image',
      label: 'Image',
      render: (val) => <span title={val as string}>{truncateImage(val as string)}</span>,
    },
  ],

  tabs: [
    commonTabs.summary(),
    commonTabs.pods(),
    { key: 'rollout', label: 'Rollout History' },
    commonTabs.logs(),
    commonTabs.events(),
    commonTabs.yaml(),
    commonTabs.holmes(),
  ],

  normalize: (d: unknown): NormalizedDeployment => {
    const data = d as Record<string, unknown>;
    return {
      name: (data.name ?? data.Name) as string,
      namespace: (data.namespace ?? data.Namespace) as string,
      replicas: (data.replicas ?? data.Replicas ?? 0) as number,
      readyReplicas: (data.readyReplicas ?? data.ReadyReplicas ?? 0) as number,
      availableReplicas: (data.availableReplicas ?? data.AvailableReplicas ?? 0) as number,
      unavailableReplicas: (data.unavailableReplicas ?? data.UnavailableReplicas ?? 0) as number,
      age: (data.age ?? data.Age ?? '') as string,
      image: (data.image ?? data.Image ?? '') as string,
      labels: (data.labels ?? data.Labels ?? {}) as Record<string, string>,
      conditions: (data.conditions ?? data.Conditions ?? []) as DeploymentCondition[],
    };
  },

  renderPanelContent: renderDeploymentPanel,
  getRowActions: getDeploymentRowActions,
  analyzeFn: AnalyzeDeploymentStream,
  holmesKeyPrefix: 'deployment',
  searchFields: ['name', 'namespace', 'image'],
});
```

#### Savings Per File

| Aspect | Before (JSX) | After (TSX) | Savings |
|--------|--------------|-------------|---------|
| Column definitions | ~20 lines | ~12 lines (reuse common) | 8 lines |
| Tab definitions | ~15 lines | ~8 lines (reuse common) | 7 lines |
| Normalize function | ~15 lines | ~10 lines (typed) | 5 lines |
| Type safety | 0 | Full | - |
| **Per file** | ~50 lines | ~30 lines | ~20 lines |
| **12 files total** | ~600 lines | ~360 lines | **~240 lines** |

---

## Part 4: Custom Hook Typing

### 4.1 useHolmesAnalysis Hook

**Priority**: HIGH
**Effort**: 0.5 days
**Risk**: Low

#### Implementation

**Convert**: `frontend/src/hooks/useHolmesAnalysis.js` → `useHolmesAnalysis.ts`

```typescript
// frontend/src/hooks/useHolmesAnalysis.ts
import { useState, useRef, useEffect, useCallback } from 'react';
import { onHolmesChatStream, onHolmesContextProgress } from '@/wailsjs/runtime';
import { CancelHolmesStream } from '@/wailsjs/go/main/App';
import type {
  HolmesState,
  UseHolmesAnalysisOptions,
  UseHolmesAnalysisReturn,
  ContextStep
} from '@/types';

const initialState: HolmesState = {
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
};

interface StreamPayload {
  streamId: string;
  type: 'chunk' | 'reasoning' | 'done' | 'error' | 'tool';
  text?: string;
  response?: string;
  error?: string;
  tool?: string;
  input?: unknown;
  output?: unknown;
}

interface ProgressEvent {
  step: string;
  timestamp: string;
}

export function useHolmesAnalysis({
  kind,
  analyzeFn,
  keyPrefix = '',
}: UseHolmesAnalysisOptions): UseHolmesAnalysisReturn {
  const [state, setState] = useState<HolmesState>(initialState);
  const stateRef = useRef<HolmesState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Stream event handler
  useEffect(() => {
    const unsubscribe = onHolmesChatStream((payload: StreamPayload) => {
      const current = stateRef.current;
      if (!current.streamId || payload.streamId !== current.streamId) return;

      switch (payload.type) {
        case 'chunk':
          setState(prev => ({
            ...prev,
            streamingText: prev.streamingText + (payload.text ?? ''),
          }));
          break;
        case 'reasoning':
          setState(prev => ({
            ...prev,
            reasoningText: prev.reasoningText + (payload.text ?? ''),
          }));
          break;
        case 'done':
          setState(prev => ({
            ...prev,
            loading: false,
            response: prev.streamingText || payload.response || null,
          }));
          break;
        case 'error':
          setState(prev => ({
            ...prev,
            loading: false,
            error: payload.error ?? 'Unknown error',
          }));
          break;
        case 'tool':
          setState(prev => ({
            ...prev,
            toolEvents: [...prev.toolEvents, {
              tool: payload.tool ?? 'unknown',
              input: payload.input,
              output: payload.output,
            }],
          }));
          break;
      }
    });

    return () => {
      try { unsubscribe?.(); } catch { /* ignore */ }
    };
  }, []);

  // Progress event handler
  useEffect(() => {
    const unsubscribe = onHolmesContextProgress((event: ProgressEvent) => {
      const current = stateRef.current;
      if (!current.streamId) return;

      setState(prev => ({
        ...prev,
        contextSteps: [...prev.contextSteps, {
          step: event.step,
          timestamp: event.timestamp,
        }],
      }));
    });

    return () => {
      try { unsubscribe?.(); } catch { /* ignore */ }
    };
  }, []);

  const analyze = useCallback(async (...args: string[]) => {
    const key = args.join('/');
    const streamId = `${keyPrefix || kind.toLowerCase()}-${Date.now()}`;

    setState({
      ...initialState,
      loading: true,
      key,
      streamId,
      queryTimestamp: new Date().toISOString(),
    });

    try {
      await (analyzeFn as (...args: string[]) => Promise<void>)(...args, streamId);
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [kind, analyzeFn, keyPrefix]);

  const cancel = useCallback(async () => {
    if (!state.streamId) return;
    setState(prev => ({ ...prev, loading: false, streamId: null }));
    await CancelHolmesStream(state.streamId);
  }, [state.streamId]);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return { state, analyze, cancel, reset };
}
```

### 4.2 useResourceData Hook

**Convert**: `frontend/src/hooks/useResourceData.js` → `useResourceData.ts`

```typescript
// frontend/src/hooks/useResourceData.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { EventsOn } from '@/wailsjs/runtime';
import type { UseResourceDataOptions, UseResourceDataReturn } from '@/types';

export function useResourceData<T, R = T>({
  fetchFn,
  eventName,
  namespaces,
  namespace,
  normalize,
  clusterScoped = false,
  enabled = true,
}: UseResourceDataOptions<T, R>): UseResourceDataReturn<R> {
  const [data, setData] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const nsList = clusterScoped
        ? ['']
        : (namespaces?.length ? namespaces : (namespace ? [namespace] : []));

      const allData: R[] = [];
      for (const ns of nsList) {
        const items = await fetchFn(ns);
        const normalized = normalize
          ? items.map(item => normalize(item))
          : (items as unknown as R[]);
        allData.push(...normalized);
      }

      if (mountedRef.current) {
        setData(allData);
      }
    } catch (err) {
      console.error(`Failed to fetch ${eventName}:`, err);
      if (mountedRef.current) {
        setData([]);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchFn, eventName, namespaces, namespace, normalize, clusterScoped, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Event subscription for live updates
  useEffect(() => {
    if (!eventName || !enabled) return;

    const unsubscribe = EventsOn(eventName, (payload: T[]) => {
      if (!mountedRef.current) return;
      const normalized = normalize
        ? payload.map(item => normalize(item))
        : (payload as unknown as R[]);
      setData(normalized);
    });

    return () => {
      try { unsubscribe?.(); } catch { /* ignore */ }
    };
  }, [eventName, normalize, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { data, loading, refresh: fetchData };
}
```

### 4.3 useAsyncData Hook

**Convert**: `frontend/src/hooks/useAsyncData.js` → `useAsyncData.ts`

```typescript
// frontend/src/hooks/useAsyncData.ts
import { useState, useEffect, useCallback, useRef, DependencyList } from 'react';
import type { UseAsyncDataReturn } from '@/types';

export function useAsyncData<T>(
  fetchFn: () => Promise<T>,
  deps: DependencyList = []
): UseAsyncDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      if (mountedRef.current) {
        setData(result);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchFn]);

  useEffect(() => {
    refetch();
  }, deps);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { data, loading, error, refetch };
}
```

---

## Part 5: State Context Typing

### 5.1 ClusterStateContext

**Priority**: HIGH
**Effort**: 1 day
**Risk**: Medium

#### Implementation

**Convert**: `frontend/src/state/ClusterStateContext.jsx` → `ClusterStateContext.tsx`

```typescript
// frontend/src/state/ClusterStateContext.tsx
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  ReactNode
} from 'react';
import type {
  ClusterState,
  ClusterActions,
  ClusterContextValue,
  ConnectionStatus
} from '@/types';
import {
  GetContexts,
  GetNamespaces,
  GetConnectionStatus,
  SetCurrentContext,
  SetCurrentNamespaces,
} from '@/wailsjs/go/main/App';

// Action types
type ClusterAction =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_CONTEXTS'; contexts: string[] }
  | { type: 'SET_NAMESPACES'; namespaces: string[] }
  | { type: 'SET_SELECTED_CONTEXT'; context: string }
  | { type: 'SET_SELECTED_NAMESPACES'; namespaces: string[] }
  | { type: 'SET_CONNECTION_STATUS'; status: ConnectionStatus | null }
  | { type: 'SET_WIZARD_OPEN'; open: boolean };

const initialState: ClusterState = {
  contexts: [],
  namespaces: [],
  selectedContext: '',
  selectedNamespaces: [],
  loading: false,
  connectionStatus: null,
  wizardOpen: false,
  clusterConnected: false,
};

function reducer(state: ClusterState, action: ClusterAction): ClusterState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_CONTEXTS':
      return { ...state, contexts: action.contexts };
    case 'SET_NAMESPACES':
      return { ...state, namespaces: action.namespaces };
    case 'SET_SELECTED_CONTEXT':
      return {
        ...state,
        selectedContext: action.context,
        clusterConnected: !!(action.context && state.selectedNamespaces.length > 0),
      };
    case 'SET_SELECTED_NAMESPACES':
      return {
        ...state,
        selectedNamespaces: action.namespaces,
        clusterConnected: !!(state.selectedContext && action.namespaces.length > 0),
      };
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.status };
    case 'SET_WIZARD_OPEN':
      return { ...state, wizardOpen: action.open };
    default:
      return state;
  }
}

const ClusterStateContext = createContext<ClusterContextValue | null>(null);

interface ClusterStateProviderProps {
  children: ReactNode;
}

export function ClusterStateProvider({ children }: ClusterStateProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const actions: ClusterActions = useMemo(() => ({
    selectContext: async (context: string) => {
      dispatch({ type: 'SET_LOADING', loading: true });
      try {
        await SetCurrentContext(context);
        dispatch({ type: 'SET_SELECTED_CONTEXT', context });
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    },

    selectNamespaces: async (namespaces: string[]) => {
      dispatch({ type: 'SET_LOADING', loading: true });
      try {
        await SetCurrentNamespaces(namespaces);
        dispatch({ type: 'SET_SELECTED_NAMESPACES', namespaces });
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    },

    reloadContexts: async () => {
      try {
        const contexts = await GetContexts();
        dispatch({ type: 'SET_CONTEXTS', contexts: contexts ?? [] });
      } catch {
        dispatch({ type: 'SET_CONTEXTS', contexts: [] });
      }
    },

    reloadNamespaces: async () => {
      try {
        const namespaces = await GetNamespaces();
        dispatch({ type: 'SET_NAMESPACES', namespaces: namespaces ?? [] });
      } catch {
        dispatch({ type: 'SET_NAMESPACES', namespaces: [] });
      }
    },

    openWizard: () => dispatch({ type: 'SET_WIZARD_OPEN', open: true }),
    closeWizard: () => dispatch({ type: 'SET_WIZARD_OPEN', open: false }),

    refreshConnectionStatus: async () => {
      try {
        const status = await GetConnectionStatus();
        dispatch({ type: 'SET_CONNECTION_STATUS', status });
      } catch {
        dispatch({ type: 'SET_CONNECTION_STATUS', status: null });
      }
    },
  }), []);

  const value: ClusterContextValue = useMemo(() => ({
    ...state,
    actions,
  }), [state, actions]);

  return (
    <ClusterStateContext.Provider value={value}>
      {children}
    </ClusterStateContext.Provider>
  );
}

export function useClusterState(): ClusterContextValue {
  const context = useContext(ClusterStateContext);
  if (!context) {
    throw new Error('useClusterState must be used within ClusterStateProvider');
  }
  return context;
}
```

#### Benefits

```typescript
// Before: No type checking, any shape accepted
const { selectedContext, actions } = useClusterState();
actions.wrongMethod(); // No error until runtime

// After: Full type safety
const { selectedContext, actions } = useClusterState();
actions.wrongMethod(); // TS Error: Property 'wrongMethod' does not exist
actions.selectContext('default'); // ✓ Typed, autocomplete available
```

---

## Part 6: Component Prop Interfaces

### 6.1 GenericResourceTable Props

**Priority**: HIGH
**Effort**: 1 day
**Risk**: Low

#### Implementation

**Convert**: `frontend/src/components/GenericResourceTable/index.jsx` → `index.tsx`

```typescript
// frontend/src/components/GenericResourceTable/index.tsx
import React from 'react';
import type {
  ColumnDef,
  TabDef,
  PanelAPI,
  RowAction,
  AnalyzeFunction
} from '@/types';
import { useResourceData } from '@/hooks/useResourceData';
import { useHolmesAnalysis } from '@/hooks/useHolmesAnalysis';
import { OverviewTableWithPanel } from '@/layout/overview/OverviewTableWithPanel';

interface GenericResourceTableProps<T extends Record<string, unknown>> {
  // Required props
  resourceType: string;
  resourceKind: string;
  columns: ColumnDef<T>[];
  tabs: TabDef[];
  title: string;

  // Data fetching
  fetchFn: (namespace: string) => Promise<T[]>;
  eventName: string;
  normalize?: (data: unknown) => T;

  // Optional props
  namespaces?: string[];
  namespace?: string;
  clusterScoped?: boolean;
  tableTestId?: string;
  headerActions?: React.ReactNode;

  // Panel rendering
  renderPanelContent: (row: T, tab: string, panelApi: PanelAPI) => React.ReactNode;
  getRowActionsConfig?: (row: T) => RowAction<T>[];

  // Holmes integration
  analyzeFn?: AnalyzeFunction;
  holmesKeyPrefix?: string;

  // Resource operations
  onRestart?: (namespace: string, name: string) => Promise<void>;
  onDelete?: (namespace: string, name: string) => Promise<void>;
  onScale?: (namespace: string, name: string, replicas: number) => Promise<void>;

  // Create resource
  createPlatform?: 'k8s' | 'swarm';
  createKind?: string;
  createButtonTitle?: string;
  createNotice?: string;
  createHint?: string;

  // Tab counts
  tabCountsFetcher?: (row: T) => Promise<Record<string, number>>;
  enableTabCounts?: boolean;
}

export function GenericResourceTable<T extends Record<string, unknown>>({
  resourceType,
  resourceKind,
  columns,
  tabs,
  title,
  fetchFn,
  eventName,
  normalize,
  namespaces,
  namespace,
  clusterScoped = false,
  tableTestId,
  headerActions,
  renderPanelContent,
  getRowActionsConfig,
  analyzeFn,
  holmesKeyPrefix,
  onRestart,
  onDelete,
  onScale,
  createPlatform = 'k8s',
  createKind,
  createButtonTitle,
  createNotice,
  createHint,
  tabCountsFetcher,
  enableTabCounts = true,
}: GenericResourceTableProps<T>): React.ReactElement {
  const { data, loading, refresh } = useResourceData<unknown, T>({
    fetchFn,
    eventName,
    namespaces,
    namespace,
    normalize,
    clusterScoped,
    enabled: true,
  });

  const { state: holmesState, analyze, cancel, reset } = useHolmesAnalysis({
    kind: resourceKind,
    analyzeFn: analyzeFn ?? (async () => {}),
    keyPrefix: holmesKeyPrefix,
  });

  const getRowActions = React.useCallback((row: T): RowAction<T>[] => {
    if (!getRowActionsConfig) return [];
    return getRowActionsConfig(row);
  }, [getRowActionsConfig]);

  const panelApi: PanelAPI = React.useMemo(() => ({
    closePanel: () => {},
    refreshData: refresh,
    namespace,
  }), [refresh, namespace]);

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={data}
      loading={loading}
      tabs={tabs}
      renderPanelContent={(row, tab) => renderPanelContent(row as T, tab, panelApi)}
      title={title}
      resourceKind={resourceKind}
      namespace={namespace}
      tableTestId={tableTestId}
      headerActions={headerActions}
      getRowActions={(row) => getRowActions(row as T)}
      tabCountsFetcher={tabCountsFetcher}
      enableTabCounts={enableTabCounts}
      createPlatform={createPlatform}
      createKind={createKind}
      createButtonTitle={createButtonTitle}
      createNotice={createNotice}
      createHint={createHint}
      holmesState={holmesState}
      onHolmesAnalyze={analyze}
      onHolmesCancel={cancel}
      onHolmesReset={reset}
    />
  );
}
```

### 6.2 OverviewTableWithPanel Props

**Convert**: `frontend/src/layout/overview/OverviewTableWithPanel.jsx` → `OverviewTableWithPanel.tsx`

```typescript
// frontend/src/layout/overview/OverviewTableWithPanel.tsx
import React from 'react';
import type { ColumnDef, TabDef, RowAction, HolmesState, TabCounts } from '@/types';

interface OverviewTableWithPanelProps<T = Record<string, unknown>> {
  // Table data
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;

  // Panel configuration
  tabs: TabDef[];
  renderPanelContent: (row: T, tab: string) => React.ReactNode;
  panelHeader?: (row: T) => React.ReactNode;

  // Metadata
  title: string;
  resourceKind?: string;
  namespace?: string;

  // Testing
  tableTestId?: string;

  // Header customization
  headerActions?: React.ReactNode;

  // Row actions
  getRowActions?: (row: T, api: { closePanel: () => void }) => RowAction<T>[];

  // Tab counts
  tabCountsFetcher?: (row: T) => Promise<TabCounts>;
  enableTabCounts?: boolean;

  // Create resource
  createPlatform?: 'k8s' | 'swarm';
  createKind?: string;
  createButtonTitle?: string;
  createNotice?: string;
  createHint?: string;

  // Holmes integration
  holmesState?: HolmesState;
  onHolmesAnalyze?: (...args: string[]) => Promise<void>;
  onHolmesCancel?: () => Promise<void>;
  onHolmesReset?: () => void;
}

export function OverviewTableWithPanel<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  tabs,
  renderPanelContent,
  panelHeader,
  title,
  resourceKind,
  namespace,
  tableTestId,
  headerActions,
  getRowActions,
  tabCountsFetcher,
  enableTabCounts = true,
  createPlatform = 'k8s',
  createKind,
  createButtonTitle,
  createNotice,
  createHint,
  holmesState,
  onHolmesAnalyze,
  onHolmesCancel,
  onHolmesReset,
}: OverviewTableWithPanelProps<T>): React.ReactElement {
  // Implementation...
}
```

### 6.3 BaseModal Props

**Already defined in types**, implementation:

```typescript
// frontend/src/components/BaseModal/index.tsx
import React from 'react';
import type { BaseModalProps, ModalButtonProps } from '@/types';
import './BaseModal.css';

export function BaseModal({
  isOpen,
  onClose,
  title,
  width = 640,
  children,
  footer,
}: BaseModalProps): React.ReactElement | null {
  if (!isOpen) return null;

  return (
    <div className="base-modal-overlay" onClick={onClose}>
      <div
        className="base-modal-container"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="base-modal-header">
            <h3>{title}</h3>
            <button className="base-modal-close" onClick={onClose}>×</button>
          </div>
        )}
        <div className="base-modal-content">{children}</div>
        {footer && <div className="base-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ModalButton({
  variant = 'default',
  className = '',
  ...props
}: ModalButtonProps): React.ReactElement {
  return (
    <button
      className={`base-modal-btn base-modal-btn-${variant} ${className}`}
      {...props}
    />
  );
}

export function ModalPrimaryButton(props: Omit<ModalButtonProps, 'variant'>): React.ReactElement {
  return <ModalButton variant="primary" {...props} />;
}

export function ModalDangerButton(props: Omit<ModalButtonProps, 'variant'>): React.ReactElement {
  return <ModalButton variant="danger" {...props} />;
}
```

---

## Part 7: Migration Strategy

### 7.1 Incremental Migration Path

TypeScript supports gradual adoption. Files can be converted one at a time:

```
Phase 1: Foundation (Week 1)
├── tsconfig.json
├── src/types/index.ts
├── src/types/resources.ts
├── wailsjs/ types already exist
└── Install @types packages

Phase 2: API Layer (Week 1)
├── src/k8s/resources/kubeApi.ts
├── src/docker/swarmApi.ts
└── Verify type imports work

Phase 3: Hooks (Week 2)
├── src/hooks/useHolmesAnalysis.ts
├── src/hooks/useResourceData.ts
├── src/hooks/useAsyncData.ts
└── src/hooks/useEventSubscription.ts

Phase 4: Resource Configs (Week 2-3)
├── src/config/resourceConfigs/createConfig.ts
├── src/config/resourceConfigs/deploymentConfig.tsx
├── src/config/resourceConfigs/statefulsetConfig.tsx
└── ... (12 total)

Phase 5: State Contexts (Week 3)
├── src/state/ClusterStateContext.tsx
├── src/state/createResourceContext.tsx
└── src/docker/SwarmStateContext.tsx

Phase 6: Components (Week 4-6)
├── src/components/GenericResourceTable/index.tsx
├── src/components/BaseModal/index.tsx
├── src/layout/overview/OverviewTableWithPanel.tsx
└── ... (gradual conversion)

Phase 7: Full Migration (Week 7+)
├── Rename remaining .jsx → .tsx
├── Enable strict mode incrementally
└── Add stricter checks
```

### 7.2 Strict Mode Progression

Start permissive, tighten over time:

```json
// Phase 1: Initial (permissive)
{
  "strict": false,
  "noImplicitAny": false,
  "strictNullChecks": false
}

// Phase 2: After core migration
{
  "strict": false,
  "noImplicitAny": true,
  "strictNullChecks": false
}

// Phase 3: After full migration
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true
}
```

---

## Part 8: Testing Requirements

### 8.1 Type Checking in CI

**Add to GitHub Actions**:

```yaml
# .github/workflows/ci.yml
jobs:
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd frontend && npm ci
      - run: cd frontend && npx tsc --noEmit
```

### 8.2 Unit Test Updates

Tests should verify types work correctly:

```typescript
// frontend/src/__tests__/useHolmesAnalysis.test.ts
import { renderHook, act } from '@testing-library/react-hooks';
import { useHolmesAnalysis } from '@/hooks/useHolmesAnalysis';
import type { HolmesState } from '@/types';

describe('useHolmesAnalysis', () => {
  it('returns correctly typed state', () => {
    const mockAnalyzeFn = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useHolmesAnalysis({
      kind: 'Deployment',
      analyzeFn: mockAnalyzeFn,
    }));

    // TypeScript ensures these properties exist
    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.response).toBeNull();
    expect(result.current.state.streamingText).toBe('');

    // These are typed functions
    expect(typeof result.current.analyze).toBe('function');
    expect(typeof result.current.cancel).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });
});
```

### 8.3 Coverage Requirements

| Component | Min Coverage |
|-----------|--------------|
| Type definitions | N/A (no runtime) |
| Typed hooks | 80% |
| Typed components | 70% |
| Typed configs | 70% |

---

## Implementation Schedule

### Week 1: Foundation

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | TypeScript configuration | tsconfig.json, vite config updates |
| 1 | Install dependencies | @types/react, @types/react-dom, typescript |
| 2 | Core type definitions | src/types/index.ts, src/types/resources.ts |
| 3 | API layer conversion | kubeApi.ts, swarmApi.ts |
| 4-5 | Hook conversions | useHolmesAnalysis.ts, useResourceData.ts, useAsyncData.ts |

### Week 2: Resource Configs

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Create config factory | createConfig.ts with common columns/tabs |
| 2-3 | Convert K8s configs | 8 K8s resource configs |
| 4-5 | Convert Swarm configs | 4 Swarm resource configs |

### Week 3: State & Components

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | State contexts | ClusterStateContext.tsx, SwarmStateContext.tsx |
| 3 | GenericResourceTable | Full TypeScript conversion |
| 4 | OverviewTableWithPanel | Props interface, conversion |
| 5 | BaseModal | TypeScript with variants |

### Week 4-6: Gradual Migration

| Week | Task | Deliverable |
|------|------|-------------|
| 4 | K8s resource components | Convert high-traffic components |
| 5 | Swarm resource components | Convert all Swarm tables |
| 6 | Modal components | Convert all modals |

### Week 7+: Strict Mode

| Task | Deliverable |
|------|-------------|
| Enable noImplicitAny | Fix all any usages |
| Enable strictNullChecks | Fix null handling |
| Enable full strict mode | Complete type coverage |

---

## Success Metrics

### Code Reduction
- [ ] ~200 lines saved through generic resource configs
- [ ] ~100 lines saved through common type definitions
- [ ] ~50 lines of JSDoc documentation eliminated

### Type Coverage
- [ ] 100% of API bindings typed
- [ ] 100% of hooks typed
- [ ] 100% of state contexts typed
- [ ] 100% of resource configs typed
- [ ] 80%+ of components typed

### Quality
- [ ] Zero `any` in strict mode
- [ ] All E2E tests pass
- [ ] All unit tests pass
- [ ] tsc --noEmit succeeds in CI

### Developer Experience
- [ ] IDE autocomplete for all Wails API calls
- [ ] Compile-time error for missing props
- [ ] Type-safe refactoring across codebase

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Build breaks during migration | Medium | High | Incremental migration, .jsx files still work |
| Type errors in edge cases | Medium | Medium | Start with `strict: false`, tighten gradually |
| Team learning curve | Low | Medium | TypeScript is standard, good documentation |
| Third-party lib type issues | Low | Low | `@types/*` packages available for most libs |
| Performance regression | Very Low | Low | TypeScript compiles away, no runtime impact |

---

## Appendix: File Conversion Checklist

### Priority 1: Core Infrastructure
```
[ ] frontend/tsconfig.json (create)
[ ] frontend/vite.config.js (update aliases)
[ ] frontend/src/types/index.ts (create)
[ ] frontend/src/types/resources.ts (create)
```

### Priority 2: API Layer
```
[ ] frontend/src/k8s/resources/kubeApi.js → kubeApi.ts
[ ] frontend/src/docker/swarmApi.js → swarmApi.ts
```

### Priority 3: Hooks
```
[ ] frontend/src/hooks/useHolmesAnalysis.js → useHolmesAnalysis.ts
[ ] frontend/src/hooks/useResourceData.js → useResourceData.ts
[ ] frontend/src/hooks/useAsyncData.js → useAsyncData.ts
[ ] frontend/src/hooks/useEventSubscription.js → useEventSubscription.ts
```

### Priority 4: Resource Configs
```
[ ] frontend/src/config/resourceConfigs/createConfig.ts (create)
[ ] frontend/src/config/resourceConfigs/deploymentConfig.jsx → .tsx
[ ] frontend/src/config/resourceConfigs/statefulsetConfig.jsx → .tsx
[ ] frontend/src/config/resourceConfigs/daemonsetConfig.jsx → .tsx
[ ] frontend/src/config/resourceConfigs/podConfig.jsx → .tsx
[ ] frontend/src/config/resourceConfigs/serviceConfig.jsx → .tsx
[ ] frontend/src/config/resourceConfigs/configmapConfig.jsx → .tsx
[ ] frontend/src/config/resourceConfigs/secretConfig.jsx → .tsx
[ ] frontend/src/config/resourceConfigs/ingressConfig.jsx → .tsx
[ ] frontend/src/config/resourceConfigs/jobConfig.jsx → .tsx
[ ] frontend/src/config/resourceConfigs/cronjobConfig.jsx → .tsx
[ ] frontend/src/config/resourceConfigs/replicasetConfig.jsx → .tsx
[ ] frontend/src/config/resourceConfigs/pvConfig.jsx → .tsx
[ ] frontend/src/config/resourceConfigs/pvcConfig.jsx → .tsx
[ ] frontend/src/config/resourceConfigs/swarm/*.jsx → .tsx (4 files)
```

### Priority 5: State Contexts
```
[ ] frontend/src/state/ClusterStateContext.jsx → .tsx
[ ] frontend/src/state/createResourceContext.jsx → .tsx
[ ] frontend/src/docker/SwarmStateContext.jsx → .tsx
```

### Priority 6: Core Components
```
[ ] frontend/src/components/GenericResourceTable/index.jsx → .tsx
[ ] frontend/src/components/BaseModal/index.jsx → .tsx
[ ] frontend/src/layout/overview/OverviewTableWithPanel.jsx → .tsx
```

### Priority 7: Resource Tables (22 files)
```
K8s:
[ ] frontend/src/k8s/resources/pods/PodOverviewTable.jsx → .tsx
[ ] frontend/src/k8s/resources/deployments/DeploymentsOverviewTable.jsx → .tsx
... (13 more K8s tables)

Swarm:
[ ] frontend/src/docker/resources/services/SwarmServicesOverviewTable.jsx → .tsx
... (7 more Swarm tables)
```

### Priority 8: Modals (17 files)
```
[ ] frontend/src/components/BaseModal/index.jsx → .tsx
[ ] frontend/src/CreateManifestOverlay.jsx → .tsx
... (15 more modals)
```

---

## Relationship to Existing Codebase Reduction Plan

This TSX migration plan **complements** the existing [codebase-reduction-implementation-plan.md](codebase-reduction-implementation-plan.md):

| Existing Plan Item | TSX Enhancement |
|-------------------|-----------------|
| GenericResourceTable | Add full prop typing, generic `<T>` support |
| useHolmesAnalysis hook | Convert to TypeScript with strict typing |
| useAsyncData hook | Convert to TypeScript with generic return type |
| BaseModal component | Add typed props, variant types |
| Resource configs | Add generic `ResourceConfig<T>` interface |
| State contexts | Add full state and action typing |

The TSX migration should be executed **after** or **in parallel with** the codebase reduction work, as typed generics will make the consolidated components even more maintainable.
