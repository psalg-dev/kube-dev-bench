import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import ResourcePodsTab from '../../../components/ResourcePodsTab';
import AggregateLogsTab from '../../../components/AggregateLogsTab';
import DaemonSetNodeCoverageTab from './DaemonSetNodeCoverageTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import ResourceActions from '../../../components/ResourceActions.jsx';
import { showSuccess, showError } from '../../../notification';
import { AnalyzeDaemonSet, onHolmesContextProgress } from '../../../holmes/holmesApi';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';

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
  { key: 'pods', label: 'Pods' },
  { key: 'coverage', label: 'Node Coverage' },
  { key: 'logs', label: 'Logs' },
  { key: 'events', label: 'Events' },
  { key: 'yaml', label: 'YAML' },
  { key: 'holmes', label: 'Holmes' },
];

function renderPanelContent(row, tab, holmesState, onAnalyze) {
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
        <SummaryTabHeader name={row.name} labels={row.labels || row.Labels || row.metadata?.labels} actions={<ResourceActions resourceType="daemonset" name={row.name} namespace={row.namespace} replicaCount={row.desired} onRestart={async (n,ns)=>{ if(AppAPI.RestartDaemonSet){ await AppAPI.RestartDaemonSet(ns,n);} else { throw new Error('RestartDaemonSet API unavailable; rebuild bindings'); }} } onDelete={async (n,ns)=>{await AppAPI.DeleteResource("daemonset", ns, n);}} />} />
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
                loadLogs={() => AppAPI.GetDaemonSetLogs(row.namespace, row.name)}
              />
            </div>
            <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
              <ResourceEventsTab
                namespace={row.namespace}
                kind="DaemonSet"
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
    return (
      <ResourcePodsTab
        namespace={row.namespace}
        resourceKind="DaemonSet"
        resourceName={row.name}
      />
    );
  }
  if (tab === 'coverage') {
    return <DaemonSetNodeCoverageTab namespace={row.namespace} daemonSetName={row.name} />;
  }
  if (tab === 'logs') {
    return (
      <AggregateLogsTab
        title="DaemonSet Logs"
        reloadKey={`${row.namespace}/${row.name}`}
        loadLogs={() => AppAPI.GetDaemonSetLogs(row.namespace, row.name)}
      />
    );
  }
  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="DaemonSet"
        name={row.name}
      />
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
  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="DaemonSet"
        namespace={row.namespace}
        name={row.name}
        onAnalyze={() => onAnalyze(row)}
        response={holmesState.key === key ? holmesState.response : null}
        loading={holmesState.key === key && holmesState.loading}
        error={holmesState.key === key ? holmesState.error : null}
            queryTimestamp={holmesState.key === key ? holmesState.queryTimestamp : null}
            streamingText={holmesState.key === key ? holmesState.streamingText : ''}
            reasoningText={holmesState.key === key ? holmesState.reasoningText : ''}
            toolEvents={holmesState.key === key ? holmesState.toolEvents : []}
            contextSteps={holmesState.key === key ? holmesState.contextSteps : []}
      />
    );
  }
  return null;
}

function panelHeader(row) {
  return <span style={{ fontWeight: 600 }}>{row.name}</span>;
}

export default function DaemonSetsOverviewTable({ namespaces, namespace }) {
  const [daemonSets, setDaemonSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [holmesState, setHolmesState] = useState({
    loading: false,
    response: null,
    error: null,
    key: null,
    queryTimestamp: null,
    contextSteps: [],
  });

  useEffect(() => {
    const unsubscribe = onHolmesContextProgress((event) => {
      if (!event?.key) return;
      setHolmesState((prev) => {
        if (prev.key !== event.key) return prev;
        const id = event.step || 'step';
        const nextSteps = Array.isArray(prev.contextSteps) ? [...prev.contextSteps] : [];
        const idx = nextSteps.findIndex((item) => item.id === id);
        const entry = {
          id,
          step: event.step,
          status: event.status || 'running',
          detail: event.detail || '',
        };
        if (idx >= 0) {
          nextSteps[idx] = { ...nextSteps[idx], ...entry };
        } else {
          nextSteps.push(entry);
        }
        return { ...prev, contextSteps: nextSteps };
      });
    });
    return () => {
      try { unsubscribe?.(); } catch (_) {}
    };
  }, []);

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

  const analyzeDaemonSet = async (row) => {
    const key = `${row.namespace}/${row.name}`;
    setHolmesState({
      loading: true,
      response: null,
      error: null,
      key,
      queryTimestamp: new Date().toISOString(),
      contextSteps: [],
    });
    try {
      const response = await AnalyzeDaemonSet(row.namespace, row.name);
      setHolmesState((prev) => ({ ...prev, loading: false, response, error: null, key }));
    } catch (err) {
      const message = err?.message || String(err);
      setHolmesState((prev) => ({ ...prev, loading: false, response: null, error: message, key }));
      showError(`Holmes analysis failed: ${message}`);
    }
  };

  const getRowActions = (row, api) => {
    const key = `${row.namespace}/${row.name}`;
    const isAnalyzing = holmesState.loading && holmesState.key === key;
    return [
      {
        label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
        icon: '🧠',
        disabled: isAnalyzing,
        onClick: () => {
          analyzeDaemonSet(row);
          api?.openDetails?.('holmes');
        },
      },
      {
        label: 'Restart',
        icon: '🔄',
        onClick: async () => {
          try {
            if (AppAPI.RestartDaemonSet) {
              await AppAPI.RestartDaemonSet(row.namespace, row.name);
              showSuccess(`DaemonSet '${row.name}' restarted`);
            } else {
              showError('RestartDaemonSet API unavailable');
            }
          } catch (err) {
            showError(`Failed to restart DaemonSet '${row.name}': ${err?.message || err}`);
          }
        },
      },
      {
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        onClick: async () => {
          try {
            await AppAPI.DeleteResource('daemonset', row.namespace, row.name);
            showSuccess(`DaemonSet '${row.name}' deleted`);
          } catch (err) {
            showError(`Failed to delete DaemonSet '${row.name}': ${err?.message || err}`);
          }
        },
      },
    ];
  };

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={daemonSets}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeDaemonSet)}
      panelHeader={panelHeader}
      title="Daemon Sets"
      resourceKind="DaemonSet"
      namespace={namespace}
      loading={loading}
      getRowActions={getRowActions}
    />
  );
}
