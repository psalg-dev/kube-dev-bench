import React from 'react';
import OverviewTableWithPanel from '../OverviewTableWithPanel';

const mockStatefulSets = [
  { name: 'db-statefulset', namespace: 'default', replicas: 3, ready: 3, age: '30d', image: 'postgres:13' },
  { name: 'cache-statefulset', namespace: 'dev', replicas: 2, ready: 2, age: '15d', image: 'redis:6' },
];

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'replicas', label: 'Replicas' },
  { key: 'ready', label: 'Ready' },
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
        <p><b>Replicas:</b> {row.replicas}</p>
        <p><b>Ready:</b> {row.ready}</p>
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
kind: StatefulSet
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
spec:
  replicas: ${row.replicas}
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

export default function StatefulSetsOverviewTable() {
  return (
    <OverviewTableWithPanel
      columns={columns}
      data={mockStatefulSets}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      panelHeader={panelHeader}
      title="Stateful Sets"
    />
  );
}
