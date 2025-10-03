import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../OverviewTableWithPanel';
import QuickInfoSection from '../QuickInfoSection';
import YamlViewer from '../YamlViewer';
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
        <div style={{
          padding: '8px 10px',
          borderBottom: '1px solid var(--gh-border, #30363d)',
          background: 'var(--gh-bg-sidebar, #161b22)',
          color: 'var(--gh-text, #c9d1d9)'
        }}>
          Summary for {row.name}
        </div>
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          {/* Right side content area for additional information */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0, flexDirection: 'column', padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Ingress Details</div>
            <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>
              <strong>Class:</strong> {row.class || '-'}<br />
              <strong>Hosts:</strong> {Array.isArray(row.hosts) ? row.hosts.join(', ') : '-'}<br />
              <strong>Address:</strong> {row.address || '-'}<br />
              <strong>Ports:</strong> {row.ports || '-'}<br />
              <strong>Namespace:</strong> {row.namespace || '-'}
            </div>
          </div>
        </div>
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
    const hostsYaml = Array.isArray(row.hosts) ? row.hosts.map(host => `  - host: ${host}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ${row.name}-service
            port:
              number: 80`).join('\n') : `  - host: example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ${row.name}-service
            port:
              number: 80`;

    const yamlContent = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
spec:${row.class ? `\n  ingressClassName: ${row.class}` : ''}
  rules:
${hostsYaml}`;

    return <YamlViewer content={yamlContent} />;
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
