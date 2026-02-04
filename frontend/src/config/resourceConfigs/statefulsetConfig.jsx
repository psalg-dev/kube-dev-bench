/**
 * StatefulSet Resource Configuration
 * 
 * Configuration for GenericResourceTable to display Kubernetes StatefulSets.
 */

import * as AppAPI from '../../../wailsjs/go/main/App';
import { AnalyzeStatefulSetStream } from '../../holmes/holmesApi';
import QuickInfoSection from '../../QuickInfoSection';
import YamlTab from '../../layout/bottompanel/YamlTab';
import ResourceEventsTab from '../../components/ResourceEventsTab';
import ResourcePodsTab from '../../components/ResourcePodsTab';
import StatefulSetPVCsTab from '../../k8s/resources/statefulsets/StatefulSetPVCsTab';
import AggregateLogsTab from '../../components/AggregateLogsTab';
import SummaryTabHeader from '../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../components/ResourceActions';
import HolmesBottomPanel from '../../holmes/HolmesBottomPanel';

/**
 * Column definitions for StatefulSets table
 */
export const statefulsetColumns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'replicas', label: 'Replicas' },
  { key: 'ready', label: 'Ready' },
  { key: 'age', label: 'Age' },
  { key: 'image', label: 'Image' },
];

/**
 * Tab definitions for StatefulSets bottom panel
 */
export const statefulsetTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'pods', label: 'Pods', countKey: 'pods' },
  { key: 'pvcs', label: 'PVCs', countKey: 'pvcs' },
  { key: 'logs', label: 'Logs', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

/**
 * Normalize statefulset data from API response
 */
export const normalizeStatefulSet = (ss) => ({
  name: ss.name ?? ss.Name,
  namespace: ss.namespace ?? ss.Namespace,
  replicas: ss.replicas ?? ss.Replicas ?? 0,
  ready: ss.ready ?? ss.Ready ?? 0,
  age: ss.age ?? ss.Age ?? '-',
  image: ss.image ?? ss.Image ?? '',
  labels: ss.labels ?? ss.Labels ?? ss.metadata?.labels ?? {},
});

/**
 * Quick info fields for Summary tab
 */
const quickInfoFields = [
  {
    key: 'replicas',
    label: 'Replicas',
    layout: 'flex',
    rightField: {
      key: 'age',
      label: 'Age',
      type: 'age',
      getValue: (data) => data.created || data.age,
    },
  },
  { key: 'namespace', label: 'Namespace' },
  { key: 'ready', label: 'Ready' },
  { key: 'image', label: 'Image', type: 'break-word' },
  { key: 'name', label: 'StatefulSet name', type: 'break-word' },
];

/**
 * Render panel content for each tab
 */
export const renderStatefulSetPanelContent = (row, tab, holmesState, onAnalyze, onCancel) => {
  if (tab === 'summary') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels || row.Labels || row.metadata?.labels}
          actions={
            <ResourceActions
              resourceType="statefulset"
              name={row.name}
              namespace={row.namespace}
              replicaCount={row.replicas}
              onRestart={async (n, ns) => {
                if (AppAPI.RestartStatefulSet) {
                  await AppAPI.RestartStatefulSet(ns, n);
                } else {
                  throw new Error('RestartStatefulSet API unavailable');
                }
              }}
              onDelete={async (n, ns) => { await AppAPI.DeleteResource('statefulset', ns, n); }}
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
                loadLogs={() => AppAPI.GetStatefulSetLogs(row.namespace, row.name)}
              />
            </div>
            <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
              <ResourceEventsTab
                namespace={row.namespace}
                kind="StatefulSet"
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
        resourceKind="StatefulSet"
        resourceName={row.name}
      />
    );
  }
  
  if (tab === 'pvcs') {
    return (
      <StatefulSetPVCsTab
        namespace={row.namespace}
        statefulSetName={row.name}
      />
    );
  }
  
  if (tab === 'logs') {
    return (
      <AggregateLogsTab
        title="StatefulSet Logs"
        reloadKey={`${row.namespace}/${row.name}`}
        loadLogs={() => AppAPI.GetStatefulSetLogs(row.namespace, row.name)}
      />
    );
  }
  
  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="StatefulSet"
        name={row.name}
      />
    );
  }
  
  if (tab === 'yaml') {
    const yamlContent = `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
spec:
  replicas: ${row.replicas}
  selector:
    matchLabels:
      app: ${row.name}
  serviceName: ${row.name}
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
        kind="StatefulSet"
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
 * Complete statefulset configuration for GenericResourceTable
 */
export const statefulsetConfig = {
  resourceType: 'statefulset',
  resourceKind: 'StatefulSet',
  columns: statefulsetColumns,
  tabs: statefulsetTabs,
  fetchFn: AppAPI.GetStatefulSets,
  eventName: 'statefulsets:update',
  analyzeFn: AnalyzeStatefulSetStream,
  normalize: normalizeStatefulSet,
  renderPanelContent: renderStatefulSetPanelContent,
  onRestart: async (name, namespace) => {
    if (AppAPI.RestartStatefulSet) {
      await AppAPI.RestartStatefulSet(namespace, name);
    }
  },
  onDelete: async (name, namespace) => AppAPI.DeleteResource('statefulset', namespace, name),
  onScale: async (namespace, name, replicas) => AppAPI.ScaleStatefulSet(namespace, name, replicas),
  title: 'StatefulSets',
};

export default statefulsetConfig;
