/**
 * ReplicaSet Resource Configuration
 * 
 * Configuration for GenericResourceTable to display Kubernetes ReplicaSets.
 */

import * as AppAPI from '../../../wailsjs/go/main/App';
import QuickInfoSection from '../../QuickInfoSection';
import YamlTab from '../../layout/bottompanel/YamlTab';
import ResourceEventsTab from '../../components/ResourceEventsTab';
import ResourcePodsTab from '../../components/ResourcePodsTab';
import SummaryTabHeader from '../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../components/ResourceActions';
import HolmesBottomPanel from '../../holmes/HolmesBottomPanel';

/**
 * Column definitions for ReplicaSets table
 */
export const replicasetColumns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'desired', label: 'Desired' },
  { key: 'current', label: 'Current' },
  { key: 'ready', label: 'Ready' },
  { key: 'age', label: 'Age' },
  { key: 'image', label: 'Image' },
];

/**
 * Tab definitions for ReplicaSets bottom panel
 */
export const replicasetTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'pods', label: 'Pods', countKey: 'pods' },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

/**
 * Normalize replicaset data from API response
 */
export const normalizeReplicaSet = (rs) => ({
  name: rs.name ?? rs.Name,
  namespace: rs.namespace ?? rs.Namespace,
  desired: rs.desired ?? rs.Desired ?? 0,
  current: rs.current ?? rs.Current ?? 0,
  ready: rs.ready ?? rs.Ready ?? 0,
  age: rs.age ?? rs.Age ?? '-',
  image: rs.image ?? rs.Image ?? '',
  labels: rs.labels ?? rs.Labels ?? rs.metadata?.labels ?? {},
  ownerReferences: rs.ownerReferences ?? rs.OwnerReferences ?? [],
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
      getValue: (data) => data.created || data.age,
    },
  },
  { key: 'namespace', label: 'Namespace' },
  { key: 'current', label: 'Current' },
  { key: 'ready', label: 'Ready' },
  { key: 'image', label: 'Image', type: 'break-word' },
  { key: 'name', label: 'ReplicaSet name', type: 'break-word' },
];

/**
 * Render panel content for each tab
 */
export const renderReplicaSetPanelContent = (row, tab, holmesState, onAnalyze, onCancel) => {
  if (tab === 'summary') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels || row.Labels || row.metadata?.labels}
          actions={
            <ResourceActions
              resourceType="replicaset"
              name={row.name}
              namespace={row.namespace}
              replicaCount={row.desired}
              onDelete={async (n, ns) => { await AppAPI.DeleteResource('replicaset', ns, n); }}
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
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
            <ResourceEventsTab
              namespace={row.namespace}
              kind="ReplicaSet"
              name={row.name}
              limit={20}
            />
          </div>
        </div>
      </div>
    );
  }
  
  if (tab === 'pods') {
    return (
      <ResourcePodsTab
        namespace={row.namespace}
        resourceKind="ReplicaSet"
        resourceName={row.name}
      />
    );
  }
  
  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="ReplicaSet"
        name={row.name}
      />
    );
  }
  
  if (tab === 'yaml') {
    const yamlContent = `apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
spec:
  replicas: ${row.desired}
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
        kind="ReplicaSet"
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
 * Complete replicaset configuration for GenericResourceTable
 * Note: ReplicaSets don't have a dedicated Holmes analysis function, using generic
 */
export const replicasetConfig = {
  resourceType: 'replicaset',
  resourceKind: 'ReplicaSet',
  columns: replicasetColumns,
  tabs: replicasetTabs,
  fetchFn: AppAPI.GetReplicaSets,
  eventName: 'replicasets:update',
  // No dedicated Holmes analysis for ReplicaSets
  normalize: normalizeReplicaSet,
  renderPanelContent: renderReplicaSetPanelContent,
  onDelete: async (name, namespace) => AppAPI.DeleteResource('replicaset', namespace, name),
  title: 'Replica Sets',
};

export default replicasetConfig;
