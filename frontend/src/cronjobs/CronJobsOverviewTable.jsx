import React from 'react';
import OverviewTableWithPanel from '../OverviewTableWithPanel';

const mockCronJobs = [
  { name: 'daily-backup', namespace: 'default', schedule: '0 2 * * *', suspend: false, age: '7d', image: 'busybox' },
  { name: 'weekly-report', namespace: 'dev', schedule: '0 5 * * 1', suspend: true, age: '14d', image: 'reporter:latest' },
];

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'suspend', label: 'Suspend' },
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
        <p><b>Schedule:</b> {row.schedule}</p>
        <p><b>Suspend:</b> {row.suspend ? 'Yes' : 'No'}</p>
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
kind: CronJob
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
spec:
  schedule: "${row.schedule}"
  suspend: ${row.suspend}
  jobTemplate:
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

export default function CronJobsOverviewTable() {
  return (
    <OverviewTableWithPanel
      columns={columns}
      data={mockCronJobs}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      panelHeader={panelHeader}
      title="Cron Jobs"
      resourceKind="CronJob"
    />
  );
}
