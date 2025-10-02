import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../OverviewTableWithPanel';
import * as AppAPI from '../../wailsjs/go/main/App';
import { EventsOff, EventsOn } from '../../wailsjs/runtime';

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
    return (
      <div>
        <h3>Summary</h3>
        <p><b>Name:</b> {row.name}</p>
        <p><b>Namespace:</b> {row.namespace}</p>
        <p><b>Completions:</b> {row.completions}</p>
        <p><b>Succeeded:</b> {row.succeeded}</p>
        <p><b>Active:</b> {row.active}</p>
        <p><b>Failed:</b> {row.failed}</p>
        <p><b>Image:</b> {row.image}</p>
        <p><b>Age:</b> {row.age}</p>
        <p><b>Duration:</b> {row.duration}</p>
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

export default function JobsOverviewTable({ namespaces, namespace }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch jobs data
  const fetchJobs = async () => {
    const nsArr = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : (namespace ? [namespace] : []);
    if (nsArr.length === 0) return;

    setLoading(true);
    try {
      const lists = await Promise.all(nsArr.map(ns => AppAPI.GetJobs(ns).catch(() => [])));
      setJobs(lists.flat());
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
      setJobs(Array.isArray(jobsData) ? jobsData : []);
    };

    EventsOn('jobs:update', handler);
    return () => {
      try {
        EventsOff('jobs:update');
      } catch (_) {}
    };
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
