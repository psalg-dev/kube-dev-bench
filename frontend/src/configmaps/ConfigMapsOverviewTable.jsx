import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../OverviewTableWithPanel';
import * as AppAPI from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
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
kind: ConfigMap
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
data:
  # Configuration data would appear here
  key: value`}
        </pre>
      </div>
    );
  }
  return null;
}

export default function ConfigMapsOverviewTable({ namespace, onConfigMapCreate }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchConfigMaps = async () => {
    if (!namespace) return;

    setLoading(true);
    setError(null);
    try {
      const configmaps = await AppAPI.GetConfigMaps(namespace);
      setData(configmaps || []);
    } catch (err) {
      console.error('Error fetching configmaps:', err);
      setError(err.message || 'Failed to fetch configmaps');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigMaps();
  }, [namespace]);

  useEffect(() => {
    const unsubscribe = EventsOn('resource-updated', (eventData) => {
      if (eventData?.resource === 'configmap' && eventData?.namespace === namespace) {
        fetchConfigMaps();
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
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      resourceName="ConfigMap"
      onResourceCreate={onConfigMapCreate}
    />
  );
}
