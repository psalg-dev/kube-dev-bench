/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/rules-of-hooks */
import { useEffect, useRef, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import type { app } from '../../../../wailsjs/go/models';
import { EventsOff, EventsOn } from '../../../../wailsjs/runtime';
import ResourceActions from '../../../components/ResourceActions';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import type { HolmesContextProgressEvent, HolmesResponse } from '../../../holmes/holmesApi';
import { AnalyzeResourceStream, CancelHolmesStream, onHolmesChatStream, onHolmesContextProgress } from '../../../holmes/holmesApi';
import HolmesBottomPanel, { type HolmesContextStep, type HolmesToolEvent } from '../../../holmes/HolmesBottomPanel';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { showError, showSuccess } from '../../../notification';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import { ResourceGraphTab } from '../../graph/ResourceGraphTab';
import SubjectsTable from '../rbac/SubjectsTable';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'roleRefLabel', label: 'Role Ref' },
  { key: 'subjectsCount', label: 'Subjects' },
  { key: 'age', label: 'Age' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'subjects', label: 'Subjects', countKey: 'subjects' },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'relationships', label: 'Relationships', countable: false, testId: 'relationships-tab' },
  { key: 'holmes', label: 'Holmes', countable: false },
];

type ClusterRoleBindingRow = {
  name: string;
  age: string;
  roleRef: { kind: string; name: string };
  roleRefLabel: string;
  subjects: app.Subject[];
  subjectsCount: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  created?: string;
};

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

type RoleBindingInfoRaw = app.RoleBindingInfo & {
  Name?: string;
  Age?: string;
  Labels?: Record<string, string>;
  Annotations?: Record<string, string>;
  RoleRef?: { Kind?: string; Name?: string };
  Subjects?: app.Subject[];
  metadata?: { labels?: Record<string, string>; annotations?: Record<string, string> };
};

const normalizeLabels = (labels?: Record<string, string> | null) => {
  if (!labels) return {};
  return Object.entries(labels).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = String(value ?? '');
    return acc;
  }, {});
};

const normalizeRoleRef = (roleRef?: { kind?: string; Kind?: string; name?: string; Name?: string }) => {
  const kind = roleRef?.kind ?? roleRef?.Kind ?? 'ClusterRole';
  const name = roleRef?.name ?? roleRef?.Name ?? '-';
  return { kind, name, label: `${kind}: ${name}` };
};

const normalizeSubjects = (subjects?: app.Subject[] | null) => (Array.isArray(subjects) ? subjects : []);

const normalizeClusterRoleBinding = (rb: RoleBindingInfoRaw): ClusterRoleBindingRow => {
  const roleRef = normalizeRoleRef(rb.roleRef ?? rb.RoleRef);
  const subjects = normalizeSubjects(rb.subjects ?? rb.Subjects);
  return {
    name: rb.name ?? rb.Name ?? '',
    age: rb.age ?? rb.Age ?? '-',
    roleRef: { kind: roleRef.kind, name: roleRef.name },
    roleRefLabel: roleRef.label,
    subjects,
    subjectsCount: subjects.length,
    labels: normalizeLabels(rb.labels ?? rb.Labels ?? rb.metadata?.labels),
    annotations: normalizeLabels(rb.annotations ?? rb.Annotations ?? rb.metadata?.annotations),
  };
};
const normalizeClusterRoleBindings = (arr: RoleBindingInfoRaw[] | null | undefined): ClusterRoleBindingRow[] => (arr || []).filter(Boolean).map(normalizeClusterRoleBinding);

const fetchClusterRoleBindingYaml = (name?: string) => {
  if (!name) return Promise.resolve('');
  const hasSpecific = typeof (AppAPI as any).GetClusterRoleBindingYAML === 'function';
  return hasSpecific
    ? (AppAPI as any).GetClusterRoleBindingYAML(name)
    : AppAPI.GetResourceYAML('ClusterRoleBinding', '', name);
};

function renderPanelContent(
  row: ClusterRoleBindingRow,
  tab: string,
  holmesState: HolmesState,
  onAnalyze: (_row: ClusterRoleBindingRow) => void,
  onCancel: () => void,
  yamlLoader: (_name: string) => Promise<string>
) {
  if (tab === 'summary') {
    const quickInfoFields: QuickInfoField[] = [
      {
        key: 'roleRefLabel',
        label: 'Role Ref',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data: Record<string, unknown>) => {
            const rowData = data as ClusterRoleBindingRow;
            return rowData.created || rowData.age;
          },
        },
      },
      { key: 'subjectsCount', label: 'Subjects' },
      { key: 'name', label: 'Cluster role binding name', type: 'break-word' },
      { key: 'labels', label: 'Labels', type: 'labels' },
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels}
          actions={(
            <ResourceActions
              resourceType="clusterrolebinding"
              name={row.name}
              onDelete={async (n) => {
                if (!n) return;
                await AppAPI.DeleteResource('clusterrolebinding', '', n);
              }}
            />
          )}
        />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection resourceName={row.name} data={row} loading={false} error={null} fields={quickInfoFields} />
          <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
            <ResourceEventsTab namespace="" kind="ClusterRoleBinding" name={row.name} limit={20} />
          </div>
        </div>
      </div>
    );
  }
  if (tab === 'subjects') {
    return <SubjectsTable subjects={row.subjects} />;
  }
  if (tab === 'events') {
    return <ResourceEventsTab namespace="" kind="ClusterRoleBinding" name={row.name} />;
  }
  if (tab === 'yaml') {
    const [yaml, setYaml] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
      let mounted = true;
      const load = async () => {
        setLoading(true);
        setError(null);
        try {
          const text = await yamlLoader(row.name);
          if (mounted) setYaml(text || '');
        } catch (e: any) {
          if (mounted) setError(String(e));
        } finally {
          if (mounted) setLoading(false);
        }
      };
      load();
      return () => { mounted = false; };
    }, [row.name, yamlLoader]);
    return <YamlTab content={yaml} loading={loading} error={error} />;
  }
  if (tab === 'relationships') {
    return <ResourceGraphTab namespace="" kind="ClusterRoleBinding" name={row.name} />;
  }
  if (tab === 'holmes') {
    const key = row.name;
    return (
      <HolmesBottomPanel
        kind="ClusterRoleBinding"
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

type ClusterRoleBindingsOverviewTableProps = { namespace?: string };

export default function ClusterRoleBindingsOverviewTable({ namespace }: ClusterRoleBindingsOverviewTableProps) {
  const [data, setData] = useState<ClusterRoleBindingRow[]>([]);
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
  useEffect(() => { holmesStateRef.current = holmesState; }, [holmesState]);

  useEffect(() => {
    const unsubscribe = onHolmesChatStream((payload) => {
      if (!payload) return;
      const current = holmesStateRef.current;
      const { streamId } = current;
      if (payload.stream_id && streamId && payload.stream_id !== streamId) return;
      if (payload.error) {
        if (payload.error === 'context canceled' || payload.error === 'context cancelled') {
          setHolmesState((prev) => ({ ...prev, loading: false }));
          return;
        }
        setHolmesState((prev) => ({ ...prev, loading: false, error: payload.error ? String(payload.error) : null }));
        return;
      }
      const eventType = payload.event;
      if (!payload.data) return;
      let dataObj: Record<string, unknown> | null;
      try { dataObj = JSON.parse(payload.data); } catch { dataObj = null; }
      if (eventType === 'ai_message' && dataObj) {
        let handled = false;
        const reasoning = typeof (dataObj as any).reasoning === 'string' ? (dataObj as any).reasoning : '';
        if (reasoning) {
          setHolmesState((prev) => ({ ...prev, reasoningText: (prev.reasoningText ? prev.reasoningText + '\n' : '') + reasoning }));
          handled = true;
        }
        const content = typeof (dataObj as any).content === 'string' ? (dataObj as any).content : '';
        if (content) {
          setHolmesState((prev) => {
            const nextText = (prev.streamingText ? prev.streamingText + '\n' : '') + content;
            return { ...prev, streamingText: nextText, response: { response: nextText } };
          });
          handled = true;
        }
        if (handled) return;
      }
      if (eventType === 'start_tool_calling' && dataObj && (dataObj as any).id !== undefined) {
        const id = String((dataObj as any).id);
        const name = typeof (dataObj as any).tool_name === 'string' ? (dataObj as any).tool_name : 'tool';
        const description = typeof (dataObj as any).description === 'string' ? (dataObj as any).description : '';
        setHolmesState((prev) => ({ ...prev, toolEvents: [...(prev.toolEvents || []), { id, name, status: 'running', description }] }));
        return;
      }
      if (eventType === 'tool_calling_result' && dataObj && (dataObj as any).tool_call_id) {
        const result = (dataObj as any).result as Record<string, unknown> | undefined;
        const status = String(result?.status ?? (dataObj as any).status ?? 'done');
        const description = typeof (dataObj as any).description === 'string' ? (dataObj as any).description : undefined;
        setHolmesState((prev) => ({
          ...prev,
          toolEvents: (prev.toolEvents || []).map((item) =>
            item.id === (dataObj as any).tool_call_id
              ? { ...item, status, description: description ?? item.description }
              : item
          ),
        }));
        return;
      }
      if (eventType === 'ai_answer_end' && dataObj && (dataObj as any).analysis) {
        const analysis = typeof (dataObj as any).analysis === 'string' ? (dataObj as any).analysis : '';
        setHolmesState((prev) => ({ ...prev, loading: false, response: { response: analysis }, streamingText: analysis }));
        return;
      }
      if (eventType === 'stream_end') {
        setHolmesState((prev) => {
          if (prev.streamingText) return { ...prev, loading: false, response: { response: prev.streamingText } };
          return { ...prev, loading: false };
        });
      }
    });
    return () => { try { unsubscribe?.(); } catch {} };
  }, []);

  useEffect(() => {
    const unsubscribe = onHolmesContextProgress((event: HolmesContextProgressEvent) => {
      if (!event?.key) return;
      setHolmesState((prev) => {
        if (prev.key !== event.key) return prev;
        const id = event.step || 'step';
        const nextSteps = Array.isArray(prev.contextSteps) ? [...prev.contextSteps] : [];
        const idx = nextSteps.findIndex((item) => item.id === id);
        const entry = { id, step: event.step, status: event.status || 'running', detail: event.detail || '' };
        if (idx >= 0) nextSteps[idx] = { ...nextSteps[idx], ...entry }; else nextSteps.push(entry);
        return { ...prev, contextSteps: nextSteps };
      });
    });
    return () => { try { unsubscribe?.(); } catch {} };
  }, []);

  const fetchClusterRoleBindings = async () => {
    setLoading(true);
    try {
      const list = await AppAPI.GetClusterRoleBindings().catch(() => [] as app.RoleBindingInfo[]);
      setData(normalizeClusterRoleBindings(list));
    } catch (err) {
      console.error('Error fetching cluster role bindings:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClusterRoleBindings(); }, []);

  useEffect(() => {
    const onUpdate = (list: RoleBindingInfoRaw[] | null | undefined) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        setData(normalizeClusterRoleBindings(arr));
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    EventsOn('clusterrolebindings:update', onUpdate);
    return () => { try { EventsOff('clusterrolebindings:update'); } catch {} };
  }, []);

  useEffect(() => {
    const onUpdate = (eventData: any) => {
      if (eventData?.resource === 'clusterrolebinding') {
        fetchClusterRoleBindings();
      }
    };
    EventsOn('resource-updated', onUpdate);
    return () => { try { EventsOff('resource-updated'); } catch {} };
  }, []);

  const analyzeClusterRoleBinding = async (row: ClusterRoleBindingRow) => {
    const key = row.name;
    const streamId = `clusterrolebinding-${Date.now()}`;
    setHolmesState({ loading: true, response: null, error: null, key, streamId, streamingText: '', reasoningText: '', queryTimestamp: new Date().toISOString(), contextSteps: [], toolEvents: [] });
    try {
      await AnalyzeResourceStream('ClusterRoleBinding', '', row.name, streamId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setHolmesState((prev) => ({ ...prev, loading: false, response: null, error: message, key }));
      showError(`Holmes analysis failed: ${message}`);
    }
  };

  const cancelHolmesAnalysis = async () => {
    const currentStreamId = holmesState.streamId;
    if (!currentStreamId) return;
    setHolmesState((prev) => ({ ...prev, loading: false, streamId: null }));
    try { await CancelHolmesStream(currentStreamId); } catch (err) { console.error('Failed to cancel Holmes stream:', err); }
  };

  const yamlLoader = (name: string) => fetchClusterRoleBindingYaml(name);

  const getRowActions = (row: ClusterRoleBindingRow, api?: { openDetails?: (_tabKey: string) => void }) => {
    const key = row.name;
    const isAnalyzing = holmesState.loading && holmesState.key === key;
    return [
      { label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes', disabled: isAnalyzing, onClick: () => { analyzeClusterRoleBinding(row); api?.openDetails?.('holmes'); } },
      { label: 'Delete', danger: true, onClick: async () => {
        try {
          await AppAPI.DeleteResource('clusterrolebinding', '', row.name);
          showSuccess(`ClusterRoleBinding '${row.name}' deleted`);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          showError(`Failed to delete cluster role binding '${row.name}': ${message}`);
        }
      } },
    ];
  };
  return (
    <OverviewTableWithPanel
      title="Cluster Role Bindings"
      columns={columns}
      data={data}
      tabs={bottomTabs}
      loading={loading}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeClusterRoleBinding, cancelHolmesAnalysis, yamlLoader)}
      resourceKind="ClusterRoleBinding"
      namespace={namespace}
      getRowActions={getRowActions}
      createKind="clusterrolebinding"
    />
  );
}

