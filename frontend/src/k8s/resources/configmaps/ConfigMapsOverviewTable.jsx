import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import ConfigMapYamlTab from './ConfigMapYamlTab';
import ConfigMapDataTab from './ConfigMapDataTab';
import ConfigMapConsumersTab from './ConfigMapConsumersTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import ResourceActions from '../../../components/ResourceActions.jsx';
import { showSuccess, showError } from '../../../notification';
import { AnalyzeConfigMapStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';
import { useHolmesAnalysis } from '../../../hooks/useHolmesAnalysis';
import { useResourceData } from '../../../hooks/useResourceData';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'keys', label: 'Keys' },
  { key: 'size', label: 'Size' },
  { key: 'age', label: 'Age' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'data', label: 'Data', countKey: 'data' },
  { key: 'consumers', label: 'Consumers', countKey: 'consumers' },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

function renderPanelContent(row, tab, holmesState, onAnalyze, onCancel) {
  if (tab === 'summary') {
    const quickInfoFields = [
      {
        key: 'keys',
        label: 'Keys',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data) => data.created || data.age
        }
      },
      { key: 'namespace', label: 'Namespace' },
      { key: 'size', label: 'Size' },
      { key: 'name', label: 'ConfigMap name', type: 'break-word' }
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader name={row.name} labels={row.labels || row.Labels || row.metadata?.labels} actions={<ResourceActions resourceType="configmap" name={row.name} namespace={row.namespace} onDelete={async (n,ns)=>{await AppAPI.DeleteResource('configmap', ns, n);}} />} />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          {/* Editable Data + Event History at a glance */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
              <ConfigMapDataTab namespace={row.namespace} configMapName={row.name} />
            </div>
            <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
              <ResourceEventsTab namespace={row.namespace} resourceKind="ConfigMap" resourceName={row.name} limit={20} />
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
    return <ResourceEventsTab namespace={row.namespace} resourceKind="ConfigMap" resourceName={row.name} />;
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
}

// Normalize function for configmaps
const normalizeConfigMap = (cm) => ({
  name: cm.name ?? cm.Name,
  namespace: cm.namespace ?? cm.Namespace,
  keys: cm.keys ?? cm.Keys ?? '-',
  size: cm.size ?? cm.Size ?? '-',
  age: cm.age ?? cm.Age ?? '-',
  labels: cm.labels ?? cm.Labels ?? cm.metadata?.labels ?? {}
});

export default function ConfigMapsOverviewTable({ namespaces = [], namespace, onConfigMapCreate }) {
  // Use the consolidated resource data hook
  const { data, loading } = useResourceData({
    fetchFn: AppAPI.GetConfigMaps,
    eventName: 'configmaps:update',
    namespaces,
    namespace,
    normalize: normalizeConfigMap,
  });

  const { state: holmesState, analyze: analyzeConfigMap, cancel: cancelHolmesAnalysis } = useHolmesAnalysis({
    kind: 'ConfigMap',
    analyzeFn: AnalyzeConfigMapStream,
  });

  const getRowActions = (row, api) => {
    const key = `${row.namespace}/${row.name}`;
    const isAnalyzing = holmesState.loading && holmesState.key === key;
    return [
      {
        label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
        icon: '🧠',
        disabled: isAnalyzing,
        onClick: () => {
          analyzeConfigMap(row);
          api?.openDetails?.('holmes');
        },
      },
      {
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        onClick: async () => {
          try {
            await AppAPI.DeleteResource('configmap', row.namespace, row.name);
            showSuccess(`ConfigMap '${row.name}' deleted`);
          } catch (err) {
            showError(`Failed to delete ConfigMap '${row.name}': ${err?.message || err}`);
          }
        },
      },
    ];
  };

  return (
    <OverviewTableWithPanel
      title="Config Maps"
      data={data}
      columns={columns}
      loading={loading}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeConfigMap, cancelHolmesAnalysis)}
      resourceKind="configmap"
      namespace={namespace}
      onResourceCreate={onConfigMapCreate}
      getRowActions={getRowActions}
    />
  );
}
