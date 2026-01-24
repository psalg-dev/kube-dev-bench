import { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import SecretDataTab from './SecretDataTab';
import SecretConsumersTab from './SecretConsumersTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import ResourceActions from '../../../components/ResourceActions.jsx';
import { showSuccess, showError } from '../../../notification';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'type', label: 'Type' },
  { key: 'keys', label: 'Keys' },
  { key: 'size', label: 'Size' },
  { key: 'age', label: 'Age' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'data', label: 'Data' },
  { key: 'consumers', label: 'Consumers' },
  { key: 'events', label: 'Events' },
  { key: 'yaml', label: 'YAML' },
];

function renderPanelContent(row, tab) {
  if (tab === 'summary') {
    const quickInfoFields = [
      {
        key: 'type',
        label: 'Type',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data) => data.created || data.age
        }
      },
      { key: 'namespace', label: 'Namespace' },
      { key: 'keys', label: 'Keys' },
      { key: 'size', label: 'Size' },
      { key: 'name', label: 'Secret name', type: 'break-word' }
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader name={row.name} labels={row.labels || row.Labels || row.metadata?.labels} actions={<ResourceActions resourceType="secret" name={row.name} namespace={row.namespace} onDelete={async (n,ns)=>{await AppAPI.DeleteResource('secret', ns, n);}} />} />
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
              <SecretDataTab namespace={row.namespace} secretName={row.name} />
            </div>
            <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
              <ResourceEventsTab namespace={row.namespace} resourceKind="Secret" resourceName={row.name} limit={20} />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (tab === 'data') {
    return (
      <SecretDataTab
        namespace={row.namespace}
        secretName={row.name}
      />
    );
  }
  if (tab === 'consumers') {
    return (
      <SecretConsumersTab
        namespace={row.namespace}
        secretName={row.name}
      />
    );
  }
  if (tab === 'events') {
    return <ResourceEventsTab namespace={row.namespace} resourceKind="Secret" resourceName={row.name} />;
  }
  if (tab === 'yaml') {
    const yamlContent = `apiVersion: v1
kind: Secret
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
type: ${row.type}
data:
  # Secret data would appear here (base64 encoded)
  # Use kubectl get secret ${row.name} -o yaml for actual content`;

    return <YamlTab content={yamlContent} />;
  }
  return null;
}

export default function SecretsOverviewTable({ namespaces, _onSecretCreate }) {
  const [data, setData] = useState([]);
  const [_loading, setLoading] = useState(false);
  const [_error, setError] = useState(null);

  const normalize = (arr) => (arr || []).filter(Boolean).map((s) => ({
    name: s.name ?? s.Name,
    namespace: s.namespace ?? s.Namespace,
    type: s.type ?? s.Type ?? '-',
    keys: s.keys ?? s.Keys ?? '-',
    size: s.size ?? s.Size ?? '-',
    age: s.age ?? s.Age ?? '-',
    labels: s.labels ?? s.Labels ?? s.metadata?.labels ?? {}
  }));

  const fetchAllSecrets = async () => {
    if (!Array.isArray(namespaces) || namespaces.length === 0) {
      setData([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        namespaces.map(ns => AppAPI.GetSecrets(ns).catch(() => []))
      );
      setData(normalize([].concat(...results).filter(Boolean)));
    } catch (err) {
      console.error('Error fetching secrets:', err);
      setError(err.message || 'Failed to fetch secrets');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllSecrets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespaces]);

  useEffect(() => {
    const onUpdate = (list) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        setData(normalize(arr));
      } catch { /* ignore */ }
    };
    EventsOn('secrets:update', onUpdate);
    return () => { try { EventsOff('secrets:update'); } catch (_) {} };
  }, [namespaces]);

  const getRowActions = (row) => [
    {
      label: 'Delete',
      icon: '🗑️',
      danger: true,
      onClick: async () => {
        try {
          await AppAPI.DeleteResource('secret', row.namespace, row.name);
          showSuccess(`Secret '${row.name}' deleted`);
        } catch (err) {
          showError(`Failed to delete Secret '${row.name}': ${err?.message || err}`);
        }
      },
    },
  ];

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={data}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      title="Secrets"
      resourceKind="secret"
      namespace={namespaces && namespaces.length === 1 ? namespaces[0] : ''}
      getRowActions={getRowActions}
    />
  );
}
