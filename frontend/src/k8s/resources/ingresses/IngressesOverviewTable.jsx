import { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import IngressYamlTab from './IngressYamlTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import IngressRulesTab from './IngressRulesTab';
import IngressTLSTab from './IngressTLSTab';
import IngressBackendServicesTab from './IngressBackendServicesTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import ResourceActions from '../../../components/ResourceActions.jsx';
import { showSuccess, showError } from '../../../notification';
import { AnalyzeIngressStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';
import { useHolmesAnalysis } from '../../../hooks/useHolmesAnalysis';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'class', label: 'Class' },
  { key: 'hosts', label: 'Hosts', render: (value) => Array.isArray(value) ? value.join(', ') : '-' },
  { key: 'address', label: 'Address' },
  { key: 'ports', label: 'Ports' },
  { key: 'age', label: 'Age' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'rules', label: 'Rules', countKey: 'rules' },
  { key: 'tls', label: 'TLS', countable: false },
  { key: 'services', label: 'Backend Services', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

function renderPanelContent(row, tab, holmesState, onAnalyze, onCancel) {
  if (tab === 'summary') {
    const quickInfoFields = [
      {
        key: 'class',
        label: 'Class',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data) => data.created || data.age
        }
      },
      { key: 'namespace', label: 'Namespace' },
      {
        key: 'hosts',
        label: 'Hosts',
        getValue: (data) => Array.isArray(data.hosts) ? data.hosts.join(', ') : '-'
      },
      { key: 'address', label: 'Address' },
      { key: 'ports', label: 'Ports' },
      { key: 'name', label: 'Ingress name', type: 'break-word' }
    ];

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
                    // Check if TLS is configured for this host
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
              <ResourceActions resourceType="ingress" name={row.name} namespace={row.namespace} onDelete={async (n,ns)=>{await AppAPI.DeleteResource('ingress', ns, n);}} />
            </div>
          }
        />
        {/* Main content */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          {/* Event History at a glance */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
            <ResourceEventsTab namespace={row.namespace} resourceKind="Ingress" resourceName={row.name} limit={20} />
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
    return <ResourceEventsTab namespace={row.namespace} resourceKind="Ingress" resourceName={row.name} />;
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

function panelHeader(row) {
  return <span style={{ fontWeight: 600 }}>{row.name}</span>;
}

export default function IngressesOverviewTable({ namespaces }) {
  const [ingresses, setIngresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { state: holmesState, analyze: analyzeIngress, cancel: cancelHolmesAnalysis } = useHolmesAnalysis({
    kind: 'Ingress',
    analyzeFn: AnalyzeIngressStream,
  });

  const normalize = (arr) => (arr || []).filter(Boolean).map((i) => ({
    name: i.name ?? i.Name,
    namespace: i.namespace ?? i.Namespace,
    class: i.class ?? i.Class ?? '-',
    hosts: i.hosts ?? i.Hosts ?? [],
    tls: i.tls ?? i.Tls ?? i.TLS ?? [],
    address: i.address ?? i.Address ?? '-',
    ports: i.ports ?? i.Ports ?? '-',
    age: i.age ?? i.Age ?? '-',
    labels: i.labels ?? i.Labels ?? i.metadata?.labels ?? {}
  }));

  const fetchAllIngresses = async () => {
    if (!Array.isArray(namespaces) || namespaces.length === 0) {
      setIngresses([]);
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.all(
        namespaces.map(ns => AppAPI.GetIngresses(ns).catch(() => []))
      );
      setIngresses(normalize([].concat(...results).filter(Boolean)));
    } catch (error) {
      console.error('Failed to fetch ingresses:', error);
      setIngresses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllIngresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespaces]);

  // Subscribe to backend updates to refresh automatically
  useEffect(() => {
    const onUpdate = (list) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        const filtered = namespaces ? arr.filter(i => namespaces.includes(i?.namespace || i?.Namespace)) : arr;
        setIngresses(normalize(filtered));
      } catch (_e) {
        // ignore malformed payloads
      }
    };
    EventsOn('ingresses:update', onUpdate);
    return () => {
      EventsOff('ingresses:update', onUpdate);
    };
  }, [namespaces]);

  const getRowActions = (row, api) => {
    const key = `${row.namespace}/${row.name}`;
    const isAnalyzing = holmesState.loading && holmesState.key === key;
    return [
      {
        label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
        icon: '🧠',
        disabled: isAnalyzing,
        onClick: () => {
          analyzeIngress(row);
          api?.openDetails?.('holmes');
        },
      },
      {
        label: 'Test Endpoint',
        icon: '🔗',
        disabled: !Array.isArray(row.hosts) || row.hosts.length === 0,
        onClick: () => {
          try {
            const host = Array.isArray(row.hosts) && row.hosts.length ? row.hosts[0] : null;
            if (!host) return;
            const url = `https://${host}`;
            window.open(url, '_blank', 'noopener,noreferrer');
            showSuccess(`Opening ${url}`);
          } catch (e) {
            showError(`Failed to open endpoint: ${e?.message || e}`);
          }
        },
      },
      {
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        onClick: async () => {
          try {
            await AppAPI.DeleteResource('ingress', row.namespace, row.name);
            showSuccess(`Ingress '${row.name}' deleted`);
          } catch (err) {
            showError(`Failed to delete Ingress '${row.name}': ${err?.message || err}`);
          }
        },
      },
    ];
  };

  return (
    <OverviewTableWithPanel
      title="Ingresses"
      columns={columns}
      data={ingresses}
      loading={loading}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeIngress, cancelHolmesAnalysis)}
      panelHeader={panelHeader}
      resourceKind="ingress"
      namespace={namespaces && namespaces.length === 1 ? namespaces[0] : ''}
      getRowActions={getRowActions}
    />
  );
}
