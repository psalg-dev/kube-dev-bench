import { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import ServiceYamlTab from './ServiceYamlTab';
import ServiceEndpointsTab from './ServiceEndpointsTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import ResourceActions from '../../../components/ResourceActions.jsx';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import { showSuccess, showError } from '../../../notification';
import { AnalyzeServiceStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';
import useHolmesStream from '../../../holmes/useHolmesStream';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'type', label: 'Type' },
  { key: 'clusterIP', label: 'Cluster IP' },
  { key: 'ports', label: 'Ports' },
  { key: 'age', label: 'Age' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'endpoints', label: 'Endpoints', countKey: 'endpoints' },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

function renderPanelContent(row, tab, holmesState, onAnalyze, onCancel) {
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
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <SummaryTabHeader
          name={row.name}
          labels={row.labels || row.Labels || row.metadata?.labels}
          actions={
            <ResourceActions
              resourceType="service"
              name={row.name}
              namespace={row.namespace}
              onDelete={async (n, ns) => {
                await AppAPI.DeleteResource('service', ns, n);
              }}
            />
          }
        />
        <div
          style={{
            display: 'flex',
            flex: 1,
            minHeight: 0,
            color: 'var(--gh-text, #c9d1d9)',
          }}
        >
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          <div
            style={{
              width: 420,
              minWidth: 300,
              minHeight: 0,
              borderLeft: '1px solid var(--gh-border, #30363d)',
              position: 'relative',
            }}
          >
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

  if (tab === 'endpoints') {
    return (
      <ServiceEndpointsTab namespace={row.namespace} serviceName={row.name} />
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
    return <ServiceYamlTab namespace={row.namespace} name={row.name} />;
  }

  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="Service"
        namespace={row.namespace}
        name={row.name}
        onAnalyze={() => onAnalyze(row)}
        onCancel={
          holmesState.key === key && holmesState.streamId ? onCancel : null
        }
        response={holmesState.key === key ? holmesState.response : null}
        loading={holmesState.key === key && holmesState.loading}
        error={holmesState.key === key ? holmesState.error : null}
        queryTimestamp={
          holmesState.key === key ? holmesState.queryTimestamp : null
        }
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
  const { holmesState, startAnalysis, cancelAnalysis } = useHolmesStream();

  const refreshServices = async () => {
    const nsArr =
      Array.isArray(namespaces) && namespaces.length > 0
        ? namespaces
        : namespace
          ? [namespace]
          : [];
    if (nsArr.length === 0) return;
    try {
      setLoading(true);
      const lists = await Promise.all(
        nsArr.map((ns) => AppAPI.GetServices(ns).catch(() => [])),
      );
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

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    refreshServices();
  }, [namespaces, namespace]);
  /* eslint-enable react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const onUpdate = (eventData) => {
      const res = (eventData?.resource || '').toString().toLowerCase();
      if (res !== 'service' && res !== 'services') return;
      const ns = (eventData?.namespace || '').toString();
      const selected =
        Array.isArray(namespaces) && namespaces.length > 0
          ? namespaces
          : [namespace];
      if (ns && !selected.includes(ns)) return;
      refreshServices();
    };

    const unsubscribe = EventsOn('resource-updated', onUpdate);
    return () => {
      try {
        EventsOff('resource-updated', unsubscribe);
      } catch (_) {}
    };
  }, [namespaces, namespace]);
  /* eslint-enable react-hooks/exhaustive-deps */

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
    return () => {
      try {
        EventsOff('services:update');
      } catch (_) {}
    };
  }, []);

  const analyzeService = async (row) => {
    const key = `${row.namespace}/${row.name}`;
    await startAnalysis({
      key,
      streamPrefix: 'service',
      run: (streamId) =>
        AnalyzeServiceStream(row.namespace, row.name, streamId),
      onError: (message) =>
        showError(`Holmes analysis failed: ${message}`),
    });
  };

  const cancelHolmesAnalysis = async () => {
    await cancelAnalysis();
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
            showError(
              `Failed to delete service '${row.name}': ${err?.message || err}`,
            );
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
      renderPanelContent={(row, tab) =>
        renderPanelContent(
          row,
          tab,
          holmesState,
          analyzeService,
          cancelHolmesAnalysis,
        )
      }
      panelHeader={(row) => <span style={{ fontWeight: 600 }}>{row.name}</span>}
      title="Services"
      loading={loading}
      resourceKind="service"
      namespace={namespace}
      getRowActions={getRowActions}
    />
  );
}
