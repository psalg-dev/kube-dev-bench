/**
 * GenericResourceTable Component
 *
 * A factory component that wraps OverviewTableWithPanel with standardized
 * data fetching, Holmes integration, and event subscriptions.
 *
 * This component eliminates 2,000-3,000 lines of duplicated code across 22+
 * OverviewTable components by providing:
 * - Automatic data fetching via useResourceData hook
 * - Optional Holmes AI integration via useHolmesAnalysis hook
 * - Standardized row actions with resource-specific customization
 * - Consistent column and tab configuration
 *
 * @example
 * import { GenericResourceTable } from '@/components/GenericResourceTable';
 * import { deploymentConfig } from '@/config/resourceConfigs/deploymentConfig';
 *
 * export function DeploymentsOverviewTable({ namespaces, namespace }) {
 *   return (
 *     <GenericResourceTable
 *       {...deploymentConfig}
 *       namespaces={namespaces}
 *       namespace={namespace}
 *     />
 *   );
 * }
 */

import { useCallback } from 'react';
import OverviewTableWithPanel from '../../layout/overview/OverviewTableWithPanel';
import { useResourceData } from '../../hooks/useResourceData';
import { useHolmesAnalysis } from '../../hooks/useHolmesAnalysis';
import { showSuccess, showError } from '../../notification';
import type { ComponentType, ReactNode } from 'react';
import type { PanelApi, ResourceConfig, ResourceRow, RowAction, ResourceColumn, ResourceTab } from '../../types/resourceConfigs';

export type { ResourceConfig } from '../../types/resourceConfigs';

export interface GenericResourceTableProps extends ResourceConfig {
  namespaces?: string[];
  namespace?: string;
}

interface OverviewTableWithPanelProps {
  columns: ResourceColumn[];
  data: ResourceRow[];
  tabs: ResourceTab[];
  renderPanelContent: (_row: ResourceRow, _tab: string, _panelApi?: PanelApi) => ReactNode;
  panelHeader?: (_row: ResourceRow) => ReactNode;
  title: string;
  loading: boolean;
  resourceKind?: string;
  namespace?: string;
  createPlatform?: 'k8s' | 'swarm';
  createKind?: string;
  createButtonTitle?: string;
  createNotice?: string | { message: string; type?: 'success' | 'error' | 'warning'; duration?: number };
  createHint?: string;
  tableTestId?: string;
  headerActions?: ReactNode;
  getRowActions?: (_row: ResourceRow, _api?: PanelApi) => RowAction[];
  tabCountsFetcher?: (_row: ResourceRow) => Promise<Record<string, number>> | Record<string, number>;
  enableTabCounts?: boolean;
}

const OverviewTableWithPanelTyped = OverviewTableWithPanel as unknown as ComponentType<OverviewTableWithPanelProps>;

/**
 * GenericResourceTable - Reusable resource table with data fetching and Holmes integration
 */
export function GenericResourceTable({
  // Resource identification
  resourceType,
  resourceKind,

  // Table configuration
  columns,
  tabs,
  title,
  tableTestId,
  headerActions,

  // Data fetching
  fetchFn,
  eventName,
  normalize,
  namespaces,
  namespace,
  clusterScoped = false,

  // Holmes integration
  analyzeFn,
  holmesKeyPrefix,

  // Panel rendering
  renderPanelContent,

  // Row actions
  getRowActions: getRowActionsConfig,
  onRestart,
  onDelete,
  onScale,

  // Create overlay
  createPlatform = 'k8s',
  createKind,
  createButtonTitle,
  createNotice,
  createHint,

  // Tab counts
  tabCountsFetcher,
  enableTabCounts = true,
}: GenericResourceTableProps) {
  // Fetch and subscribe to resource data
  const { data, loading } = useResourceData({
    fetchFn: fetchFn as (...args: any[]) => Promise<any[]>,
    eventName,
    namespaces,
    namespace,
    normalize,
    clusterScoped,
  });

  // Holmes AI integration (optional)
  const hasHolmes = typeof analyzeFn === 'function';
  const { state: holmesState, analyze, cancel } = useHolmesAnalysis({
    kind: resourceKind,
    analyzeFn: hasHolmes ? (analyzeFn as (...args: string[]) => Promise<void>) : async () => {},
    keyPrefix: holmesKeyPrefix,
  });

  // Wrapper for panel content rendering that injects Holmes state and full data
  const renderPanelContentWithHolmes = useCallback(
    (row: ResourceRow, tab: string, panelApi?: PanelApi) => {
      if (typeof renderPanelContent !== 'function') {
        return null;
      }
      return renderPanelContent(row, tab, holmesState, analyze, cancel, panelApi, data);
    },
    [renderPanelContent, holmesState, analyze, cancel, data]
  );

  // Build row actions with Holmes integration
  const getRowActions = useCallback(
    (row: ResourceRow, api?: PanelApi) => {
      const actions: RowAction[] = [];
      const key = `${row.namespace || ''}/${row.name}`;
      const isAnalyzing = holmesState.loading && holmesState.key === key;
      const panelApi = api ?? {};

      // Holmes action (if analysis function provided)
      if (hasHolmes) {
        actions.push({
          label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
          icon: '🧠',
          disabled: isAnalyzing,
          onClick: () => {
            analyze(row.namespace, row.name);
            panelApi?.openDetails?.('holmes');
          },
        });
      }

      // Restart action
      if (typeof onRestart === 'function') {
        actions.push({
          label: 'Restart',
          icon: '🔄',
          onClick: async () => {
            if (!row.name) {
              showError(`Missing ${resourceKind.toLowerCase()} name`);
              return;
            }
            try {
              await onRestart(row.name, row.namespace);
              showSuccess(`${resourceKind} '${row.name}' restarted`);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              showError(`Failed to restart ${resourceKind.toLowerCase()} '${row.name}': ${message}`);
            }
          },
        });
      }

      // Scale action
      if (typeof onScale === 'function') {
        actions.push({
          label: 'Scale',
          icon: '📊',
          onClick: async () => {
            if (!row.name) {
              showError(`Missing ${resourceKind.toLowerCase()} name`);
              return;
            }
            const count = prompt(`Scale ${row.name} to how many replicas?`, String(row.replicas || 1));
            if (count === null) return;
            const num = parseInt(count, 10);
            if (Number.isNaN(num) || num < 0) {
              showError('Invalid replica count');
              return;
            }
            try {
              await onScale(row.namespace, row.name, num);
              showSuccess(`${resourceKind} '${row.name}' scaled to ${num}`);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              showError(`Failed to scale ${resourceKind.toLowerCase()} '${row.name}': ${message}`);
            }
          },
        });
      }

      // Delete action
      if (typeof onDelete === 'function') {
        actions.push({
          label: 'Delete',
          icon: '🗑️',
          danger: true,
          onClick: async () => {
            if (!row.name) {
              showError(`Missing ${resourceKind.toLowerCase()} name`);
              return;
            }
            try {
              await onDelete(row.name, row.namespace);
              showSuccess(`${resourceKind} '${row.name}' deleted`);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              showError(`Failed to delete ${resourceKind.toLowerCase()} '${row.name}': ${message}`);
            }
          },
        });
      }

      // Custom row actions from config
      if (typeof getRowActionsConfig === 'function') {
        const customActions = getRowActionsConfig(row, panelApi, { holmesState, analyze, cancel });
        if (Array.isArray(customActions)) {
          actions.push(...customActions);
        }
      }

      return actions;
    },
    [
      hasHolmes,
      holmesState,
      analyze,
      cancel,
      resourceKind,
      onRestart,
      onDelete,
      onScale,
      getRowActionsConfig,
    ]
  );

  return (
    <OverviewTableWithPanelTyped
      columns={columns}
      data={data}
      tabs={tabs}
      renderPanelContent={renderPanelContentWithHolmes}
      panelHeader={(row: ResourceRow) => <span style={{ fontWeight: 600 }}>{row.name}</span>}
      title={title || `${resourceKind}s`}
      loading={loading}
      resourceKind={resourceKind}
      namespace={namespace}
      createPlatform={createPlatform}
      createKind={createKind || resourceType}
      createButtonTitle={createButtonTitle}
      createNotice={createNotice}
      createHint={createHint}
      tableTestId={tableTestId}
      headerActions={headerActions}
      getRowActions={getRowActions}
      tabCountsFetcher={tabCountsFetcher as ((row: ResourceRow) => Promise<Record<string, number>> | Record<string, number>)}
      enableTabCounts={enableTabCounts}
    />
  );
}

export default GenericResourceTable;
