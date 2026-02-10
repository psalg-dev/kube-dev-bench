/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
/**
 * DaemonSet Resource Configuration
 *
 * Configuration for GenericResourceTable to display Kubernetes DaemonSets.
 */

import * as AppAPI from '../../../wailsjs/go/main/App';
import { AnalyzeDaemonSetStream } from '../../holmes/holmesApi';
import QuickInfoSection, { type QuickInfoField } from '../../QuickInfoSection';
import YamlTab from '../../layout/bottompanel/YamlTab';
import ResourceEventsTab from '../../components/ResourceEventsTab';
import ResourcePodsTab from '../../components/ResourcePodsTab';
import AggregateLogsTab from '../../components/AggregateLogsTab';
import DaemonSetNodeCoverageTab from '../../k8s/resources/daemonsets/DaemonSetNodeCoverageTab';
import SummaryTabHeader from '../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../components/ResourceActions';
import HolmesBottomPanel from '../../holmes/HolmesBottomPanel';
import type {
  RenderPanelContent,
  ResourceColumn,
  ResourceConfig,
  ResourceRow,
  ResourceTab,
} from '../../types/resourceConfigs';

const AppAPIAny = AppAPI as any;

/**
 * Column definitions for DaemonSets table
 */
export const daemonsetColumns: ResourceColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'desired', label: 'Desired' },
  { key: 'current', label: 'Current' },
  { key: 'age', label: 'Age' },
  { key: 'image', label: 'Image' },
];

/**
 * Tab definitions for DaemonSets bottom panel
 */
export const daemonsetTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'pods', label: 'Pods', countKey: 'pods' },
  { key: 'coverage', label: 'Node Coverage', countable: false },
  { key: 'logs', label: 'Logs', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

/**
 * Normalize daemonset data from API response
 */
export const normalizeDaemonSet = (ds: Record<string, any>): ResourceRow => ({
  name: ds.name ?? ds.Name,
  namespace: ds.namespace ?? ds.Namespace,
  desired: ds.desired ?? ds.Desired ?? 0,
  current: ds.current ?? ds.Current ?? 0,
  age: ds.age ?? ds.Age ?? '-',
  image: ds.image ?? ds.Image ?? '',
  labels: ds.labels ?? ds.Labels ?? ds.metadata?.labels ?? {},
});

/**
 * Quick info fields for Summary tab
 */
const quickInfoFields = [
  {
    key: 'desired',
    label: 'Desired',
    layout: 'flex',
    rightField: {
      key: 'age',
      label: 'Age',
      type: 'age',
      getValue: (data: Record<string, any>) => data.created || data.age,
    },
  },
  { key: 'namespace', label: 'Namespace' },
  { key: 'current', label: 'Current' },
  { key: 'image', label: 'Image', type: 'break-word' },
  { key: 'name', label: 'DaemonSet name', type: 'break-word' },
] satisfies QuickInfoField[];

/**
 * Render panel content for each tab
 */
export const renderDaemonSetPanelContent: RenderPanelContent = (
  row,
  tab,
  holmesState,
  onAnalyze,
  onCancel
) => {
  if (tab === 'summary') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels || row.Labels || row.metadata?.labels}
          actions={
            <ResourceActions
              resourceType="daemonset"
              name={row.name}
              namespace={row.namespace}
              replicaCount={row.desired}
              onRestart={async (n: string, ns?: string) => {
                await AppAPIAny.RestartDaemonSet(ns ?? '', n);
              }}
              onDelete={async (n: string, ns?: string) => { await AppAPIAny.DeleteResource('daemonset', ns ?? '', n); }}
            />
          }
        />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
              <AggregateLogsTab
                title="Logs"
                reloadKey={`${row.namespace}/${row.name}`}
                loadLogs={() => AppAPIAny.GetDaemonSetLogs(row.namespace ?? '', row.name ?? '')}
              />
            </div>
            <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
              <ResourceEventsTab
                namespace={row.namespace}
                kind="DaemonSet"
                name={row.name}
                limit={20}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'pods') {
    return (
      <ResourcePodsTab
        namespace={row.namespace}
        resourceKind="DaemonSet"
        resourceName={row.name}
      />
    );
  }

  if (tab === 'coverage') {
    return <DaemonSetNodeCoverageTab namespace={row.namespace} daemonSetName={row.name} />;
  }

  if (tab === 'logs') {
    return (
      <AggregateLogsTab
        title="DaemonSet Logs"
        reloadKey={`${row.namespace}/${row.name}`}
        loadLogs={() => AppAPIAny.GetDaemonSetLogs(row.namespace ?? '', row.name ?? '')}
      />
    );
  }

  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="DaemonSet"
        name={row.name}
      />
    );
  }

  if (tab === 'yaml') {
    const yamlContent = `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
spec:
  selector:
    matchLabels:
      app: ${row.name}
  template:
    metadata:
      labels:
        app: ${row.name}
    spec:
      containers:
      - name: ${row.name}
        image: ${row.image}`;

    return <YamlTab content={yamlContent} />;
  }

  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="DaemonSet"
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
 * Complete daemonset configuration for GenericResourceTable
 */
export const daemonsetConfig: ResourceConfig = {
  resourceType: 'daemonset',
  resourceKind: 'DaemonSet',
  columns: daemonsetColumns,
  tabs: daemonsetTabs,
  fetchFn: AppAPI.GetDaemonSets,
  eventName: 'daemonsets:update',
  analyzeFn: AnalyzeDaemonSetStream,
  normalize: normalizeDaemonSet,
  renderPanelContent: renderDaemonSetPanelContent,
  onRestart: async (name: string, namespace?: string) => {
    return AppAPIAny.RestartDaemonSet(namespace ?? '', name);
  },
  onDelete: async (name: string, namespace?: string) => AppAPIAny.DeleteResource('daemonset', namespace ?? '', name),
  title: 'Daemon Sets',
};

export default daemonsetConfig;
