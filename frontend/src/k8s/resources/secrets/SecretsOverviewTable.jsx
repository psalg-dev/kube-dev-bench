import React, { useEffect, useRef, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import SecretYamlTab from './SecretYamlTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import SecretDataTab from './SecretDataTab';
import SecretConsumersTab from './SecretConsumersTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import ResourceActions from '../../../components/ResourceActions.jsx';
import { showSuccess, showError } from '../../../notification';
import { AnalyzeSecretStream, CancelHolmesStream, onHolmesContextProgress, onHolmesChatStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'type', label: 'Type' },
  { key: 'keys', label: 'Keys' },
  { key: 'size', label: 'Size' },
  { key: 'age', label: 'Age' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'data', label: 'Data' },
  { key: 'consumers', label: 'Consumers' },
  { key: 'events', label: 'Events' },
  { key: 'yaml', label: 'YAML' },
  { key: 'holmes', label: 'Holmes' },
];

function renderPanelContent(row, tab, holmesState, onAnalyze, onCancel) {
  if (tab === 'summary') {
    const quickInfoFields = [
      {
        key: 'type',
        label: 'Type',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data) => data.created || data.age
        }
      },
      { key: 'namespace', label: 'Namespace' },
      { key: 'keys', label: 'Keys' },
      { key: 'size', label: 'Size' },
      { key: 'name', label: 'Secret name', type: 'break-word' }
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader name={row.name} labels={row.labels || row.Labels || row.metadata?.labels} actions={<ResourceActions resourceType="secret" name={row.name} namespace={row.namespace} onDelete={async (n,ns)=>{await AppAPI.DeleteResource('secret', ns, n);}} />} />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          {/* Editable Data + Event History at a glance */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
              <SecretDataTab namespace={row.namespace} secretName={row.name} />
            </div>
            <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
              <ResourceEventsTab namespace={row.namespace} resourceKind="Secret" resourceName={row.name} limit={20} />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (tab === 'data') {
    return (
      <SecretDataTab
        namespace={row.namespace}
        secretName={row.name}
      />
    );
  }
  if (tab === 'consumers') {
    return (
      <SecretConsumersTab
        namespace={row.namespace}
        secretName={row.name}
      />
    );
  }
  if (tab === 'events') {
    return <ResourceEventsTab namespace={row.namespace} resourceKind="Secret" resourceName={row.name} />;
  }
  if (tab === 'yaml') {
    return <SecretYamlTab namespace={row.namespace} name={row.name} />;
  }
  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="Secret"
        namespace={row.namespace}
        name={row.name}
        onAnalyze={() => onAnalyze(row)}
        onCancel={holmesState.key === key && holmesState.streamId ? onCancel : null}
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

export default function SecretsOverviewTable({ namespaces, _onSecretCreate }) {
  const [data, setData] = useState([]);
  const [_loading, setLoading] = useState(false);
  const [_error, setError] = useState(null);
  const [holmesState, setHolmesState] = useState({
    loading: false,
    response: null,
    error: null,
    key: null,
    streamId: null,
    streamingText: '',
    reasoningText: '',
    queryTimestamp: null,
    contextSteps: [],
    toolEvents: [],
  });
  const holmesStateRef = useRef(holmesState);
  React.useEffect(() => {
    holmesStateRef.current = holmesState;
  }, [holmesState]);

  // Subscribe to Holmes chat stream events
  useEffect(() => {
    const unsubscribe = onHolmesChatStream((payload) => {
      if (!payload) return;
      const current = holmesStateRef.current;
      const { streamId } = current;
      if (payload.stream_id && streamId && payload.stream_id !== streamId) {
        return;
      }
      if (payload.error) {
        if (payload.error === 'context canceled' || payload.error === 'context cancelled') {
          setHolmesState((prev) => ({ ...prev, loading: false }));
          return;
        }
        setHolmesState((prev) => ({ ...prev, loading: false, error: payload.error }));
        return;
      }

      const eventType = payload.event;
      if (!payload.data) {
        return;
      }

      let streamData;
      try {
        streamData = JSON.parse(payload.data);
      } catch {
        streamData = null;
      }

      if (eventType === 'ai_message' && streamData) {
        let handled = false;
        if (streamData.reasoning) {
          setHolmesState((prev) => ({
            ...prev,
            reasoningText: (prev.reasoningText ? prev.reasoningText + '\n' : '') + streamData.reasoning,
          }));
          handled = true;
        }
        if (streamData.content) {
          setHolmesState((prev) => {
            const nextText = (prev.streamingText ? prev.streamingText + '\n' : '') + streamData.content;
            return { ...prev, streamingText: nextText, response: { response: nextText } };
          });
          handled = true;
        }
        if (handled) return;
      }

      if (eventType === 'start_tool_calling' && streamData && streamData.id) {
        setHolmesState((prev) => ({
          ...prev,
          toolEvents: [...(prev.toolEvents || []), {
            id: streamData.id,
            name: streamData.tool_name || 'tool',
            status: 'running',
            description: streamData.description,
          }],
        }));
        return;
      }

      if (eventType === 'tool_calling_result' && streamData && streamData.tool_call_id) {
        const status = streamData.result?.status || streamData.status || 'done';
        setHolmesState((prev) => ({
          ...prev,
          toolEvents: (prev.toolEvents || []).map((item) =>
            item.id === streamData.tool_call_id
              ? { ...item, status, description: streamData.description || item.description }
              : item
          ),
        }));
        return;
      }

      if (eventType === 'ai_answer_end' && streamData && streamData.analysis) {
        setHolmesState((prev) => ({
          ...prev,
          loading: false,
          response: { response: streamData.analysis },
          streamingText: streamData.analysis,
        }));
        return;
      }

      if (eventType === 'stream_end') {
        setHolmesState((prev) => {
          if (prev.streamingText) {
            return { ...prev, loading: false, response: { response: prev.streamingText } };
          }
          return { ...prev, loading: false };
        });
      }
    });
    return () => {
      try { unsubscribe?.(); } catch (_) {}
    };
  }, []);

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

  const normalize = (arr) => (arr || []).filter(Boolean).map((s) => ({
    name: s.name ?? s.Name,
    namespace: s.namespace ?? s.Namespace,
    type: s.type ?? s.Type ?? '-',
    keys: s.keys ?? s.Keys ?? '-',
    size: s.size ?? s.Size ?? '-',
    age: s.age ?? s.Age ?? '-',
    labels: s.labels ?? s.Labels ?? s.metadata?.labels ?? {}
  }));

  const fetchAllSecrets = async () => {
    if (!Array.isArray(namespaces) || namespaces.length === 0) {
      setData([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        namespaces.map(ns => AppAPI.GetSecrets(ns).catch(() => []))
      );
      setData(normalize([].concat(...results).filter(Boolean)));
    } catch (err) {
      console.error('Error fetching secrets:', err);
      setError(err.message || 'Failed to fetch secrets');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllSecrets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespaces]);

  useEffect(() => {
    const onUpdate = (list) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        setData(normalize(arr));
      } catch { /* ignore */ }
    };
    EventsOn('secrets:update', onUpdate);
    return () => { try { EventsOff('secrets:update'); } catch (_) {} };
  }, [namespaces]);

  const analyzeSecret = async (row) => {
    const key = `${row.namespace}/${row.name}`;
    const streamId = `secret-${Date.now()}`;
    setHolmesState({
      loading: true,
      response: null,
      error: null,
      key,
      streamId,
      streamingText: '',
      reasoningText: '',
      queryTimestamp: new Date().toISOString(),
      contextSteps: [],
      toolEvents: [],
    });
    try {
      await AnalyzeSecretStream(row.namespace, row.name, streamId);
    } catch (err) {
      const message = err?.message || String(err);
      setHolmesState((prev) => ({ ...prev, loading: false, response: null, error: message, key }));
      showError(`Holmes analysis failed: ${message}`);
    }
  };

  const cancelHolmesAnalysis = async () => {
    const currentStreamId = holmesState.streamId;
    if (!currentStreamId) return;
    setHolmesState((prev) => ({ ...prev, loading: false, streamId: null }));
    try {
      await CancelHolmesStream(currentStreamId);
    } catch (err) {
      console.error('Failed to cancel Holmes stream:', err);
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
          analyzeSecret(row);
          api?.openDetails?.('holmes');
        },
      },
      {
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        onClick: async () => {
          try {
            await AppAPI.DeleteResource('secret', row.namespace, row.name);
            showSuccess(`Secret '${row.name}' deleted`);
          } catch (err) {
            showError(`Failed to delete Secret '${row.name}': ${err?.message || err}`);
          }
        },
      },
    ];
  };

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={data}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeSecret, cancelHolmesAnalysis)}
      title="Secrets"
      resourceKind="secret"
      namespace={namespaces && namespaces.length === 1 ? namespaces[0] : ''}
      getRowActions={getRowActions}
    />
  );
}
