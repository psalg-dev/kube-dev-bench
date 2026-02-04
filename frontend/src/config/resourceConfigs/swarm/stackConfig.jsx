import {
  GetSwarmStackResources,
  GetSwarmStackServices,
  GetSwarmStacks,
  RemoveSwarmStack,
} from '../../../docker/swarmApi';
import { AnalyzeSwarmStackStream } from '../../../holmes/holmesApi';
import { showSuccess, showError } from '../../../notification';
import StackServicesTab from '../../../docker/resources/stacks/StackServicesTab';
import StackResourcesTab from '../../../docker/resources/stacks/StackResourcesTab';
import StackComposeTab from '../../../docker/resources/stacks/StackComposeTab';
import StackSummaryPanel from '../../../docker/resources/stacks/StackSummaryPanel';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel';

/**
 * Column definitions for Swarm stacks table
 */
export const swarmStackColumns = [
  { key: 'name', label: 'Name' },
  { key: 'services', label: 'Services' },
  { key: 'orchestrator', label: 'Orchestrator' },
];

/**
 * Tab definitions for Swarm stacks
 */
export const swarmStackTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'services', label: 'Services', countKey: 'services' },
  { key: 'networks', label: 'Networks', countKey: 'networks' },
  { key: 'volumes', label: 'Volumes', countKey: 'volumes' },
  { key: 'configs', label: 'Configs', countKey: 'configs' },
  { key: 'secrets', label: 'Secrets', countKey: 'secrets' },
  { key: 'compose', label: 'Compose File', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

/**
 * Normalize swarm stack data from API response
 */
export const normalizeSwarmStack = (stack) => ({
  name: stack.name ?? stack.Name,
  services: stack.services ?? stack.Services ?? 0,
  orchestrator: stack.orchestrator ?? stack.Orchestrator ?? '-',
});

/**
 * Fetch tab counts for a stack row
 */
export const fetchSwarmStackTabCounts = async (row) => {
  if (!row?.name) return {};
  const [services, resources] = await Promise.all([
    GetSwarmStackServices(row.name),
    GetSwarmStackResources(row.name),
  ]);
  const res = resources || {};
  return {
    services: Array.isArray(services) ? services.length : 0,
    networks: Array.isArray(res.networks) ? res.networks.length : 0,
    volumes: Array.isArray(res.volumes) ? res.volumes.length : 0,
    configs: Array.isArray(res.configs) ? res.configs.length : 0,
    secrets: Array.isArray(res.secrets) ? res.secrets.length : 0,
  };
};

/**
 * Render panel content for each tab
 */
export const renderSwarmStackPanelContent = (row, tab, holmesState, onAnalyze, onCancel, panelApi) => {
  if (tab === 'summary') {
    return <StackSummaryPanel row={row} onRefresh={panelApi?.refresh} />;
  }

  if (tab === 'services') {
    return <StackServicesTab stackName={row.name} />;
  }

  if (tab === 'networks') {
    return <StackResourcesTab stackName={row.name} resource="networks" />;
  }

  if (tab === 'volumes') {
    return <StackResourcesTab stackName={row.name} resource="volumes" />;
  }

  if (tab === 'configs') {
    return <StackResourcesTab stackName={row.name} resource="configs" />;
  }

  if (tab === 'secrets') {
    return <StackResourcesTab stackName={row.name} resource="secrets" />;
  }

  if (tab === 'compose') {
    return <StackComposeTab stackName={row.name} />;
  }

  if (tab === 'holmes') {
    const key = `swarm/${row.name}`;
    return (
      <HolmesBottomPanel
        resourceType="Swarm Stack"
        resourceName={row.name}
        onAnalyze={() => onAnalyze?.(row)}
        onCancel={holmesState.key === key && holmesState.streamId ? onCancel : null}
        response={holmesState.key === key ? holmesState.response : null}
        loading={holmesState.key === key && holmesState.loading}
        error={holmesState.key === key ? holmesState.error : null}
        streamingText={holmesState.key === key ? holmesState.streamingText : ''}
        reasoningText={holmesState.key === key ? holmesState.reasoningText : ''}
        contextSteps={holmesState.key === key ? holmesState.contextSteps : []}
        toolEvents={holmesState.key === key ? holmesState.toolEvents : []}
        queryTimestamp={holmesState.key === key ? holmesState.queryTimestamp : null}
      />
    );
  }

  return null;
};

/**
 * Get row actions for Swarm stack
 */
export const getSwarmStackRowActions = (row, api, { holmesState, analyze }) => {
  const isAnalyzing = holmesState?.loading && holmesState?.key === `swarm/${row.name}`;

  return [
    {
      label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
      icon: '🧠',
      disabled: isAnalyzing,
      onClick: () => {
        analyze?.(row);
        api?.openDetails?.('holmes');
      },
    },
    {
      label: 'Delete',
      icon: '🗑️',
      danger: true,
      onClick: async () => {
        if (!window.confirm(`Delete stack "${row.name}"?`)) return;
        try {
          await RemoveSwarmStack(row.name);
          showSuccess(`Removed stack "${row.name}"`);
          api?.refresh?.();
        } catch (err) {
          showError(`Failed to remove stack: ${err}`);
        }
      },
    },
  ];
};

/**
 * Swarm Stack configuration for GenericResourceTable
 */
export const swarmStackConfig = {
  resourceType: 'swarm-stack',
  resourceKind: 'Stack',
  title: 'Swarm Stacks',
  columns: swarmStackColumns,
  tabs: swarmStackTabs,
  fetchFn: GetSwarmStacks,
  eventName: 'swarm:stacks:update',
  normalize: normalizeSwarmStack,
  renderPanelContent: renderSwarmStackPanelContent,
  getRowActions: getSwarmStackRowActions,
  analyzeFn: AnalyzeSwarmStackStream,
  holmesKeyPrefix: 'swarm',
  tabCountsFetcher: fetchSwarmStackTabCounts,
  enableTabCounts: true,
  clusterScoped: true,
  createPlatform: 'swarm',
  createKind: 'stack',
  createButtonTitle: 'Deploy stack (Compose YAML)',
  tableTestId: 'swarm-stacks-table',
};
