import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../OverviewTableWithPanel';
import * as AppAPI from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime';

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
  { key: 'events', label: 'Events' },
  { key: 'yaml', label: 'YAML' },
];

function renderPanelContent(row, tab) {
  if (tab === 'summary') {
    return (
      <div>
        <h3>Summary</h3>
        <p><b>Name:</b> {row.name}</p>
        <p><b>Namespace:</b> {row.namespace}</p>
        <p><b>Type:</b> {row.type}</p>
        <p><b>Keys:</b> {row.keys}</p>
        <p><b>Size:</b> {row.size}</p>
        <p><b>Age:</b> {row.age}</p>
      </div>
    );
  }
  if (tab === 'events') {
    return (
      <div>
        <h3>Events</h3>
        <p>No events (mock data).</p>
      </div>
    );
  }
  if (tab === 'yaml') {
    return (
      <div>
        <h3>YAML</h3>
        <pre style={{ background: '#222', color: '#eee', padding: 12 }}>
{`apiVersion: v1
kind: Secret
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
type: ${row.type}
data:
  # Secret data would appear here (base64 encoded)
  # Use kubectl get secret ${row.name} -o yaml for actual content`}
        </pre>
      </div>
    );
  }
  return null;
}

export default function SecretsOverviewTable({ namespace, onSecretCreate }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSecrets = async () => {
    if (!namespace) return;

    setLoading(true);
    setError(null);
    try {
      const secrets = await AppAPI.GetSecrets(namespace);
      setData(secrets || []);
    } catch (err) {
      console.error('Error fetching secrets:', err);
      setError(err.message || 'Failed to fetch secrets');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecrets();
  }, [namespace]);

  useEffect(() => {
    const unsubscribe = EventsOn('resource-updated', (eventData) => {
      if (eventData?.resource === 'secret' && eventData?.namespace === namespace) {
        fetchSecrets();
      }
    });

    return () => {
      EventsOff('resource-updated', unsubscribe);
    };
  }, [namespace]);

  return (
    <OverviewTableWithPanel
      data={data}
      columns={columns}
      loading={loading}
      error={error}
      onRefresh={fetchSecrets}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      onCreateResource={onSecretCreate}
      resourceType="Secret"
    />
  );
}
