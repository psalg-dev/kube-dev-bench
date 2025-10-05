import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOff, EventsOn } from '../../../../wailsjs/runtime';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import ResourceActions from '../../../components/ResourceActions.jsx';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'completions', label: 'Completions' },
  { key: 'succeeded', label: 'Succeeded' },
  { key: 'active', label: 'Active' },
  { key: 'failed', label: 'Failed' },
  { key: 'age', label: 'Age' },
  { key: 'duration', label: 'Duration' },
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
        key: 'completions',
        label: 'Completions',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data) => data.created || data.age
        }
      },
      { key: 'namespace', label: 'Namespace' },
      { key: 'succeeded', label: 'Succeeded' },
      { key: 'active', label: 'Active' },
      { key: 'failed', label: 'Failed' },
      { key: 'duration', label: 'Duration' },
      { key: 'image', label: 'Image', type: 'break-word' },
      { key: 'name', label: 'Job name', type: 'break-word' }
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader name={row.name} labels={row.labels || row.Labels || row.metadata?.labels} actions={<ResourceActions resourceType="job" name={row.name} namespace={row.namespace} onDelete={async (n,ns)=>{await AppAPI.DeleteResource("job", ns, n);}} />} />
        {/* Main flex content */}
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
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Job Details</div>
            <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>
              <strong>Completions:</strong> {row.completions || '0'}<br />
              <strong>Succeeded:</strong> {row.succeeded || '0'}<br />
              <strong>Active:</strong> {row.active || '0'}<br />
              <strong>Failed:</strong> {row.failed || '0'}<br />
              <strong>Duration:</strong> {row.duration || '-'}<br />
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
        <p>Events functionality not yet implemented for Jobs.</p>
      </div>
    );
  }
  if (tab === 'yaml') {
    const yamlContent = `apiVersion: batch/v1
kind: Job
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
spec:
  completions: ${row.completions}
  parallelism: 1
  template:
    spec:
      containers:
      - name: ${row.name}
        image: ${row.image}
      restartPolicy: Never`;

    return <YamlTab content={yamlContent} />;
  }
  return null;
}

function panelHeader(row) {
  return <span style={{ fontWeight: 600 }}>{row.name}</span>;
}

export default function JobsOverviewTable({ namespaces, namespace }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const normalize = (arr) => (arr || []).filter(Boolean).map(j => ({
    name: j.name ?? j.Name,
    namespace: j.namespace ?? j.Namespace,
    completions: j.completions ?? j.Completions ?? 0,
    succeeded: j.succeeded ?? j.Succeeded ?? 0,
    active: j.active ?? j.Active ?? 0,
    failed: j.failed ?? j.Failed ?? 0,
    age: j.age ?? j.Age ?? '-',
    duration: j.duration ?? j.Duration ?? '-',
    image: j.image ?? j.Image ?? '',
    labels: j.labels ?? j.Labels ?? j.metadata?.labels ?? {}
  }));

  // Fetch jobs data
  const fetchJobs = async () => {
    const nsArr = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : (namespace ? [namespace] : []);
    if (nsArr.length === 0) return;

    setLoading(true);
    try {
      const lists = await Promise.all(nsArr.map(ns => AppAPI.GetJobs(ns).catch(() => [])));
      setJobs(normalize(lists.flat()));
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch when namespace changes
  useEffect(() => {
    fetchJobs();
  }, [namespaces, namespace]);

  // Subscribe to jobs updates if available
  useEffect(() => {
    const handler = (jobsData) => {
      try { setJobs(normalize(Array.isArray(jobsData) ? jobsData : [])); } catch { setJobs([]); }
    };
    EventsOn('jobs:update', handler);
    return () => { try { EventsOff('jobs:update'); } catch (_) {} };
  }, []);

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={jobs}
      loading={loading}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      panelHeader={panelHeader}
      title="Jobs"
      onRefresh={fetchJobs}
      resourceKind="Job"
      namespace={namespace}
    />
  );
}
