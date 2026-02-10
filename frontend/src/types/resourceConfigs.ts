import type { ReactNode } from 'react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';

export type LooseRecord = Record<string, unknown>;

export interface ResourceRow {
  name?: string;
  namespace?: string;
  id?: string;
  [key: string]: unknown;
}

export interface ResourceColumn {
  key: string;
  label: string;
  accessorKey?: string;
  accessorFn?: (_row: ResourceRow) => any;
  cell?: (_props: { getValue: () => any; row?: { original?: ResourceRow } }) => ReactNode;
  enableSorting?: boolean;
  size?: number;
  width?: string | number;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ResourceTab {
  key: string;
  label: string;
  countKey?: string;
  countable?: boolean;
  icon?: ReactNode;
  [key: string]: unknown;
}

export interface PanelApi {
  openDetails?: (_tabKey?: string) => void;
  setActiveTab?: (_tabKey: string) => void;
  refresh?: () => void;
}

export interface RowAction {
  label: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  danger?: boolean;
  icon?: ReactNode;
}

export interface HolmesHelpers {
  holmesState: HolmesAnalysisState;
  analyze: (..._args: unknown[]) => Promise<{ ok: boolean; error?: string }>;
  cancel: () => void;
}

export type RenderPanelContent = (..._args: any[]) => ReactNode;

export interface ResourceConfig {
  resourceType: string;
  resourceKind: string;
  columns: ResourceColumn[];
  tabs: ResourceTab[];
  fetchFn: (..._args: any[]) => unknown;
  eventName: string;
  analyzeFn?: (..._args: any[]) => unknown;
  holmesKeyPrefix?: string;
  normalize?: (_item: any, ..._args: any[]) => ResourceRow;
  renderPanelContent: RenderPanelContent;
  getRowActions?: (_row: ResourceRow, _api: PanelApi, _helpers: HolmesHelpers) => RowAction[];
  onRestart?: (_name: string, _namespace?: string) => Promise<void>;
  onDelete?: (_name: string, _namespace?: string) => Promise<void>;
  onScale?: (_namespace: string | undefined, _name: string, _replicas: number) => Promise<void>;
  title?: string;
  tableTestId?: string;
  headerActions?: ReactNode;
  namespaces?: string[];
  namespace?: string;
  clusterScoped?: boolean;
  createPlatform?: 'k8s' | 'swarm';
  createKind?: string;
  createButtonTitle?: string;
  createNotice?: string | { message: string; type?: 'success' | 'error' | 'warning'; duration?: number };
  createHint?: string;
  tabCountsFetcher?: (_row: ResourceRow) => unknown;
  enableTabCounts?: boolean;
}
