import React from 'react';
import OverviewTableWithPanel from '../OverviewTableWithPanel';

const mockJobs = [
  { name: 'backup-job', namespace: 'default', completions: 1, succeeded: 1, age: '1d', image: 'busybox' },
  { name: 'report-job', namespace: 'dev', completions: 2, succeeded: 2, age: '3h', image: 'reporter:latest' },
];

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'completions', label: 'Completions' },
  { key: 'succeeded', label: 'Succeeded' },
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
        <p><b>Completions:</b> {row.completions}</p>
        <p><b>Succeeded:</b> {row.succeeded}</p>
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
{`apiVersion: batch/v1
kind: Job
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
spec:
  completions: ${row.completions}
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

export default function JobsOverviewTable() {
  return (
    <OverviewTableWithPanel
      columns={columns}
      data={mockJobs}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      panelHeader={panelHeader}
      title="Jobs"
    />
  );
}
