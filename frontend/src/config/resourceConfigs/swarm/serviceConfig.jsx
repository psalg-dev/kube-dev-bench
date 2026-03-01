/**
 * Swarm Service Resource Configuration
 * 
 * Configuration for GenericResourceTable to display Docker Swarm Services.
 */

import {
  GetSwarmServices,
  GetSwarmTasksByService,
  ScaleSwarmService,
  RemoveSwarmService,
  RestartSwarmService,
} from '../../../docker/swarmApi';
import { AnalyzeSwarmServiceStream } from '../../../holmes/holmesApi';
import ServiceSummaryPanel from '../../../docker/resources/services/ServiceSummaryPanel';
import ServicePlacementTab from '../../../docker/resources/services/ServicePlacementTab';
import ServiceTasksTab from '../../../docker/resources/services/ServiceTasksTab';
import AggregateLogsTab from '../../../components/AggregateLogsTab';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel';
import ImageUpdateBadge from '../../../docker/resources/services/ImageUpdateBadge';
import { GetSwarmServiceLogs } from '../../../docker/swarmApi';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';
import { showSuccess, showError } from '../../../notification';

/**
 * Column definitions for Swarm Services table
 */
export const swarmServiceColumns = [
  { key: 'name', label: 'Name' },
  {
    key: 'image',
    label: 'Image',
    cell: ({ getValue }) => {
      const val = getValue();
      if (!val) return '-';
      return (
        <span
          title={val}
          style={{
            display: 'inline-block',
            maxWidth: 360,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            verticalAlign: 'bottom',
          }}
        >
          {val}
        </span>
      );
    },
  },
  {
    key: 'imageUpdate',
    label: 'Update',
    cell: ({ getValue }) => {
      const v = getValue();
      return <ImageUpdateBadge value={v} onOpenDetails={v?.onOpenDetails} />;
    },
  },
  { key: 'mode', label: 'Mode' },
  {
    key: 'replicas',
    label: 'Replicas',
    cell: ({ getValue }) => {
      const val = getValue();
      return val !== undefined ? val : '-';
    },
  },
  { key: 'runningTasks', label: 'Running' },
  {
    key: 'ports',
    label: 'Ports',
    cell: ({ getValue }) => {
      const ports = getValue();
      if (!ports || ports.length === 0) return '-';
      return ports.map(p => `${p.publishedPort}:${p.targetPort}/${p.protocol}`).join(', ');
    },
  },
  {
    key: 'createdAt',
    label: 'Created',
    cell: ({ getValue }) => {
      const val = getValue();
      if (!val) return '-';
      return formatTimestampDMYHMS(val);
    },
  },
];

/**
 * Tab definitions for Swarm Services bottom panel
 */
export const swarmServiceTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'tasks', label: 'Tasks', countKey: 'tasks' },
  { key: 'placement', label: 'Placement', countable: false },
  { key: 'logs', label: 'Logs', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

/**
 * Normalize swarm service data from API response
 */
export const normalizeSwarmService = (service) => ({
  id: service.id ?? service.ID,
  name: service.name ?? service.Name,
  image: service.image ?? service.Image,
  mode: service.mode ?? service.Mode,
  replicas: service.replicas ?? service.Replicas,
  runningTasks: service.runningTasks ?? service.RunningTasks,
  ports: service.ports ?? service.Ports ?? [],
  createdAt: service.createdAt ?? service.CreatedAt,
  labels: service.labels ?? service.Labels ?? {},
  env: service.env ?? service.Env ?? [],
  mounts: service.mounts ?? service.Mounts ?? [],
  updateConfig: service.updateConfig ?? service.UpdateConfig,
  resources: service.resources ?? service.Resources,
  placement: service.placement ?? service.Placement,
  // Image update fields
  imageUpdateAvailable: service.imageUpdateAvailable,
  imageLocalDigest: service.imageLocalDigest,
  imageRemoteDigest: service.imageRemoteDigest,
  imageCheckedAt: service.imageCheckedAt,
  imageUpdate: {
    serviceId: service.id ?? service.ID,
    serviceName: service.name ?? service.Name,
    image: service.image ?? service.Image,
    imageUpdateAvailable: service.imageUpdateAvailable,
    imageLocalDigest: service.imageLocalDigest,
    imageRemoteDigest: service.imageRemoteDigest,
    imageCheckedAt: service.imageCheckedAt,
  },
});

/**
 * Fetch tab counts for a service row
 */
export const fetchSwarmServiceTabCounts = async (row) => {
  if (!row?.id) return {};
  const tasks = await GetSwarmTasksByService(row.id);
  return {
    tasks: Array.isArray(tasks) ? tasks.length : 0,
  };
};

/**
 * Render panel content for each tab
 */
export const renderSwarmServicePanelContent = (row, tab, holmesState, onAnalyze, onCancel, panelApi) => {
  if (tab === 'summary') {
    return <ServiceSummaryPanel row={row} panelApi={panelApi} />;
  }

  if (tab === 'tasks') {
    return <ServiceTasksTab serviceId={row.id} serviceName={row.name} />;
  }

  if (tab === 'placement') {
    return <ServicePlacementTab row={row} />;
  }

  if (tab === 'logs') {
    return (
      <AggregateLogsTab
        title="Service Logs"
        reloadKey={row.id}
        loadLogs={() => GetSwarmServiceLogs(row.id, '500')}
      />
    );
  }

  if (tab === 'holmes') {
    const key = `swarm/${row.id}`;
    return (
      <HolmesBottomPanel
        kind="Swarm Service"
        namespace="swarm"
        name={row.name}
        onAnalyze={() => onAnalyze(row)}
        onCancel={holmesState.key === key && holmesState.streamId ? onCancel : null}
        response={holmesState.key === key ? holmesState.response : null}
        loading={holmesState.key === key && holmesState.loading}
        error={holmesState.key === key ? holmesState.error : null}
        queryTimestamp={holmesState.key === key ? holmesState.queryTimestamp : null}
        streamingText={holmesState.key === key ? holmesState.streamingText : ''}
        reasoningText={holmesState.key === key ? holmesState.reasoningText : ''}
        toolEvents={holmesState.key === key ? holmesState.toolEvents : []}
        contextSteps={holmesState.key === key ? holmesState.contextSteps : []}
      />
    );
  }

  return null;
};

/**
 * Get row actions for Swarm Service
 */
export const getSwarmServiceRowActions = (row, api, { holmesState, analyze }) => {
  const canScale = (row?.mode || '').toLowerCase() === 'replicated';
  const isAnalyzing = holmesState?.loading && holmesState?.key === `swarm/${row.id}`;

  const promptReplicas = (current) => {
    const value = window.prompt('Scale to replicas', String(current ?? 0));
    if (value === null) return null;
    const next = Number(String(value).trim());
    if (!Number.isFinite(next) || next < 0) return null;
    return Math.round(next);
  };

  return [
    {
      label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
      icon: '🧠',
      disabled: isAnalyzing,
      onClick: () => {
        analyze(row);
        api?.openDetails?.('holmes');
      },
    },
    {
      label: 'Restart',
      icon: '🔄',
      onClick: async () => {
        try {
          await RestartSwarmService(row.id);
          showSuccess(`Restarted service ${row.name}`);
          api?.refresh?.();
        } catch (err) {
          showError(`Failed to restart service: ${err}`);
        }
      },
    },
    {
      label: 'Scale…',
      icon: '📏',
      disabled: !canScale,
      onClick: async () => {
        if (!canScale) return;
        const desired = promptReplicas(row?.replicas ?? 0);
        if (desired === null) return;
        try {
          await ScaleSwarmService(row.id, desired);
          showSuccess(`Scaled service ${row.name} to ${desired} replicas`);
          api?.refresh?.();
        } catch (err) {
          showError(`Failed to scale service: ${err}`);
        }
      },
    },
    {
      label: 'Delete',
      icon: '🗑️',
      danger: true,
      onClick: async () => {
        if (!window.confirm(`Delete service "${row.name}"?`)) return;
        try {
          await RemoveSwarmService(row.id);
          showSuccess(`Removed service ${row.name}`);
          api?.refresh?.();
        } catch (err) {
          showError(`Failed to remove service: ${err}`);
        }
      },
    },
  ];
};

/**
 * Complete config for GenericResourceTable
 */
export const swarmServiceConfig = {
  resourceType: 'swarm-service',
  resourceKind: 'Service',
  columns: swarmServiceColumns,
  tabs: swarmServiceTabs,
  fetchFn: GetSwarmServices,
  eventName: 'swarm:services:update',
  normalize: normalizeSwarmService,
  renderPanelContent: renderSwarmServicePanelContent,
  getRowActions: getSwarmServiceRowActions,
  tabCountsFetcher: fetchSwarmServiceTabCounts,
  analyzeFn: AnalyzeSwarmServiceStream,
  holmesKeyPrefix: 'swarm',
  clusterScoped: true,
  createPlatform: 'swarm',
  createKind: 'service',
  title: 'Swarm Services',
  tableTestId: 'swarm-services-table',
};
