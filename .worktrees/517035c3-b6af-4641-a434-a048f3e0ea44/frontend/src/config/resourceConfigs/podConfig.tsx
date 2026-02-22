/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
/**
 * Pod Resource Configuration
 *
 * Configuration for GenericResourceTable to display Kubernetes Pods.
 */

import * as AppAPI from '../../../wailsjs/go/main/App';
import { AnalyzePodStream } from '../../holmes/holmesApi';
import LogViewerTab from '../../layout/bottompanel/LogViewerTab';
import PodSummaryTab from '../../k8s/resources/pods/PodSummaryTab';
import PodEventsTab from '../../k8s/resources/pods/PodEventsTab';
import PodYamlTab from '../../k8s/resources/pods/PodYamlTab';
import ConsoleTab from '../../layout/bottompanel/ConsoleTab';
import PortForwardOutput from '../../k8s/resources/pods/PortForwardOutput';
import PodFilesTab from '../../k8s/resources/pods/PodFilesTab';
import PodMountsTab from '../../k8s/resources/pods/PodMountsTab';
import HolmesBottomPanel from '../../holmes/HolmesBottomPanel';
import StatusBadge from '../../components/StatusBadge';
import type {
  RenderPanelContent,
  ResourceColumn,
  ResourceConfig,
  ResourceRow,
  ResourceTab,
} from '../../types/resourceConfigs';

const AppAPIAny = AppAPI as any;

/**
 * Column definitions for Pods table
 */
export const podColumns: ResourceColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  {
    key: 'status',
    label: 'Status',
    cell: (info) => <StatusBadge status={info.getValue() || '-'} size="small" />,
  },
  {
    key: 'ports',
    label: 'Ports',
    cell: (info) => {
      const ports = info.getValue();
      if (!Array.isArray(ports) || ports.length === 0) return '-';
      const sorted = [...ports].sort((a, b) => a - b);
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {sorted.map((p) => (
            <code key={p} style={{ background: 'rgba(99,110,123,0.2)', padding: '2px 6px', borderRadius: 0, border: '1px solid #353a42' }}>
              {p}
            </code>
          ))}
        </div>
      );
    },
  },
  { key: 'restarts', label: 'Restarts' },
  { key: 'startTime', label: 'Uptime' },
];

/**
 * Tab definitions for Pods bottom panel
 */
export const podTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'logs', label: 'Logs', countable: false },
  { key: 'events', label: 'Events', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'console', label: 'Console', countable: false },
  { key: 'portforward', label: 'Port Forward', countable: false },
  { key: 'files', label: 'Files', countable: false },
  { key: 'mounts', label: 'Mounts', countable: false },
];

/**
 * Normalize pod data from API response
 */
export const normalizePod = (pod: Record<string, any> | null | undefined, fallbackNamespace?: string): ResourceRow => ({
  name: pod?.name ?? pod?.Name,
  namespace: pod?.namespace ?? pod?.Namespace ?? fallbackNamespace,
  restarts: pod?.restarts ?? pod?.Restarts ?? 0,
  status: pod?.status ?? pod?.Status ?? pod?.phase ?? pod?.Phase ?? '-',
  ports: pod?.ports ?? pod?.Ports ?? [],
  startTime: pod?.startTime ?? pod?.StartTime ?? pod?.startedAt ?? pod?.StartedAt ?? null,
  created: pod?.created ?? pod?.Created ?? null,
});

/**
 * Render panel content for each tab
 */
export const renderPodPanelContent: RenderPanelContent = (
  row,
  tab,
  holmesState,
  onAnalyze,
  onCancel,
  _panelApi,
  _data,
  options
) => {
  if (tab === 'summary') {
    return <PodSummaryTab podName={row.name} namespace={row.namespace} />;
  }

  if (tab === 'logs') {
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <LogViewerTab podName={row.name} namespace={row.namespace} embedded={true} />
      </div>
    );
  }

  if (tab === 'events') {
    return <PodEventsTab namespace={row.namespace} podName={row.name} />;
  }

  if (tab === 'yaml') {
    return <PodYamlTab podName={row.name} />;
  }

  if (tab === 'console') {
    return <ConsoleTab podExec={true} namespace={row.namespace} podName={row.name} shell="auto" />;
  }

  if (tab === 'portforward') {
    const { forwardLocalPort, forwardRemotePort } = (options ?? {}) as {
      forwardLocalPort?: number;
      forwardRemotePort?: number;
    };
    if (typeof forwardLocalPort !== 'number' || typeof forwardRemotePort !== 'number') {
      return (
        <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>
          Select local and remote ports to start port forwarding.
        </div>
      );
    }
    return (
      <PortForwardOutput
        namespace={row.namespace}
        podName={row.name}
        localPort={forwardLocalPort}
        remotePort={forwardRemotePort}
      />
    );
  }

  if (tab === 'files') {
    return <PodFilesTab podName={row.name} />;
  }

  if (tab === 'mounts') {
    return <PodMountsTab podName={row.name} />;
  }

  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="Pod"
        namespace={row.namespace}
        name={row.name}
        onAnalyze={() => onAnalyze(row.namespace, row.name)}
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
 * Complete pod configuration for GenericResourceTable
 */
export const podConfig: ResourceConfig = {
  resourceType: 'pod',
  resourceKind: 'Pod',
  columns: podColumns,
  tabs: podTabs,
  fetchFn: AppAPI.GetRunningPods,
  eventName: 'pods:update',
  analyzeFn: AnalyzePodStream,
  normalize: normalizePod,
  renderPanelContent: renderPodPanelContent,
  onRestart: async (name: string, namespace?: string) => AppAPIAny.RestartPod(namespace ?? '', name),
  onDelete: async (name: string, namespace?: string) => AppAPIAny.DeletePod(namespace ?? '', name),
  title: 'Pods',
  createKind: 'pod',
};

export default podConfig;
