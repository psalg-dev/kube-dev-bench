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

/**
 * GenericResourceTable - Reusable resource table with data fetching and Holmes integration
 * 
 * @param {Object} props - Component props
 * @param {string} props.resourceType - Resource type identifier (e.g., 'deployment', 'pod')
 * @param {string} props.resourceKind - Kubernetes resource kind (e.g., 'Deployment', 'Pod')
 * @param {Array<Object>} props.columns - Column definitions array
 * @param {Array<Object>} props.tabs - Bottom panel tab definitions
 * @param {Function} props.fetchFn - Function to fetch resource data
 * @param {string} props.eventName - Wails event name for live updates
 * @param {Function} [props.analyzeFn] - Optional Holmes analysis function
 * @param {Function} props.renderPanelContent - Function to render panel tab content
 * @param {Function} [props.getRowActions] - Optional function to get row-specific actions
 * @param {Function} [props.normalize] - Optional function to normalize data items
 * @param {Array<string>} [props.namespaces] - Array of namespaces to fetch from
 * @param {string} [props.namespace] - Single namespace
 * @param {boolean} [props.clusterScoped=false] - If true, fetches without namespace
 * @param {string} [props.title] - Table title (defaults to resourceKind + 's')
 * @param {string} [props.tableTestId] - Optional test id for the table
 * @param {React.ReactNode} [props.headerActions] - Optional header actions
 * @param {'k8s'|'swarm'} [props.createPlatform='k8s'] - Platform for create overlay
 * @param {string} [props.createKind] - Kind for create overlay
 * @param {string} [props.createButtonTitle] - Create button tooltip
 * @param {Function} [props.onRestart] - Optional restart handler
 * @param {Function} [props.onDelete] - Optional delete handler
 * @param {Function} [props.onScale] - Optional scale handler
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
}) {
  // Fetch and subscribe to resource data
  const { data, loading } = useResourceData({
    fetchFn,
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
    analyzeFn: hasHolmes ? analyzeFn : async () => {},
  });
  
  // Wrapper for panel content rendering that injects Holmes state
  const renderPanelContentWithHolmes = useCallback((row, tab, panelApi) => {
    if (typeof renderPanelContent !== 'function') {
      return null;
    }
    return renderPanelContent(row, tab, holmesState, analyze, cancel, panelApi);
  }, [renderPanelContent, holmesState, analyze, cancel]);
  
  // Build row actions with Holmes integration
  const getRowActions = useCallback((row, api) => {
    const actions = [];
    const key = `${row.namespace || ''}/${row.name}`;
    const isAnalyzing = holmesState.loading && holmesState.key === key;
    
    // Holmes action (if analysis function provided)
    if (hasHolmes) {
      actions.push({
        label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
        icon: '🧠',
        disabled: isAnalyzing,
        onClick: () => {
          analyze(row.namespace, row.name);
          api?.openDetails?.('holmes');
        },
      });
    }
    
    // Restart action
    if (typeof onRestart === 'function') {
      actions.push({
        label: 'Restart',
        icon: '🔄',
        onClick: async () => {
          try {
            await onRestart(row.name, row.namespace);
            showSuccess(`${resourceKind} '${row.name}' restarted`);
          } catch (err) {
            showError(`Failed to restart ${resourceKind.toLowerCase()} '${row.name}': ${err?.message || err}`);
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
          const count = prompt(`Scale ${row.name} to how many replicas?`, String(row.replicas || 1));
          if (count === null) return;
          const num = parseInt(count, 10);
          if (isNaN(num) || num < 0) {
            showError('Invalid replica count');
            return;
          }
          try {
            await onScale(row.namespace, row.name, num);
            showSuccess(`${resourceKind} '${row.name}' scaled to ${num}`);
          } catch (err) {
            showError(`Failed to scale ${resourceKind.toLowerCase()} '${row.name}': ${err?.message || err}`);
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
          try {
            await onDelete(row.name, row.namespace);
            showSuccess(`${resourceKind} '${row.name}' deleted`);
          } catch (err) {
            showError(`Failed to delete ${resourceKind.toLowerCase()} '${row.name}': ${err?.message || err}`);
          }
        },
      });
    }
    
    // Custom row actions from config
    if (typeof getRowActionsConfig === 'function') {
      const customActions = getRowActionsConfig(row, api, { holmesState, analyze, cancel });
      if (Array.isArray(customActions)) {
        actions.push(...customActions);
      }
    }
    
    return actions;
  }, [
    hasHolmes, holmesState, analyze, cancel, resourceKind,
    onRestart, onDelete, onScale, getRowActionsConfig,
  ]);
  
  return (
    <OverviewTableWithPanel
      columns={columns}
      data={data}
      tabs={tabs}
      renderPanelContent={renderPanelContentWithHolmes}
      panelHeader={(row) => <span style={{ fontWeight: 600 }}>{row.name}</span>}
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
    />
  );
}

export default GenericResourceTable;
