/**
 * ConfigMap Resource Configuration
 * 
 * Configuration for GenericResourceTable to display Kubernetes ConfigMaps.
 */

import * as AppAPI from '../../../wailsjs/go/main/App';
import { AnalyzeConfigMapStream } from '../../holmes/holmesApi';
import QuickInfoSection from '../../QuickInfoSection';
import ResourceEventsTab from '../../components/ResourceEventsTab';
import ConfigMapDataTab from '../../k8s/resources/configmaps/ConfigMapDataTab';
import ConfigMapConsumersTab from '../../k8s/resources/configmaps/ConfigMapConsumersTab';
import ConfigMapYamlTab from '../../k8s/resources/configmaps/ConfigMapYamlTab';
import SummaryTabHeader from '../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../components/ResourceActions';
import HolmesBottomPanel from '../../holmes/HolmesBottomPanel';

/**
 * Column definitions for ConfigMaps table
 */
export const configmapColumns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'keys', label: 'Keys' },
  { key: 'size', label: 'Size' },
  { key: 'age', label: 'Age' },
];

/**
 * Tab definitions for ConfigMaps bottom panel
 */
export const configmapTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'data', label: 'Data', countKey: 'data' },
  { key: 'consumers', label: 'Consumers', countKey: 'consumers' },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

/**
 * Normalize configmap data from API response
 */
export const normalizeConfigMap = (cm) => ({
  name: cm.name ?? cm.Name,
  namespace: cm.namespace ?? cm.Namespace,
  keys: cm.keys ?? cm.Keys ?? '-',
  size: cm.size ?? cm.Size ?? '-',
  age: cm.age ?? cm.Age ?? '-',
  labels: cm.labels ?? cm.Labels ?? cm.metadata?.labels ?? {},
});

/**
 * Quick info fields for Summary tab
 */
const quickInfoFields = [
  {
    key: 'keys',
    label: 'Keys',
    layout: 'flex',
    rightField: {
      key: 'age',
      label: 'Age',
      type: 'age',
      getValue: (data) => data.created || data.age,
    },
  },
  { key: 'namespace', label: 'Namespace' },
  { key: 'size', label: 'Size' },
  { key: 'name', label: 'ConfigMap name', type: 'break-word' },
];

/**
 * Render panel content for each tab
 */
export const renderConfigMapPanelContent = (row, tab, holmesState, onAnalyze, onCancel) => {
  if (tab === 'summary') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels || row.Labels || row.metadata?.labels}
          actions={
            <ResourceActions
              resourceType="configmap"
              name={row.name}
              namespace={row.namespace}
              onDelete={async (n, ns) => { await AppAPI.DeleteResource('configmap', ns, n); }}
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
            <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
              <ConfigMapDataTab namespace={row.namespace} configMapName={row.name} />
            </div>
            <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
              <ResourceEventsTab namespace={row.namespace} kind="ConfigMap" name={row.name} limit={20} />
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (tab === 'data') {
    return <ConfigMapDataTab namespace={row.namespace} configMapName={row.name} />;
  }
  
  if (tab === 'consumers') {
    return <ConfigMapConsumersTab namespace={row.namespace} configMapName={row.name} />;
  }
  
  if (tab === 'events') {
    return <ResourceEventsTab namespace={row.namespace} kind="ConfigMap" name={row.name} />;
  }
  
  if (tab === 'yaml') {
    return <ConfigMapYamlTab namespace={row.namespace} name={row.name} />;
  }
  
  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="ConfigMap"
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
 * Complete configmap configuration for GenericResourceTable
 */
export const configmapConfig = {
  resourceType: 'configmap',
  resourceKind: 'ConfigMap',
  columns: configmapColumns,
  tabs: configmapTabs,
  fetchFn: AppAPI.GetConfigMaps,
  eventName: 'configmaps:update',
  analyzeFn: AnalyzeConfigMapStream,
  normalize: normalizeConfigMap,
  renderPanelContent: renderConfigMapPanelContent,
  onDelete: async (name, namespace) => AppAPI.DeleteResource('configmap', namespace, name),
  title: 'Config Maps',
};

export default configmapConfig;
