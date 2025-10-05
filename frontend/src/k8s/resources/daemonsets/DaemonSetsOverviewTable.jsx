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
    const quickInfoFields = [
      {
        key: 'desired',
        label: 'Desired',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data) => data.created || data.age
        }
      },
      { key: 'namespace', label: 'Namespace' },
      { key: 'current', label: 'Current' },
      { key: 'image', label: 'Image', type: 'break-word' },
      { key: 'name', label: 'DaemonSet name', type: 'break-word' }
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader name={row.name} labels={row.labels || row.Labels || row.metadata?.labels} />
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
            <div style={{ fontWeight: 600, marginBottom: 12 }}>DaemonSet Details</div>
            <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>
              <strong>Desired:</strong> {row.desired || '0'}<br />
              <strong>Current:</strong> {row.current || '0'}<br />
              <strong>Image:</strong> {row.image || '-'}<br />
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
        <p>No events (not implemented yet).</p>
      </div>
    );
  }
  if (tab === 'yaml') {
    const yamlContent = `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
spec:
  selector:
    matchLabels:
      app: ${row.name}
  template:
    metadata:
      labels:
        app: ${row.name}
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

export default function DaemonSetsOverviewTable({ namespaces, namespace }) {
  const [daemonSets, setDaemonSets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onUpdate = (list) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        const norm = arr.map(d => ({
          name: d.name ?? d.Name,
          namespace: d.namespace ?? d.Namespace,
          desired: d.desired ?? d.Desired ?? 0,
          current: d.current ?? d.Current ?? 0,
          age: d.age ?? d.Age ?? '-',
          image: d.image ?? d.Image ?? '',
          labels: d.labels ?? d.Labels ?? d.metadata?.labels ?? {}
        }));
        setDaemonSets(norm);
      } catch (_) {
        setDaemonSets([]);
      } finally { setLoading(false); }
    };
    EventsOn('daemonsets:update', onUpdate);
    return () => { try { EventsOff('daemonsets:update'); } catch (_) {} };
  }, []);

  useEffect(() => {
    const nsArr = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : (namespace ? [namespace] : []);
    if (nsArr.length === 0) return;
    const fetchDaemonSets = async () => {
      try {
        setLoading(true);
        const lists = await Promise.all(nsArr.map(ns => AppAPI.GetDaemonSets(ns).catch(() => [])));
        const flat = lists.flat().map(d => ({
          name: d.name ?? d.Name,
          namespace: d.namespace ?? d.Namespace,
          desired: d.desired ?? d.Desired ?? 0,
          current: d.current ?? d.Current ?? 0,
          age: d.age ?? d.Age ?? '-',
          image: d.image ?? d.Image ?? '',
          labels: d.labels ?? d.Labels ?? d.metadata?.labels ?? {}
        }));
        setDaemonSets(flat);
      } catch (error) {
        setDaemonSets([]);
      } finally { setLoading(false); }
    };
    fetchDaemonSets();
  }, [namespaces, namespace]);

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={daemonSets}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      panelHeader={panelHeader}
      title="Daemon Sets"
      resourceKind="DaemonSet"
      namespace={namespace}
      loading={loading}
    />
  );
}
