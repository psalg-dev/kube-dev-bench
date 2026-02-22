import { useEffect, useRef, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import type { app } from '../../../../wailsjs/go/models';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import { AnalyzeHPAStream, CancelHolmesStream, onHolmesChatStream, onHolmesContextProgress, type HolmesContextProgressEvent, type HolmesResponse } from '../../../holmes/holmesApi';
import HolmesBottomPanel, { type HolmesContextStep, type HolmesToolEvent } from '../../../holmes/HolmesBottomPanel';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import { showResourceOverlay } from '../../../resource-overlay';
import { ResourceGraphTab } from '../../graph/ResourceGraphTab';
import HPAConditionsTab from './HPAConditionsTab';
import HPAMetricsTab from './HPAMetricsTab';
import HPATargetTab from './HPATargetTab';
import HPAYamlTab from './HPAYamlTab';

type HolmesState = {
  loading: boolean;
  response: HolmesResponse | null;
  error: string | null;
  key: string | null;
  streamId: string | null;
  streamingText: string;
  reasoningText: string;
  queryTimestamp: string | null;
  contextSteps: HolmesContextStep[];
  toolEvents: HolmesToolEvent[];
};

type HPAOverviewTableProps = {
  namespaces?: string[];
  namespace?: string;
};

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'targetKind', label: 'Target Kind' },
  { key: 'targetName', label: 'Target Name' },
  { key: 'minReplicas', label: 'Min' },
  { key: 'maxReplicas', label: 'Max' },
  { key: 'currentReplicas', label: 'Current' },
  { key: 'desiredReplicas', label: 'Desired' },
  { key: 'targetCPU', label: 'CPU Target' },
  { key: 'currentCPU', label: 'CPU Current' },
  { key: 'age', label: 'Age' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'target', label: 'Target', countable: false },
  { key: 'metrics', label: 'Metrics', countable: false },
  { key: 'conditions', label: 'Conditions', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'relationships', label: 'Relationships', countable: false, testId: 'relationships-tab' },
  { key: 'holmes', label: 'Holmes', countable: false },
];

function panelHeader(row: app.HorizontalPodAutoscalerInfo) {
  return <span style={{ fontWeight: 600 }}>{row.name}</span>;
}

function renderPanelContent(row: app.HorizontalPodAutoscalerInfo, tab: string, holmesState: HolmesState, onAnalyze: (_row: app.HorizontalPodAutoscalerInfo) => void, onCancel: () => void) {
  if (tab === 'summary') {
    const quickInfoFields: QuickInfoField[] = [
      {
        key: 'targetKind',
        label: 'Target Kind',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data: Record<string, unknown>) => (data as unknown as app.HorizontalPodAutoscalerInfo).age,
        },
      },
      { key: 'namespace', label: 'Namespace' },
      { key: 'targetName', label: 'Target Name' },
      { key: 'minReplicas', label: 'Min Replicas' },
      { key: 'maxReplicas', label: 'Max Replicas' },
      { key: 'currentReplicas', label: 'Current Replicas' },
      { key: 'desiredReplicas', label: 'Desired Replicas' },
      { key: 'name', label: 'HPA name', type: 'break-word' },
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader name={row.name} labels={{}} />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection resourceName={row.name} data={row as unknown as Record<string, unknown>} loading={false} error={null} fields={quickInfoFields} />
          <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
            <ResourceEventsTab namespace={row.namespace} kind="HorizontalPodAutoscaler" name={row.name} limit={20} />
          </div>
        </div>
      </div>
    );
  }
  if (tab === 'target') {
    return <HPATargetTab hpa={row} />;
  }
  if (tab === 'metrics') {
    return <HPAMetricsTab hpa={row} />;
  }
  if (tab === 'conditions') {
    return <HPAConditionsTab hpa={row} />;
  }
  if (tab === 'events') {
    return <ResourceEventsTab namespace={row.namespace} kind="HorizontalPodAutoscaler" name={row.name} />;
  }
  if (tab === 'yaml') {
    return <HPAYamlTab namespace={row.namespace} name={row.name} />;
  }
  if (tab === 'relationships') {
    return <ResourceGraphTab namespace={row.namespace} kind="HorizontalPodAutoscaler" name={row.name} />;
  }
  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="HorizontalPodAutoscaler"
        namespace={row.namespace}
        name={row.name}
        onAnalyze={() => onAnalyze(row)}
        onCancel={holmesState.key === key && holmesState.streamId ? onCancel : undefined}
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

export default function HPAOverviewTable({ namespaces, namespace }: HPAOverviewTableProps) {
  const [rows, setRows] = useState<app.HorizontalPodAutoscalerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [holmesState, setHolmesState] = useState<HolmesState>({
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

  const holmesStateRef = useRef<HolmesState>(holmesState);
  useEffect(() => {
    holmesStateRef.current = holmesState;
  }, [holmesState]);

  const namespaceList = Array.isArray(namespaces) && namespaces.length > 0
    ? namespaces
    : (namespace ? [namespace] : []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!namespaceList.length) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        const all = await Promise.all(namespaceList.map((ns) => AppAPI.GetHorizontalPodAutoscalers(ns).catch(() => [] as app.HorizontalPodAutoscalerInfo[])));
        if (mounted) setRows(all.flat());
      } catch {
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [namespaceList.join('|')]);

  useEffect(() => {
    const unsubscribe = onHolmesChatStream((payload) => {
      if (!payload) return;
      const current = holmesStateRef.current;
      if (payload.stream_id && current.streamId && payload.stream_id !== current.streamId) return;
      if (payload.error) {
        if (payload.error === 'context canceled' || payload.error === 'context cancelled') {
          setHolmesState((prev) => ({ ...prev, loading: false }));
          return;
        }
        setHolmesState((prev) => ({ ...prev, loading: false, error: payload.error || null }));
        return;
      }
      if (!payload.data) return;

      let data: Record<string, unknown> | null = null;
      try { data = JSON.parse(payload.data); } catch { data = null; }

      if (payload.event === 'ai_message' && data) {
        const reasoning = typeof data.reasoning === 'string' ? data.reasoning : '';
        const content = typeof data.content === 'string' ? data.content : '';
        if (reasoning) {
          setHolmesState((prev) => ({ ...prev, reasoningText: (prev.reasoningText ? `${prev.reasoningText}\n` : '') + reasoning }));
        }
        if (content) {
          setHolmesState((prev) => {
            const next = (prev.streamingText ? `${prev.streamingText}\n` : '') + content;
            return { ...prev, streamingText: next, response: { response: next } };
          });
        }
        return;
      }

      if (payload.event === 'start_tool_calling' && data && data.id !== undefined) {
        setHolmesState((prev) => ({
          ...prev,
          toolEvents: [...prev.toolEvents, {
            id: String(data.id),
            name: typeof data.tool_name === 'string' ? data.tool_name : 'tool',
            status: 'running',
            description: typeof data.description === 'string' ? data.description : '',
          }],
        }));
        return;
      }

      if (payload.event === 'tool_calling_result' && data && data.tool_call_id) {
        const status = String((data.result as { status?: string } | undefined)?.status ?? data.status ?? 'done');
        setHolmesState((prev) => ({
          ...prev,
          toolEvents: prev.toolEvents.map((item) => item.id === String(data?.tool_call_id) ? { ...item, status } : item),
        }));
        return;
      }

      if (payload.event === 'ai_answer_end' && data && typeof data.analysis === 'string') {
        setHolmesState((prev) => ({ ...prev, loading: false, response: { response: data.analysis as string }, streamingText: data.analysis as string }));
        return;
      }

      if (payload.event === 'stream_end') {
        setHolmesState((prev) => ({ ...prev, loading: false, response: prev.streamingText ? { response: prev.streamingText } : prev.response }));
      }
    });

    return () => { try { unsubscribe?.(); } catch { /* noop */ } };
  }, []);

  useEffect(() => {
    const unsubscribe = onHolmesContextProgress((event: HolmesContextProgressEvent) => {
      if (!event?.key) return;
      setHolmesState((prev) => {
        if (prev.key !== event.key) return prev;
        const id = event.step || 'step';
        const steps = [...prev.contextSteps];
        const idx = steps.findIndex((item) => item.id === id);
        const entry = { id, step: event.step, status: event.status || 'running', detail: event.detail || '' };
        if (idx >= 0) steps[idx] = { ...steps[idx], ...entry };
        else steps.push(entry);
        return { ...prev, contextSteps: steps };
      });
    });
    return () => { try { unsubscribe?.(); } catch { /* noop */ } };
  }, []);

  const runHolmes = async (row: app.HorizontalPodAutoscalerInfo) => {
    const streamId = `holmes-hpa-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const key = `${row.namespace}/${row.name}`;
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
      await AnalyzeHPAStream(row.namespace, row.name, streamId);
    } catch (err) {
      setHolmesState((prev) => ({ ...prev, loading: false, error: String(err) }));
    }
  };

  const cancelHolmes = async () => {
    const streamId = holmesStateRef.current.streamId;
    if (!streamId) return;
    try {
      await CancelHolmesStream(streamId);
    } finally {
      setHolmesState((prev) => ({ ...prev, loading: false, streamId: null }));
    }
  };

  return (
    <OverviewTableWithPanel
      title="Horizontal Pod Autoscalers"
      tableTestId="hpa-overview-table"
      resourceKind="HorizontalPodAutoscaler"
      columns={columns}
      data={rows}
      tabs={bottomTabs}
      loading={loading}
      panelHeader={panelHeader}
      renderPanelContent={(row: app.HorizontalPodAutoscalerInfo, tab: string) => renderPanelContent(row, tab, holmesState, runHolmes, cancelHolmes)}
      onCreateResource={() => showResourceOverlay('horizontalpodautoscaler')}
      createButtonTitle="Create HPA"
    />
  );
}
