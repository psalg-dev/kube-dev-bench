import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../OverviewTableWithPanel';
import * as AppAPI from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'suspend', label: 'Suspend' },
  { key: 'nextRun', label: 'Next run' },
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
        <p><b>Next run:</b> {row.nextRun || '-'}</p>
        <p><b>Image:</b> {row.image}</p>
        <p><b>Age:</b> {row.age}</p>
      </div>
    );
  }
  if (tab === 'events') {
    return (
      <div>
        <h3>Events</h3>
        <p>Events functionality not yet implemented for CronJobs.</p>
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

export default function CronJobsOverviewTable({ namespace }) {
  const [cronJobs, setCronJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const normalize = (arr) => (arr || []).map((d) => ({
    name: d.name ?? d.Name,
    namespace: d.namespace ?? d.Namespace,
    schedule: d.schedule ?? d.Schedule ?? '-',
    suspend: d.suspend ?? d.Suspend ?? false,
    nextRun: d.nextRun ?? d.NextRun ?? '-',
    age: d.age ?? d.Age ?? '-',
    image: d.image ?? d.Image ?? '',
  }));

  const fetchCronJobs = async () => {
    if (!namespace) return;
    setLoading(true);
    try {
      const result = await AppAPI.GetCronJobs(namespace);
      setCronJobs(normalize(Array.isArray(result) ? result : []));
    } catch (e) {
      console.error('Error fetching cronjobs:', e);
      setCronJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCronJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace]);

  useEffect(() => {
    const onUpdate = (list) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        const filtered = namespace ? arr.filter((d) => (d?.namespace || d?.Namespace) === namespace) : arr;
        setCronJobs(normalize(filtered));
      } catch (_) {
        setCronJobs([]);
      } finally {
        setLoading(false);
      }
    };
    EventsOn('cronjobs:update', onUpdate);
    return () => { try { EventsOff('cronjobs:update'); } catch (_) {} };
  }, [namespace]);

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={cronJobs}
      loading={loading}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      panelHeader={panelHeader}
      title="Cron Jobs"
      onRefresh={fetchCronJobs}
      resourceKind="CronJob"
      namespace={namespace}
    />
  );
}
