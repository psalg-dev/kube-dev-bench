import React from 'react';
import OverviewTableWithPanel from '../OverviewTableWithPanel';

const mockDeployments = [
  { name: 'nginx-deployment', namespace: 'default', replicas: 3, available: 3, age: '2d', image: 'nginx:1.14.2' },
  { name: 'api-deployment', namespace: 'dev', replicas: 2, available: 2, age: '5h', image: 'myapi:latest' },
  { name: 'worker-deployment', namespace: 'prod', replicas: 5, available: 4, age: '10d', image: 'worker:v2.0' },
];

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'replicas', label: 'Replicas' },
  { key: 'available', label: 'Available' },
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
        <p><b>Available:</b> {row.available}</p>
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
kind: Deployment
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

export default function DeploymentsOverviewTable() {
  return (
    <OverviewTableWithPanel
      columns={columns}
      data={mockDeployments}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      panelHeader={panelHeader}
      title="Deployments"
    />
  );
}
