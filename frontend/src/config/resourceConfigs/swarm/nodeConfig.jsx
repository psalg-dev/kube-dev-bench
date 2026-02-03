import {
  GetSwarmNodes,
  GetSwarmNodeTasks,
  UpdateSwarmNodeAvailability,
  UpdateSwarmNodeRole,
  RemoveSwarmNode,
} from '../../../docker/swarmApi';
import { AnalyzeSwarmNodeStream } from '../../../holmes/holmesApi';
import { showSuccess, showError } from '../../../notification';
import StatusBadge from '../../../components/StatusBadge';
import NodeTasksTab from '../../../docker/resources/nodes/NodeTasksTab';
import NodeLabelsTab from '../../../docker/resources/nodes/NodeLabelsTab';
import NodeLogsTab from '../../../docker/resources/nodes/NodeLogsTab';
import { NodeSummaryPanel } from '../../../docker/resources/nodes/NodeSummaryPanel';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel';

/**
 * Column definitions for Swarm nodes table
 */
export const swarmNodeColumns = [
  {
    key: 'hostname',
    label: 'Hostname',
  },
  {
    key: 'role',
    label: 'Role',
    cell: (info) => {
      const role = info.getValue();
      const isManager = role === 'manager';
      return (
        <span style={{ color: isManager ? '#58a6ff' : 'inherit', fontWeight: isManager ? 500 : 400 }}>
          {role}
        </span>
      );
    },
  },
  {
    key: 'availability',
    label: 'Availability',
    cell: (info) => <StatusBadge status={info.getValue() || '-'} size="small" />,
  },
  {
    key: 'state',
    label: 'State',
    cell: (info) => <StatusBadge status={info.getValue() || '-'} size="small" />,
  },
  {
    key: 'address',
    label: 'Address',
  },
  {
    key: 'engineVersion',
    label: 'Engine',
  },
  {
    key: 'leader',
    label: 'Leader',
    cell: (info) => (info.getValue() ? '✓' : ''),
  },
];

/**
 * Tab definitions for Swarm nodes
 */
export const swarmNodeTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'tasks', label: 'Tasks', countKey: 'tasks' },
  { key: 'logs', label: 'Logs' },
  { key: 'labels', label: 'Labels' },
  { key: 'holmes', label: 'Holmes' },
];

/**
 * Fetch tab counts for a node (tasks count)
 */
export const fetchSwarmNodeTabCounts = async (row) => {
  if (!row?.id) return {};
  const tasks = await GetSwarmNodeTasks(row.id);
  return {
    tasks: Array.isArray(tasks) ? tasks.length : 0,
  };
};

/**
 * Normalize Swarm node data from API response
 */
export const normalizeSwarmNode = (node) => ({
  id: node.id ?? node.ID,
  hostname: node.hostname ?? node.Hostname,
  role: node.role ?? node.Role,
  availability: node.availability ?? node.Availability,
  state: node.state ?? node.State,
  address: node.address ?? node.Address,
  engineVersion: node.engineVersion ?? node.EngineVersion,
  leader: node.leader ?? node.Leader,
  labels: node.labels ?? node.Labels ?? {},
  tls: node.tls ?? node.TLS,
  os: node.os ?? node.OS,
  arch: node.arch ?? node.Arch,
  nanoCpus: node.nanoCpus ?? node.NanoCPUs,
  memoryBytes: node.memoryBytes ?? node.MemoryBytes,
});

/**
 * Render panel content for each tab
 */
export const renderSwarmNodePanelContent = (row, tab, holmesState, onAnalyze, onCancel, panelApi) => {
  if (tab === 'summary') {
    return <NodeSummaryPanel row={row} onRefresh={panelApi?.refresh} />;
  }

  if (tab === 'tasks') {
    return <NodeTasksTab nodeId={row.id} nodeName={row.hostname} />;
  }

  if (tab === 'labels') {
    return (
      <NodeLabelsTab
        nodeId={row.id}
        initialLabels={row.labels || {}}
        onSaved={() => panelApi?.refresh?.()}
      />
    );
  }

  if (tab === 'logs') {
    return <NodeLogsTab nodeId={row.id} nodeName={row.hostname} />;
  }

  if (tab === 'holmes') {
    const key = `swarm/${row.id}`;
    return (
      <HolmesBottomPanel
        resourceType="Swarm Node"
        resourceName={row.hostname}
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
 * Get row actions for a node
 */
export const getSwarmNodeRowActions = (row, api, { holmesState, analyze }) => {
  const availability = String(row?.availability || '').toLowerCase();
  const role = String(row?.role || '').toLowerCase();
  const isLeader = Boolean(row?.leader);
  const isAnalyzing = holmesState?.loading && holmesState?.key === `swarm/${row.id}`;

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
      label: 'Drain',
      icon: '🚧',
      disabled: availability === 'drain',
      onClick: async () => {
        if (availability === 'drain') return;
        try {
          await UpdateSwarmNodeAvailability(row.id, 'drain');
          showSuccess(`Node ${row.hostname} set to drain`);
          api?.refresh?.();
        } catch (err) {
          showError(`Failed to drain node: ${err}`);
        }
      },
    },
    {
      label: 'Activate',
      icon: '✅',
      disabled: availability === 'active',
      onClick: async () => {
        if (availability === 'active') return;
        try {
          await UpdateSwarmNodeAvailability(row.id, 'active');
          showSuccess(`Node ${row.hostname} activated`);
          api?.refresh?.();
        } catch (err) {
          showError(`Failed to activate node: ${err}`);
        }
      },
    },
    {
      label: 'Promote…',
      icon: '⬆️',
      disabled: role !== 'worker',
      onClick: async () => {
        if (role !== 'worker') return;
        if (!window.confirm(`Promote node "${row.hostname}" to manager?`)) return;
        try {
          await UpdateSwarmNodeRole(row.id, 'manager');
          showSuccess(`Node ${row.hostname} promoted to manager`);
          api?.refresh?.();
        } catch (err) {
          showError(`Failed to promote node: ${err}`);
        }
      },
    },
    {
      label: 'Demote…',
      icon: '⬇️',
      disabled: role !== 'manager' || isLeader,
      onClick: async () => {
        if (role !== 'manager') return;
        if (isLeader) {
          showError('Cannot demote the current leader node');
          return;
        }
        if (!window.confirm(`Demote node "${row.hostname}" to worker?`)) return;
        try {
          await UpdateSwarmNodeRole(row.id, 'worker');
          showSuccess(`Node ${row.hostname} demoted to worker`);
          api?.refresh?.();
        } catch (err) {
          showError(`Failed to demote node: ${err}`);
        }
      },
    },
    {
      label: 'Remove',
      icon: '🗑️',
      danger: true,
      disabled: role === 'manager',
      onClick: async () => {
        if (role === 'manager') return;
        if (!window.confirm(`Remove node "${row.hostname}" from the swarm?`)) return;
        try {
          await RemoveSwarmNode(row.id, false);
          showSuccess(`Node ${row.hostname} removed`);
          api?.refresh?.();
        } catch (err) {
          showError(`Failed to remove node: ${err}`);
        }
      },
    },
  ];
};

/**
 * Swarm Node configuration for GenericResourceTable
 */
export const swarmNodeConfig = {
  resourceType: 'swarm-node',
  resourceKind: 'Node',
  title: 'Swarm Nodes',
  columns: swarmNodeColumns,
  tabs: swarmNodeTabs,
  fetchFn: GetSwarmNodes,
  eventName: 'swarm:nodes:update',
  normalize: normalizeSwarmNode,
  clusterScoped: true,
  renderPanelContent: renderSwarmNodePanelContent,
  getRowActions: getSwarmNodeRowActions,
  analyzeFn: AnalyzeSwarmNodeStream,
  holmesKeyPrefix: 'swarm',
  tabCountsFetcher: fetchSwarmNodeTabCounts,
  enableTabCounts: true,
  createPlatform: 'swarm',
  createKind: 'node',
  tableTestId: 'swarm-nodes-table',
};
