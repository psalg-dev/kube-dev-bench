import React from 'react';
import OverviewTableWithPanel from '../OverviewTableWithPanel';

const mockDaemonSets = [
  { name: 'log-collector', namespace: 'default', desired: 3, current: 3, age: '12d', image: 'fluentd:latest' },
  { name: 'node-monitor', namespace: 'dev', desired: 2, current: 2, age: '2d', image: 'monitor:v1.0' },
];

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'desired', label: 'Desired' },
  { key: 'current', label: 'Current' },
  { key: 'age', label: 'Age' },
  { key: 'image', label: 'Image' },
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
        <p><b>Desired:</b> {row.desired}</p>
        <p><b>Current:</b> {row.current}</p>
        <p><b>Image:</b> {row.image}</p>
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
{`apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
spec:
  template:
    spec:
      containers:
      - name: ${row.name}
        image: ${row.image}`}
        </pre>
      </div>
    );
  }
  return null;
}

function panelHeader(row) {
  return <span style={{ fontWeight: 600 }}>{row.name}</span>;
}

export default function DaemonSetsOverviewTable() {
  return (
    <OverviewTableWithPanel
      columns={columns}
      data={mockDaemonSets}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      panelHeader={panelHeader}
      title="Daemon Sets"
      resourceKind="DaemonSet"
    />
  );
}
