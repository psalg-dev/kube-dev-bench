import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import ResourcePodsTab from '../../../components/ResourcePodsTab';
import ReplicaSetOwnerTab from './ReplicaSetOwnerTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import ResourceActions from '../../../components/ResourceActions.jsx';
import { showSuccess, showError } from '../../../notification';

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
  { key: 'pods', label: 'Pods' },
  { key: 'owner', label: 'Owner' },
  { key: 'events', label: 'Events' },
  { key: 'yaml', label: 'YAML' },
];

function renderPanelContent(row, tab) {
  if (tab === 'summary') {
    const quickInfoFields = [
      {
        key: 'replicas',
        label: 'Replicas',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data) => data.created || data.age
        }
      },
      { key: 'namespace', label: 'Namespace' },
      { key: 'ready', label: 'Ready' },
      { key: 'image', label: 'Image', type: 'break-word' },
      { key: 'name', label: 'ReplicaSet name', type: 'break-word' }
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader name={row.name} labels={row.labels || row.Labels || row.metadata?.labels} actions={<ResourceActions resourceType="replicaset" name={row.name} namespace={row.namespace} replicaCount={row.replicas} onDelete={async (n,ns)=>{await AppAPI.DeleteResource("replicaset", ns, n);}} />} />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          {/* Event History at a glance */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
            <ResourceEventsTab namespace={row.namespace} kind="ReplicaSet" name={row.name} limit={20} />
          </div>
        </div>
      </div>
    );
  }
  if (tab === 'pods') {
    return (
      <ResourcePodsTab
        namespace={row.namespace}
        resourceKind="ReplicaSet"
        resourceName={row.name}
      />
    );
  }
  if (tab === 'owner') {
    return (
      <ReplicaSetOwnerTab
        namespace={row.namespace}
        replicaSetName={row.name}
      />
    );
  }
  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="ReplicaSet"
        name={row.name}
      />
    );
  }
  if (tab === 'yaml') {
    const yamlContent = `apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
spec:
  replicas: ${row.replicas}
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

export default function ReplicaSetsOverviewTable({ namespaces, namespace }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Aggregate fetch across namespaces
  useEffect(() => {
    const nsArr = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : (namespace ? [namespace] : []);
    if (nsArr.length === 0) return;
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const lists = await Promise.all(nsArr.map(ns => AppAPI.GetReplicaSets(ns).catch(() => [])));
        if (cancelled) return;
        setItems(lists.flat());
      } catch (e) {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [namespaces, namespace]);

  // Live updates (already aggregated by backend polling)
  useEffect(() => {
    const onUpdate = (list) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        const norm = arr.map(x => ({
          name: x.name ?? x.Name,
          namespace: x.namespace ?? x.Namespace,
          replicas: x.replicas ?? x.Replicas ?? 0,
          ready: x.ready ?? x.Ready ?? 0,
          age: x.age ?? x.Age ?? '-',
          image: x.image ?? x.Image ?? '',
          labels: x.labels ?? x.Labels ?? x.metadata?.labels ?? {}
        }));
        setItems(norm);
      } catch (_) { setItems([]); } finally { setLoading(false); }
    };
    EventsOn('replicasets:update', onUpdate);
    return () => { try { EventsOff('replicasets:update'); } catch (_) {} };
  }, []);

  const getRowActions = (row) => [
    {
      label: 'Delete',
      icon: '🗑️',
      danger: true,
      onClick: async () => {
        try {
          await AppAPI.DeleteResource('replicaset', row.namespace, row.name);
          showSuccess(`ReplicaSet '${row.name}' deleted`);
        } catch (err) {
          showError(`Failed to delete ReplicaSet '${row.name}': ${err?.message || err}`);
        }
      },
    },
  ];

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={items}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      panelHeader={panelHeader}
      title="Replica Sets"
      resourceKind="ReplicaSet"
      namespace={namespace}
      loading={loading}
      getRowActions={getRowActions}
    />
  );
}
