/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Swarm Service Resource Configuration
 *
 * Configuration for GenericResourceTable to display Docker Swarm Services.
 */

import AggregateLogsTab from '../../../components/AggregateLogsTab';
import { ImageUpdateBadge } from '../../../docker/resources/services/ImageUpdateBadge';
import ServicePlacementTab from '../../../docker/resources/services/ServicePlacementTab';
import ServiceSummaryPanel from '../../../docker/resources/services/ServiceSummaryPanel';
import ServiceTasksTab from '../../../docker/resources/services/ServiceTasksTab';
import {
    GetSwarmServiceLogs,
    GetSwarmServices,
    GetSwarmTasksByService,
    RemoveSwarmService,
    RestartSwarmService,
    ScaleSwarmService,
} from '../../../docker/swarmApi';
import { AnalyzeSwarmServiceStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel';
import { showError, showSuccess } from '../../../notification';
import type {
    HolmesHelpers,
    PanelApi,
    RenderPanelContent,
    ResourceColumn,
    ResourceConfig,
    ResourceRow,
    ResourceTab,
    RowAction,
} from '../../../types/resourceConfigs';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';

/**
 * Column definitions for Swarm Services table
 */
export const swarmServiceColumns: ResourceColumn[] = [
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
      return ports.map((p: { publishedPort: number; targetPort: number; protocol: string }) => `${p.publishedPort}:${p.targetPort}/${p.protocol}`).join(', ');
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
export const swarmServiceTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'tasks', label: 'Tasks', countKey: 'tasks' },
  { key: 'placement', label: 'Placement', countable: false },
  { key: 'logs', label: 'Logs', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

/**
 * Normalize swarm service data from API response
 */
export const normalizeSwarmService = (service: Record<string, any>): ResourceRow => ({
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
export const fetchSwarmServiceTabCounts = async (row: ResourceRow) => {
  if (!row?.id) return {};
  const tasks = await GetSwarmTasksByService(row.id);
  return {
    tasks: Array.isArray(tasks) ? tasks.length : 0,
  };
};
/**
 * Render panel content for each tab
 */
export const renderSwarmServicePanelContent: RenderPanelContent = (row, tab, holmesState, onAnalyze, onCancel) => {
  const serviceId = row?.id ?? '';
  const serviceName = row?.name ?? '';

  if (tab === 'summary') {
    return <ServiceSummaryPanel row={row} />;
  }

  if (tab === 'tasks') {
    return <ServiceTasksTab serviceId={serviceId} serviceName={serviceName} />;
  }

  if (tab === 'placement') {
    return <ServicePlacementTab row={row} />;
  }

  if (tab === 'logs') {
    if (!serviceId) {
      return <div className="logs-empty">Select a service to view logs.</div>;
    }
    return (
      <AggregateLogsTab
        title="Service Logs"
        reloadKey={serviceId}
        loadLogs={() => GetSwarmServiceLogs(serviceId, '500')}
      />
    );
  }

  if (tab === 'holmes') {
    const key = `swarm/${serviceId}`;
    return (
      <HolmesBottomPanel
        kind="Swarm Service"
        namespace="swarm"
        name={serviceName}
        onAnalyze={() => onAnalyze?.(row)}
        onCancel={holmesState.key === key && holmesState.streamId ? onCancel : undefined}
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
export const getSwarmServiceRowActions = (row: ResourceRow, api: PanelApi, { holmesState, analyze }: HolmesHelpers): RowAction[] => {
  const canScale = String(row?.mode ?? '').toLowerCase() === 'replicated';
  const isAnalyzing = holmesState?.loading && holmesState?.key === `swarm/${row.id}`;

  const promptReplicas = (current: number) => {
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
        const serviceId = row?.id;
        if (!serviceId) {
          showError('Missing service id');
          return;
        }
        try {
          await RestartSwarmService(serviceId);
          showSuccess(`Restarted service ${row.name}`);
          api?.refresh?.();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          showError(`Failed to restart service: ${message}`);
        }
      },
    },
    {
      label: 'Scale…',
      icon: '📏',
      disabled: !canScale,
      onClick: async () => {
        if (!canScale) return;
        const serviceId = row?.id;
        if (!serviceId) {
          showError('Missing service id');
          return;
        }
        const desired = promptReplicas(Number(row?.replicas ?? 0));
        if (desired === null) return;
        try {
          await ScaleSwarmService(serviceId, desired);
          showSuccess(`Scaled service ${row.name} to ${desired} replicas`);
          api?.refresh?.();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          showError(`Failed to scale service: ${message}`);
        }
      },
    },
    {
      label: 'Delete',
      icon: '🗑️',
      danger: true,
      onClick: async () => {
        if (!window.confirm(`Delete service "${row.name}"?`)) return;
        const serviceId = row?.id;
        if (!serviceId) {
          showError('Missing service id');
          return;
        }
        try {
          await RemoveSwarmService(serviceId);
          showSuccess(`Removed service ${row.name}`);
          api?.refresh?.();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          showError(`Failed to remove service: ${message}`);
        }
      },
    },
  ];
};

/**
 * Complete config for GenericResourceTable
 */
export const swarmServiceConfig: ResourceConfig = {
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
