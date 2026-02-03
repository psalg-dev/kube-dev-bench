/**
 * Secret Resource Configuration
 * 
 * Configuration for GenericResourceTable to display Kubernetes Secrets.
 */

import * as AppAPI from '../../../wailsjs/go/main/App';
import { AnalyzeSecretStream } from '../../holmes/holmesApi';
import QuickInfoSection from '../../QuickInfoSection';
import ResourceEventsTab from '../../components/ResourceEventsTab';
import SecretDataTab from '../../k8s/resources/secrets/SecretDataTab';
import SecretConsumersTab from '../../k8s/resources/secrets/SecretConsumersTab';
import SecretYamlTab from '../../k8s/resources/secrets/SecretYamlTab';
import SummaryTabHeader from '../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../components/ResourceActions';
import HolmesBottomPanel from '../../holmes/HolmesBottomPanel';

/**
 * Column definitions for Secrets table
 */
export const secretColumns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'type', label: 'Type' },
  { key: 'keys', label: 'Keys' },
  { key: 'size', label: 'Size' },
  { key: 'age', label: 'Age' },
];

/**
 * Tab definitions for Secrets bottom panel
 */
export const secretTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'data', label: 'Data', countKey: 'data' },
  { key: 'consumers', label: 'Consumers', countKey: 'consumers' },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

/**
 * Normalize secret data from API response
 */
export const normalizeSecret = (s) => ({
  name: s.name ?? s.Name,
  namespace: s.namespace ?? s.Namespace,
  type: s.type ?? s.Type ?? 'Opaque',
  keys: s.keys ?? s.Keys ?? '-',
  size: s.size ?? s.Size ?? '-',
  age: s.age ?? s.Age ?? '-',
  labels: s.labels ?? s.Labels ?? s.metadata?.labels ?? {},
});

/**
 * Quick info fields for Summary tab
 */
const quickInfoFields = [
  {
    key: 'type',
    label: 'Type',
    layout: 'flex',
    rightField: {
      key: 'age',
      label: 'Age',
      type: 'age',
      getValue: (data) => data.created || data.age,
    },
  },
  { key: 'namespace', label: 'Namespace' },
  { key: 'keys', label: 'Keys' },
  { key: 'size', label: 'Size' },
  { key: 'name', label: 'Secret name', type: 'break-word' },
];

/**
 * Render panel content for each tab
 */
export const renderSecretPanelContent = (row, tab, holmesState, onAnalyze, onCancel) => {
  if (tab === 'summary') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels || row.Labels || row.metadata?.labels}
          actions={
            <ResourceActions
              resourceType="secret"
              name={row.name}
              namespace={row.namespace}
              onDelete={async (n, ns) => { await AppAPI.DeleteResource('secret', ns, n); }}
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
              <SecretDataTab namespace={row.namespace} secretName={row.name} />
            </div>
            <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
              <ResourceEventsTab namespace={row.namespace} kind="Secret" name={row.name} limit={20} />
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (tab === 'data') {
    return <SecretDataTab namespace={row.namespace} secretName={row.name} />;
  }
  
  if (tab === 'consumers') {
    return <SecretConsumersTab namespace={row.namespace} secretName={row.name} />;
  }
  
  if (tab === 'events') {
    return <ResourceEventsTab namespace={row.namespace} kind="Secret" name={row.name} />;
  }
  
  if (tab === 'yaml') {
    return <SecretYamlTab namespace={row.namespace} name={row.name} />;
  }
  
  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="Secret"
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
 * Complete secret configuration for GenericResourceTable
 */
export const secretConfig = {
  resourceType: 'secret',
  resourceKind: 'Secret',
  columns: secretColumns,
  tabs: secretTabs,
  fetchFn: AppAPI.GetSecrets,
  eventName: 'secrets:update',
  analyzeFn: AnalyzeSecretStream,
  normalize: normalizeSecret,
  renderPanelContent: renderSecretPanelContent,
  onDelete: async (name, namespace) => AppAPI.DeleteResource('secret', namespace, name),
  title: 'Secrets',
};

export default secretConfig;
