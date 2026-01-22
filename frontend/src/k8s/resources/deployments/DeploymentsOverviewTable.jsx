import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import DeploymentPodsTab from './DeploymentPodsTab';
import DeploymentRolloutTab from './DeploymentRolloutTab';
import AggregateLogsTab from '../../../components/AggregateLogsTab';
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
  { key: 'available', label: 'Available' },
  { key: 'age', label: 'Age' },
  { key: 'image', label: 'Image' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'pods', label: 'Pods' },
  { key: 'rollout', label: 'Rollout' },
  { key: 'logs', label: 'Logs' },
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
      { key: 'available', label: 'Available' },
      { key: 'image', label: 'Image', type: 'break-word' },
      { key: 'name', label: 'Deployment name', type: 'break-word' }
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels || row.Labels || row.metadata?.labels}
          actions={<ResourceActions resourceType="deployment" name={row.name} namespace={row.namespace} replicaCount={row.replicas} onRestart={async (n,ns)=>{await AppAPI.RestartDeployment(ns,n);}} onDelete={async (n,ns)=>{await AppAPI.DeleteResource("deployment", ns, n);}} />}
        />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          {/* Logs + Event History at a glance */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
              <AggregateLogsTab
                title="Logs"
                reloadKey={`${row.namespace}/${row.name}`}
                loadLogs={() => AppAPI.GetDeploymentLogs(row.namespace, row.name)}
              />
            </div>
            <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
              <ResourceEventsTab
                namespace={row.namespace}
                kind="Deployment"
                name={row.name}
                limit={20}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (tab === 'pods') {
    return <DeploymentPodsTab namespace={row.namespace} deploymentName={row.name} />;
  }
  if (tab === 'rollout') {
    return <DeploymentRolloutTab namespace={row.namespace} deploymentName={row.name} />;
  }
  if (tab === 'logs') {
    return (
      <AggregateLogsTab
        title="Deployment Logs"
        reloadKey={`${row.namespace}/${row.name}`}
        loadLogs={() => AppAPI.GetDeploymentLogs(row.namespace, row.name)}
      />
    );
  }
  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="Deployment"
        name={row.name}
      />
    );
  }
  if (tab === 'yaml') {
    const yamlContent = `apiVersion: apps/v1
kind: Deployment
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

export default function DeploymentsOverviewTable({ namespaces, namespace }) {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const nsArr = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : (namespace ? [namespace] : []);
    if (nsArr.length === 0) return;

    const normalize = (arr) => (arr || []).filter(Boolean).map(d => ({
      name: d.name ?? d.Name,
      namespace: d.namespace ?? d.Namespace,
      replicas: d.replicas ?? d.Replicas ?? 0,
      ready: d.ready ?? d.Ready ?? 0,
      available: d.available ?? d.Available ?? 0,
      age: d.age ?? d.Age ?? '-',
      image: d.image ?? d.Image ?? '',
      labels: d.labels ?? d.Labels ?? d.metadata?.labels ?? {}
    }));

    const fetchDeployments = async () => {
      try {
        setLoading(true);
        const lists = await Promise.all(nsArr.map(ns => AppAPI.GetDeployments(ns).catch(() => [])));
        const flat = lists.flat();
        setDeployments(normalize(flat));
      } catch (error) {
        console.error('Failed to fetch deployments:', error);
        setDeployments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDeployments();
  }, [namespaces, namespace]);

  // Subscribe to live deployment updates from backend (already aggregated)
  useEffect(() => {
    const onUpdate = (list) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        const norm = arr.map(d => ({
          name: d.name ?? d.Name,
          namespace: d.namespace ?? d.Namespace,
            replicas: d.replicas ?? d.Replicas ?? 0,
            ready: d.ready ?? d.Ready ?? 0,
            available: d.available ?? d.Available ?? 0,
            age: d.age ?? d.Age ?? '-',
            image: d.image ?? d.Image ?? '',
            labels: d.labels ?? d.Labels ?? d.metadata?.labels ?? {}
        }));
        setDeployments(norm);
      } catch (e) {
        setDeployments([]);
      } finally {
        setLoading(false);
      }
    };
    EventsOn('deployments:update', onUpdate);
    return () => {
      try { EventsOff('deployments:update'); } catch (_) {}
    };
  }, []);

  const getRowActions = (row) => [
    {
      label: 'Restart',
      icon: '🔄',
      onClick: async () => {
        try {
          await AppAPI.RestartDeployment(row.namespace, row.name);
          showSuccess(`Deployment '${row.name}' restarted`);
        } catch (err) {
          showError(`Failed to restart deployment '${row.name}': ${err?.message || err}`);
        }
      },
    },
    {
      label: 'Delete',
      icon: '🗑️',
      danger: true,
      onClick: async () => {
        try {
          await AppAPI.DeleteResource('deployment', row.namespace, row.name);
          showSuccess(`Deployment '${row.name}' deleted`);
        } catch (err) {
          showError(`Failed to delete deployment '${row.name}': ${err?.message || err}`);
        }
      },
    },
  ];

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={deployments}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      panelHeader={(row) => <span style={{ fontWeight: 600 }}>{row.name}</span>}
      title="Deployments"
      loading={loading}
      resourceKind="Deployment"
      namespace={namespace}
      getRowActions={getRowActions}
    />
  );
}
