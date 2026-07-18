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
import { UptimeCell } from '../../components/DataTable/UptimeCell';
import { usePortForwardState } from '../../hooks/usePortForwardState';
import { showError, showSuccess } from '../../notification';
import { showModalPrompt } from '../../components/ModalProvider';
import type {
  RenderPanelContent,
  ResourceColumn,
  ResourceConfig,
  ResourceRow,
  ResourceTab,
  RowAction,
  PanelApi,
} from '../../types/resourceConfigs';

/**
 * PortsCell — shows pod ports with active port-forward indicators
 */
export function PortsCell({ ports, podName, namespace }: { ports: number[]; podName?: string; namespace?: string }) {
  const pfByKey = usePortForwardState();
  if (!Array.isArray(ports) || ports.length === 0) return '-';
  const key = `${namespace || ''}/${podName}`;
  const fForPod = pfByKey[key] || {};
  const sorted = [...ports].sort((a, b) => a - b);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {sorted.map((p) => {
        const locals = fForPod[p] || [];
        const hasFwd = locals.length > 0;
        return (
          <span key={p} title={hasFwd ? `Forwarded to: ${locals.join(', ')}` : ''} style={{ whiteSpace: 'nowrap' }}>
            <code style={{ background: 'rgba(99,110,123,0.2)', padding: '2px 6px', borderRadius: 0, border: '1px solid #353a42' }}>{p}</code>
            {hasFwd && (
              <>
                <span style={{ margin: '0 4px', color: '#aaa' }}>→</span>
                <code style={{ background: 'rgba(35,134,54,0.15)', padding: '2px 6px', borderRadius: 0, border: '1px solid rgba(35,134,54,0.4)', color: 'var(--gh-accent, #2ea44f)' }}>
                  {locals.join(', ')}
                </code>
                <span aria-label="forward active" title="Port-forward active" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--gh-accent, #2ea44f)', marginLeft: 6, verticalAlign: 'middle' }} />
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}

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
      const row = info.row?.original;
      return <PortsCell ports={info.getValue() || []} podName={row?.name} namespace={row?.namespace} />;
    },
  },
  { key: 'restarts', label: 'Restarts' },
  {
    key: 'startTime',
    label: 'Uptime',
    cell: (info) => {
      const startTime = info.getValue();
      if (!startTime) return '-';
      return <UptimeCell startTime={startTime} />;
    },
  },
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
export const normalizePod = (pod: Record<string, unknown> | null | undefined, fallbackNamespace?: string): ResourceRow => ({
  name: (pod?.name ?? pod?.Name) as string | undefined,
  namespace: (pod?.namespace ?? pod?.Namespace ?? fallbackNamespace) as string | undefined,
  restarts: (pod?.restarts ?? pod?.Restarts ?? 0) as number,
  status: (pod?.status ?? pod?.Status ?? pod?.phase ?? pod?.Phase ?? '-') as string,
  ports: (pod?.ports ?? pod?.Ports ?? []) as number[],
  startTime: (pod?.startTime ?? pod?.StartTime ?? pod?.startedAt ?? pod?.StartedAt) as string | null,
  created: (pod?.created ?? pod?.Created) as string | null,
});

/**
 * Row actions specific to Pods.
 * NOTE: plain function (not a component) — no hooks here (rules-of-hooks).
 * Stop Port Forward always shown; it prompts for the port to stop.
 */
export function getPodRowActions(row: ResourceRow, api?: PanelApi): RowAction[] {
  return [
    { label: 'Logs', icon: '📜', onClick: () => api?.openDetails?.('logs') },
    { label: 'Shell', icon: '💻', onClick: () => api?.openDetails?.('console') },
    { label: 'Port Forward', icon: '🔌', onClick: () => api?.openDetails?.('portforward') },
    {
      label: 'Stop Port Forward',
      icon: '🛑',
      onClick: async () => {
        if (!row.name || !row.namespace) {
          showError('Missing pod name or namespace');
          return;
        }
        try {
          const input = await showModalPrompt('Enter local port to stop forwarding:', '20000');
          if (input == null) return;
          const p = parseInt(String(input).trim(), 10);
          if (!Number.isFinite(p) || p <= 0 || p > 65535) {
            showError(`Invalid port: ${input}`);
            return;
          }
          await AppAPI.StopPortForward(row.namespace, row.name, p);
          showSuccess(`Stopped port-forward for ${row.name}:${p}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          showError(`Failed to stop port-forward: ${message}`);
        }
      },
    },
  ];
}

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
    const forwardLocalPort = options && typeof (options as Record<string, unknown>).forwardLocalPort === 'number'
      ? (options as Record<string, unknown>).forwardLocalPort
      : undefined;
    const forwardRemotePort = options && typeof (options as Record<string, unknown>).forwardRemotePort === 'number'
      ? (options as Record<string, unknown>).forwardRemotePort
      : undefined;
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
  getRowActions: getPodRowActions,
  onRestart: async (name: string, namespace?: string) => AppAPI.RestartPod(namespace ?? '', name),
  onDelete: async (name: string, namespace?: string) => AppAPI.DeletePod(namespace ?? '', name),
  title: 'Pods',
  createKind: 'pod',
  tableTestId: 'pods-table',
};

export default podConfig;
