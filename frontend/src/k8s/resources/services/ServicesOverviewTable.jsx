import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import ResourceActions from '../../../components/ResourceActions.jsx';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import { showSuccess, showError } from '../../../notification';
import { AnalyzeService, onHolmesContextProgress } from '../../../holmes/holmesApi';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'type', label: 'Type' },
  { key: 'clusterIP', label: 'Cluster IP' },
  { key: 'ports', label: 'Ports' },
  { key: 'age', label: 'Age' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'events', label: 'Events' },
  { key: 'yaml', label: 'YAML' },
  { key: 'holmes', label: 'Holmes' },
];

function renderPanelContent(row, tab, holmesState, onAnalyze) {
  if (tab === 'summary') {
    const quickInfoFields = [
      { key: 'name', label: 'Service name', type: 'break-word' },
      { key: 'namespace', label: 'Namespace' },
      { key: 'type', label: 'Type' },
      { key: 'clusterIP', label: 'Cluster IP' },
      { key: 'ports', label: 'Ports' },
      { key: 'age', label: 'Age' },
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels || row.Labels || row.metadata?.labels}
          actions={(
            <ResourceActions
              resourceType="service"
              name={row.name}
              namespace={row.namespace}
              onDelete={async (n, ns) => {
                await AppAPI.DeleteResource('service', ns, n);
              }}
            />
          )}
        />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
            <ResourceEventsTab
              namespace={row.namespace}
              kind="Service"
              name={row.name}
              limit={20}
            />
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="Service"
        name={row.name}
      />
    );
  }

  if (tab === 'yaml') {
    const yamlContent = `apiVersion: v1\nkind: Service\nmetadata:\n  name: ${row.name}\n  namespace: ${row.namespace}\nspec:\n  type: ${row.type}\n  selector:\n    app: ${row.name}\n  ports:\n  - port: 80\n    targetPort: 80\n`;
    return <YamlTab content={yamlContent} />;
  }

  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="Service"
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

export default function ServicesOverviewTable({ namespaces, namespace }) {
  const [services, setServices] = useState([]);
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

  const refreshServices = async () => {
    const nsArr = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : (namespace ? [namespace] : []);
    if (nsArr.length === 0) return;
    try {
      setLoading(true);
      const lists = await Promise.all(nsArr.map((ns) => AppAPI.GetServices(ns).catch(() => [])));
      const flat = lists.flat().map((svc) => ({
        name: svc.name ?? svc.Name,
        namespace: svc.namespace ?? svc.Namespace,
        type: svc.type ?? svc.Type ?? '-',
        clusterIP: svc.clusterIP ?? svc.ClusterIP ?? '-',
        ports: svc.ports ?? svc.Ports ?? '-',
        age: svc.age ?? svc.Age ?? '-',
        labels: svc.labels ?? svc.Labels ?? svc.metadata?.labels ?? {},
      }));
      setServices(flat);
    } catch (_) {
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshServices();
  }, [namespaces, namespace]);

  useEffect(() => {
    const onUpdate = (eventData) => {
      const res = (eventData?.resource || '').toString().toLowerCase();
      if (res !== 'service' && res !== 'services') return;
      const ns = (eventData?.namespace || '').toString();
      const selected = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : [namespace];
      if (ns && !selected.includes(ns)) return;
      refreshServices();
    };

    const unsubscribe = EventsOn('resource-updated', onUpdate);
    return () => { try { EventsOff('resource-updated', unsubscribe); } catch (_) {} };
  }, [namespaces, namespace]);

  useEffect(() => {
    const onUpdate = (list) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        const norm = arr.map((svc) => ({
          name: svc.name ?? svc.Name,
          namespace: svc.namespace ?? svc.Namespace,
          type: svc.type ?? svc.Type ?? '-',
          clusterIP: svc.clusterIP ?? svc.ClusterIP ?? '-',
          ports: svc.ports ?? svc.Ports ?? '-',
          age: svc.age ?? svc.Age ?? '-',
          labels: svc.labels ?? svc.Labels ?? svc.metadata?.labels ?? {},
        }));
        setServices(norm);
      } catch (_) {
        setServices([]);
      } finally {
        setLoading(false);
      }
    };

    EventsOn('services:update', onUpdate);
    return () => { try { EventsOff('services:update'); } catch (_) {} };
  }, []);

  const analyzeService = async (row) => {
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
      const response = await AnalyzeService(row.namespace, row.name);
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
          analyzeService(row);
          api?.openDetails?.('holmes');
        },
      },
      {
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        onClick: async () => {
          try {
            await AppAPI.DeleteResource('service', row.namespace, row.name);
            showSuccess(`Service '${row.name}' deleted`);
          } catch (err) {
            showError(`Failed to delete service '${row.name}': ${err?.message || err}`);
          }
        },
      },
    ];
  };

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={services}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeService)}
      panelHeader={(row) => <span style={{ fontWeight: 600 }}>{row.name}</span>}
      title="Services"
      loading={loading}
      resourceKind="service"
      namespace={namespace}
      getRowActions={getRowActions}
    />
  );
}
