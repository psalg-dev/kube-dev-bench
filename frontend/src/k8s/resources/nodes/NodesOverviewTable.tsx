import { useEffect, useMemo, useRef, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import type { app } from '../../../../wailsjs/go/models';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import { AnalyzeNodeStream, CancelHolmesStream, onHolmesChatStream, onHolmesContextProgress, type HolmesContextProgressEvent, type HolmesResponse } from '../../../holmes/holmesApi';
import HolmesBottomPanel, { type HolmesContextStep, type HolmesToolEvent } from '../../../holmes/HolmesBottomPanel';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import { ResourceGraphTab } from '../../graph/ResourceGraphTab';
import NodeConditionsTab from './NodeConditionsTab';
import NodePodsTab from './NodePodsTab';
import NodeResourcesTab from './NodeResourcesTab';
import NodeYamlTab from './NodeYamlTab';

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

type NodeRow = app.NodeInfo;

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'roles', label: 'Roles', render: (value: unknown) => Array.isArray(value) ? value.join(', ') : '-' },
  { key: 'version', label: 'Kubelet' },
  { key: 'internalIP', label: 'Internal IP' },
  { key: 'allocatableCPU', label: 'CPU' },
  { key: 'allocatableMemory', label: 'Memory' },
  { key: 'age', label: 'Age' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'conditions', label: 'Conditions', countable: false },
  { key: 'pods', label: 'Pods on Node', countable: false },
  { key: 'resources', label: 'Resources', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'relationships', label: 'Relationships', countable: false, testId: 'relationships-tab' },
  { key: 'holmes', label: 'Holmes', countable: false },
];

function panelHeader(row: NodeRow) {
  return <span style={{ fontWeight: 600 }}>{row.name}</span>;
}

function renderPanelContent(row: NodeRow, tab: string, holmesState: HolmesState, onAnalyze: (_row: NodeRow) => void, onCancel: () => void) {
  if (tab === 'summary') {
    const quickInfoFields: QuickInfoField[] = [
      {
        key: 'status',
        label: 'Status',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data: Record<string, unknown>) => (data as unknown as NodeRow).age,
        },
      },
      { key: 'roles', label: 'Roles', getValue: (data: Record<string, unknown>) => {
        const roles = (data as unknown as NodeRow).roles;
        return Array.isArray(roles) ? roles.join(', ') : '-';
      } },
      { key: 'version', label: 'Kubelet Version' },
      { key: 'internalIP', label: 'Internal IP' },
      { key: 'externalIP', label: 'External IP' },
      { key: 'name', label: 'Node name', type: 'break-word' },
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader name={row.name} labels={row.labels || {}} />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection resourceName={row.name} data={row as unknown as Record<string, unknown>} loading={false} error={null} fields={quickInfoFields} />
          <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
            <ResourceEventsTab namespace="" kind="Node" name={row.name} limit={20} />
          </div>
        </div>
      </div>
    );
  }
  if (tab === 'conditions') {
    return <NodeConditionsTab node={row} />;
  }
  if (tab === 'pods') {
    return <NodePodsTab nodeName={row.name} />;
  }
  if (tab === 'resources') {
    return <NodeResourcesTab node={row} />;
  }
  if (tab === 'events') {
    return <ResourceEventsTab namespace="" kind="Node" name={row.name} />;
  }
  if (tab === 'yaml') {
    return <NodeYamlTab name={row.name} />;
  }
  if (tab === 'relationships') {
    return <ResourceGraphTab namespace="" kind="Node" name={row.name} />;
  }
  if (tab === 'holmes') {
    const key = `/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="Node"
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

export default function NodesOverviewTable() {
  const [rows, setRows] = useState<NodeRow[]>([]);
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

  const refresh = useMemo(() => async () => {
    setLoading(true);
    try {
      const list = await AppAPI.GetNodes();
      setRows(Array.isArray(list) ? list : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  const runHolmes = async (row: NodeRow) => {
    const streamId = `holmes-node-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const key = `/${row.name}`;
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
      await AnalyzeNodeStream(row.name, streamId);
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
      title="Nodes"
      tableTestId="nodes-overview-table"
      resourceKind="Node"
      columns={columns}
      data={rows}
      tabs={bottomTabs}
      loading={loading}
      panelHeader={panelHeader}
      renderPanelContent={(row: NodeRow, tab: string) => renderPanelContent(row, tab, holmesState, runHolmes, cancelHolmes)}
      createButtonTitle="Create Node"
      createNotice="Nodes are managed by your cluster infrastructure and are not created from this view."
    />
  );
}
