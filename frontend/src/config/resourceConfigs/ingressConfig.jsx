/**
 * Ingress Resource Configuration
 * 
 * Configuration for GenericResourceTable to display Kubernetes Ingresses.
 */

import * as AppAPI from '../../../wailsjs/go/main/App';
import { AnalyzeIngressStream } from '../../holmes/holmesApi';
import QuickInfoSection from '../../QuickInfoSection';
import ResourceEventsTab from '../../components/ResourceEventsTab';
import IngressRulesTab from '../../k8s/resources/ingresses/IngressRulesTab';
import IngressTLSTab from '../../k8s/resources/ingresses/IngressTLSTab';
import IngressBackendServicesTab from '../../k8s/resources/ingresses/IngressBackendServicesTab';
import IngressYamlTab from '../../k8s/resources/ingresses/IngressYamlTab';
import SummaryTabHeader from '../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../components/ResourceActions';
import HolmesBottomPanel from '../../holmes/HolmesBottomPanel';
import { showSuccess, showError } from '../../notification';

/**
 * Column definitions for Ingresses table
 */
export const ingressColumns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'class', label: 'Class' },
  { key: 'hosts', label: 'Hosts', render: (value) => Array.isArray(value) ? value.join(', ') : '-' },
  { key: 'address', label: 'Address' },
  { key: 'ports', label: 'Ports' },
  { key: 'age', label: 'Age' },
];

/**
 * Tab definitions for Ingresses bottom panel
 */
export const ingressTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'rules', label: 'Rules', countKey: 'rules' },
  { key: 'tls', label: 'TLS', countable: false },
  { key: 'services', label: 'Backend Services', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

/**
 * Normalize ingress data from API response
 */
export const normalizeIngress = (ing) => ({
  name: ing.name ?? ing.Name,
  namespace: ing.namespace ?? ing.Namespace,
  class: ing.class ?? ing.Class ?? '-',
  hosts: ing.hosts ?? ing.Hosts ?? [],
  address: ing.address ?? ing.Address ?? '-',
  ports: ing.ports ?? ing.Ports ?? '-',
  age: ing.age ?? ing.Age ?? '-',
  tls: ing.tls ?? ing.TLS ?? [],
  labels: ing.labels ?? ing.Labels ?? ing.metadata?.labels ?? {},
});

/**
 * Quick info fields for Summary tab
 */
const quickInfoFields = [
  {
    key: 'class',
    label: 'Class',
    layout: 'flex',
    rightField: {
      key: 'age',
      label: 'Age',
      type: 'age',
      getValue: (data) => data.created || data.age,
    },
  },
  { key: 'namespace', label: 'Namespace' },
  {
    key: 'hosts',
    label: 'Hosts',
    getValue: (data) => Array.isArray(data.hosts) ? data.hosts.join(', ') : '-',
  },
  { key: 'address', label: 'Address' },
  { key: 'ports', label: 'Ports' },
  { key: 'name', label: 'Ingress name', type: 'break-word' },
];

/**
 * Render panel content for each tab
 */
export const renderIngressPanelContent = (row, tab, holmesState, onAnalyze, onCancel) => {
  if (tab === 'summary') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels || row.Labels || row.metadata?.labels}
          actions={
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                disabled={!Array.isArray(row.hosts) || row.hosts.length === 0}
                onClick={() => {
                  try {
                    const host = Array.isArray(row.hosts) && row.hosts.length ? row.hosts[0] : null;
                    if (!host) return;
                    const hasTLS = Array.isArray(row.tls) && row.tls.some(tlsConfig =>
                      !tlsConfig.hosts || tlsConfig.hosts.length === 0 || tlsConfig.hosts.includes(host)
                    );
                    const protocol = hasTLS ? 'https' : 'http';
                    const url = `${protocol}://${host}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                    showSuccess(`Opening ${url}`);
                  } catch (e) {
                    showError(`Failed to open endpoint: ${e?.message || e}`);
                  }
                }}
                title={(Array.isArray(row.hosts) && row.hosts.length) ? 'Open first host in browser' : 'No hosts available'}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 4,
                  border: '1px solid #353a42',
                  background: '#2d323b',
                  color: '#fff',
                  cursor: (Array.isArray(row.hosts) && row.hosts.length) ? 'pointer' : 'not-allowed',
                  opacity: (Array.isArray(row.hosts) && row.hosts.length) ? 1 : 0.6,
                }}
              >
                Test Endpoint
              </button>
              <ResourceActions
                resourceType="ingress"
                name={row.name}
                namespace={row.namespace}
                onDelete={async (n, ns) => { await AppAPI.DeleteResource('ingress', ns, n); }}
              />
            </div>
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
              kind="Ingress"
              name={row.name}
              limit={20}
            />
          </div>
        </div>
      </div>
    );
  }
  
  if (tab === 'rules') {
    return <IngressRulesTab namespace={row.namespace} ingressName={row.name} hosts={row.hosts} />;
  }
  
  if (tab === 'tls') {
    return <IngressTLSTab namespace={row.namespace} ingressName={row.name} />;
  }
  
  if (tab === 'services') {
    return <IngressBackendServicesTab namespace={row.namespace} ingressName={row.name} />;
  }
  
  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="Ingress"
        name={row.name}
      />
    );
  }
  
  if (tab === 'yaml') {
    return <IngressYamlTab namespace={row.namespace} name={row.name} />;
  }
  
  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="Ingress"
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
 * Complete ingress configuration for GenericResourceTable
 */
export const ingressConfig = {
  resourceType: 'ingress',
  resourceKind: 'Ingress',
  columns: ingressColumns,
  tabs: ingressTabs,
  fetchFn: AppAPI.GetIngresses,
  eventName: 'ingresses:update',
  analyzeFn: AnalyzeIngressStream,
  normalize: normalizeIngress,
  renderPanelContent: renderIngressPanelContent,
  onDelete: async (name, namespace) => AppAPI.DeleteResource('ingress', namespace, name),
  title: 'Ingresses',
};

export default ingressConfig;
