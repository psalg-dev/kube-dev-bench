/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Swarm Task Resource Configuration
 *
 * Configuration for GenericResourceTable to display Docker Swarm Tasks.
 */

import { GetSwarmTasks, GetSwarmTaskLogs } from '../../../docker/swarmApi';
import { AnalyzeSwarmTaskStream } from '../../../holmes/holmesApi';
import TaskSummaryPanel from '../../../docker/resources/tasks/TaskSummaryPanel';
import AggregateLogsTab from '../../../components/AggregateLogsTab';
import ConsoleTab from '../../../layout/bottompanel/ConsoleTab';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel';
import EmptyTabContent from '../../../components/EmptyTabContent';
import HealthStatusBadge from '../../../docker/resources/tasks/HealthStatusBadge';
import StatusBadge from '../../../components/StatusBadge';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';
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

/**
 * Column definitions for Swarm Tasks table
 */
export const swarmTaskColumns: ResourceColumn[] = [
  {
    key: 'id',
    label: 'Task ID',
    cell: ({ getValue }) => {
      const val = getValue();
      return val ? `${val.substring(0, 12)}...` : '-';
    },
  },
  { key: 'serviceName', label: 'Service' },
  { key: 'nodeName', label: 'Node' },
  { key: 'slot', label: 'Slot' },
  {
    key: 'state',
    label: 'State',
    cell: ({ getValue }) => {
      const state = getValue();
      return <StatusBadge status={state || '-'} size="small" />;
    },
  },
  {
    key: 'healthStatus',
    label: 'Health',
    cell: ({ row }) => {
      const data = row?.original as ResourceRow | undefined;
      const status = typeof data?.healthStatus === 'string' ? data.healthStatus : null;
      return <HealthStatusBadge status={status} />;
    },
  },
  {
    key: 'desiredState',
    label: 'Desired',
    cell: ({ getValue }) => {
      const desired = getValue();
      return <StatusBadge status={desired || '-'} size="small" />;
    },
  },
  {
    key: 'containerId',
    label: 'Container',
    cell: ({ getValue }) => {
      const val = getValue();
      return val ? `${val.substring(0, 12)}...` : '-';
    },
  },
];

/**
 * Tab definitions for Swarm Tasks bottom panel
 */
export const swarmTaskTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'logs', label: 'Logs' },
  { key: 'exec', label: 'Exec' },
  { key: 'holmes', label: 'Holmes' },
];

/**
 * Normalize swarm task data from API response
 */
export const normalizeSwarmTask = (task: Record<string, any>): ResourceRow => ({
  id: task.id ?? task.ID,
  serviceId: task.serviceId ?? task.ServiceID,
  serviceName: task.serviceName ?? task.ServiceName,
  nodeId: task.nodeId ?? task.NodeID,
  nodeName: task.nodeName ?? task.NodeName,
  slot: task.slot ?? task.Slot,
  state: task.state ?? task.State,
  desiredState: task.desiredState ?? task.DesiredState,
  healthStatus: task.healthStatus ?? task.HealthStatus,
  containerId: task.containerId ?? task.ContainerID,
  image: task.image ?? task.Image,
  createdAt: task.createdAt ?? task.CreatedAt,
  updatedAt: task.updatedAt ?? task.UpdatedAt,
  error: task.error ?? task.Error,
  networks: task.networks ?? task.Networks ?? [],
  mounts: task.mounts ?? task.Mounts ?? [],
  healthCheck: task.healthCheck ?? task.HealthCheck,
});

/**
 * Render panel content for each tab
 */
export const renderSwarmTaskPanelContent: RenderPanelContent = (row, tab, holmesState, onAnalyze, onCancel, panelApi) => {
  if (tab === 'summary') {
    return <TaskSummaryPanel row={row} />;
  }

  if (tab === 'logs') {
    if (!row.containerId) {
      const emptyMsg = getEmptyTabMessage('swarm-task-logs');
      return (
        <EmptyTabContent
          icon={emptyMsg.icon}
          title={emptyMsg.title}
          description={emptyMsg.description}
          tip={emptyMsg.tip}
        />
      );
    }
    return (
      <AggregateLogsTab
        title="Task Logs"
        reloadKey={row.id}
        loadLogs={() => GetSwarmTaskLogs(row.id, '500')}
      />
    );
  }

  if (tab === 'exec') {
    if (!row?.containerId) {
      const emptyMsg = getEmptyTabMessage('swarm-task-exec');
      return (
        <EmptyTabContent
          icon={emptyMsg.icon}
          title={emptyMsg.title}
          description={emptyMsg.description}
          tip={emptyMsg.tip}
        />
      );
    }
    if ((row?.state || '').toLowerCase() !== 'running') {
      return (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
          Exec is only available for running tasks.
        </div>
      );
    }

    return (
      <ConsoleTab
        swarmExec={true}
        swarmTaskId={row.id}
        shell="auto"
      />
    );
  }

  if (tab === 'holmes') {
    const key = `swarm/${row.id}`;
    return (
      <HolmesBottomPanel
        kind="Swarm Task"
        namespace="swarm"
        name={row.id}
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
 * Get row actions for Swarm Task
 */
export const getSwarmTaskRowActions = (row: ResourceRow, api: PanelApi, { holmesState, analyze }: HolmesHelpers): RowAction[] => {
  const hasContainer = Boolean(row?.containerId);
  const isRunning = String(row?.state || '').toLowerCase() === 'running';
  const isAnalyzing = holmesState?.loading && holmesState?.key === `swarm/${row.id}`;

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
      label: 'Logs',
      icon: '📜',
      disabled: !hasContainer,
      onClick: () => api?.openDetails?.('logs'),
    },
    {
      label: 'Exec',
      icon: '🖥️',
      disabled: !hasContainer || !isRunning,
      onClick: () => api?.openDetails?.('exec'),
    },
  ];
};

/**
 * Complete config for GenericResourceTable
 */
export const swarmTaskConfig: ResourceConfig = {
  resourceType: 'swarm-task',
  resourceKind: 'Task',
  columns: swarmTaskColumns,
  tabs: swarmTaskTabs,
  fetchFn: GetSwarmTasks,
  eventName: 'swarm:tasks:update',
  normalize: normalizeSwarmTask,
  renderPanelContent: renderSwarmTaskPanelContent,
  getRowActions: getSwarmTaskRowActions,
  analyzeFn: AnalyzeSwarmTaskStream,
  holmesKeyPrefix: 'swarm',
  clusterScoped: true,
  createPlatform: 'swarm',
  createKind: 'service',
  createButtonTitle: 'Create service (tasks are created by services)',
  createHint: "Tasks can't be created directly. Creating a service will create tasks.",
  title: 'Swarm Tasks',
  tableTestId: 'swarm-tasks-table',
};
