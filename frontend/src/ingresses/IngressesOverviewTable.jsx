import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../OverviewTableWithPanel';
import * as AppAPI from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime';

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
        <p><b>Class:</b> {row.class || '-'}</p>
        <p><b>Hosts:</b> {Array.isArray(row.hosts) ? row.hosts.join(', ') : '-'}</p>
        <p><b>Address:</b> {row.address}</p>
        <p><b>Ports:</b> {row.ports}</p>
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
    const hostsYaml = Array.isArray(row.hosts) ? row.hosts.map(host => `  - host: ${host}`).join('\n') : '';
    return (
      <div>
        <h3>YAML</h3>
        <pre style={{ background: '#222', color: '#eee', padding: 12 }}>
{`apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
spec:${row.class ? `\n  ingressClassName: ${row.class}` : ''}
  rules:
${hostsYaml || '  - host: example.com'}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: example-service
            port:
              number: 80`}
        </pre>
      </div>
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

  const normalize = (arr) => (arr || []).filter(Boolean).map((i) => ({
    name: i.name ?? i.Name,
    namespace: i.namespace ?? i.Namespace,
    class: i.class ?? i.Class ?? '-',
    hosts: i.hosts ?? i.Hosts ?? [],
    address: i.address ?? i.Address ?? '-',
    ports: i.ports ?? i.Ports ?? '-',
    age: i.age ?? i.Age ?? '-',
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
      } catch (e) {
        // ignore malformed payloads
      }
    };
    EventsOn('ingresses:update', onUpdate);
    return () => {
      EventsOff('ingresses:update', onUpdate);
    };
  }, [namespaces]);

  return (
    <OverviewTableWithPanel
      title="Ingresses"
      columns={columns}
      data={ingresses}
      loading={loading}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      panelHeader={panelHeader}
      resourceKind="ingress"
      namespace={namespaces && namespaces.length === 1 ? namespaces[0] : ''}
    />
  );
}
