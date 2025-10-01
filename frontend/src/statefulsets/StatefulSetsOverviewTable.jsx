import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../OverviewTableWithPanel';
import * as AppAPI from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime';

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

export default function StatefulSetsOverviewTable({ namespace }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initial fetch by namespace
  useEffect(() => {
    if (!namespace) return;
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const data = await AppAPI.GetStatefulSets(namespace);
        if (cancelled) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [namespace]);

  // Live updates
  useEffect(() => {
    const onUpdate = (list) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        const filtered = namespace ? arr.filter(x => (x?.namespace || x?.Namespace) === namespace) : arr;
        const norm = filtered.map(x => ({
          name: x.name ?? x.Name,
          namespace: x.namespace ?? x.Namespace,
          replicas: x.replicas ?? x.Replicas ?? 0,
          ready: x.ready ?? x.Ready ?? 0,
          age: x.age ?? x.Age ?? '-',
          image: x.image ?? x.Image ?? '',
        }));
        setItems(norm);
      } catch (_) {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    EventsOn('statefulsets:update', onUpdate);
    return () => { try { EventsOff('statefulsets:update'); } catch (_) {} };
  }, [namespace]);

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={items}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      panelHeader={panelHeader}
      title="Stateful Sets"
      resourceKind="StatefulSet"
      namespace={namespace}
      loading={loading}
    />
  );
}
