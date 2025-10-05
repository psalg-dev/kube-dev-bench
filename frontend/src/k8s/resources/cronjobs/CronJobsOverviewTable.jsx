import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';

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
    const quickInfoFields = [
      {
        key: 'schedule',
        label: 'Schedule',
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
        key: 'suspend',
        label: 'Suspend',
        getValue: (data) => data.suspend ? 'Yes' : 'No'
      },
      { key: 'nextRun', label: 'Next run' },
      { key: 'image', label: 'Image', type: 'break-word' },
      { key: 'name', label: 'CronJob name', type: 'break-word' }
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader name={row.name} labels={row.labels || row.Labels || row.metadata?.labels} />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: '#c9d1d9' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          {/* Right side content area for additional information */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0, flexDirection: 'column', padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>CronJob Details</div>
            <div style={{ color: '#8b949e' }}>
              <strong>Schedule:</strong> {row.schedule || '-'}<br />
              <strong>Suspend:</strong> {row.suspend ? 'Yes' : 'No'}<br />
              <strong>Next Run:</strong> {row.nextRun || '-'}<br />
              <strong>Image:</strong> {row.image || '-'}
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
        <p>Events functionality not yet implemented for CronJobs.</p>
      </div>
    );
  }
  if (tab === 'yaml') {
    const yamlContent = `apiVersion: batch/v1
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
            image: ${row.image}`;

    return <YamlTab content={yamlContent} />;
  }
  return null;
}

function panelHeader(row) {
  return <span style={{ fontWeight: 600 }}>{row.name}</span>;
}

export default function CronJobsOverviewTable({ namespaces }) {
  const [cronJobs, setCronJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const normalize = (arr) => (arr || []).filter(Boolean).map((d) => ({
    name: d.name ?? d.Name,
    namespace: d.namespace ?? d.Namespace,
    schedule: d.schedule ?? d.Schedule ?? '-',
    suspend: d.suspend ?? d.Suspend ?? false,
    nextRun: d.nextRun ?? d.NextRun ?? '-',
    age: d.age ?? d.Age ?? '-',
    image: d.image ?? d.Image ?? '',
    labels: d.labels ?? d.Labels ?? d.metadata?.labels ?? {}
  }));

  const fetchAllCronJobs = async () => {
    if (!Array.isArray(namespaces) || namespaces.length === 0) {
      setCronJobs([]);
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.all(
        namespaces.map(ns => AppAPI.GetCronJobs(ns).catch(() => []))
      );
      // Flatten and normalize, filter out any nulls
      setCronJobs(normalize([].concat(...results).filter(Boolean)));
    } catch (e) {
      console.error('Error fetching cronjobs:', e);
      setCronJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllCronJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespaces]);

  useEffect(() => {
    const onUpdate = (list) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        const filtered = namespaces ? arr.filter((d) => namespaces.includes(d?.namespace || d?.Namespace)) : arr;
        setCronJobs(normalize(filtered));
      } catch (_) {
        setCronJobs([]);
      } finally {
        setLoading(false);
      }
    };
    EventsOn('cronjobs:update', onUpdate);
    return () => { try { EventsOff('cronjobs:update'); } catch (_) {} };
  }, [namespaces]);

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={cronJobs}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      panelHeader={panelHeader}
      title="Cron Jobs"
      resourceKind="cronjob"
      namespace={namespaces && namespaces.length === 1 ? namespaces[0] : ''}
    />
  );
}
