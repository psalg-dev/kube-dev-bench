import { useEffect, useRef, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import SubjectsTable from '../rbac/SubjectsTable';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../../components/ResourceActions';
import { showError, showSuccess } from '../../../notification';
import { AnalyzeResourceStream, CancelHolmesStream, onHolmesChatStream, onHolmesContextProgress } from '../../../holmes/holmesApi';
import HolmesBottomPanel, { type HolmesContextStep, type HolmesToolEvent } from '../../../holmes/HolmesBottomPanel';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOff, EventsOn } from '../../../../wailsjs/runtime';
import type { HolmesResponse, HolmesContextProgressEvent } from '../../../holmes/holmesApi';
import type { app } from '../../../../wailsjs/go/models';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'roleRefLabel', label: 'Role Ref' },
  { key: 'subjectsCount', label: 'Subjects' },
  { key: 'age', label: 'Age' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'subjects', label: 'Subjects', countKey: 'subjects' },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

type RoleBindingRow = {
  name: string;
  namespace: string;
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
  Namespace?: string;
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
  const kind = roleRef?.kind ?? roleRef?.Kind ?? 'Role';
  const name = roleRef?.name ?? roleRef?.Name ?? '-';
  return { kind, name, label: `${kind}: ${name}` };
};

const normalizeSubjects = (subjects?: app.Subject[] | null) => (Array.isArray(subjects) ? subjects : []);

const normalizeRoleBinding = (rb: RoleBindingInfoRaw): RoleBindingRow => {
  const roleRef = normalizeRoleRef(rb.roleRef ?? rb.RoleRef);
  const subjects = normalizeSubjects(rb.subjects ?? rb.Subjects);
  return {
    name: rb.name ?? rb.Name ?? '',
    namespace: rb.namespace ?? rb.Namespace ?? '',
    age: rb.age ?? rb.Age ?? '-',
    roleRef: { kind: roleRef.kind, name: roleRef.name },
    roleRefLabel: roleRef.label,
    subjects,
    subjectsCount: subjects.length,
    labels: normalizeLabels(rb.labels ?? rb.Labels ?? rb.metadata?.labels),
    annotations: normalizeLabels(rb.annotations ?? rb.Annotations ?? rb.metadata?.annotations),
  };
};

const normalizeRoleBindings = (arr: RoleBindingInfoRaw[] | null | undefined): RoleBindingRow[] => (arr || []).filter(Boolean).map(normalizeRoleBinding);

const fetchRoleBindingYaml = (namespace?: string, name?: string) => {
  if (!namespace || !name) return Promise.resolve('');
  const hasSpecific = typeof (AppAPI as any).GetRoleBindingYAML === 'function';
  return hasSpecific
    ? (AppAPI as any).GetRoleBindingYAML(namespace, name)
    : AppAPI.GetResourceYAML('RoleBinding', namespace, name);
};

function renderPanelContent(
  row: RoleBindingRow,
  tab: string,
  holmesState: HolmesState,
  onAnalyze: (row: RoleBindingRow) => void,
  onCancel: () => void,
  yamlLoader: (ns: string, name: string) => Promise<string>
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
            const rowData = data as RoleBindingRow;
            return rowData.created || rowData.age;
          },
        },
      },
      { key: 'subjectsCount', label: 'Subjects' },
      { key: 'namespace', label: 'Namespace' },
      { key: 'name', label: 'Role binding name', type: 'break-word' },
      { key: 'labels', label: 'Labels', type: 'labels' },
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels}
          actions={(
            <ResourceActions
              resourceType="rolebinding"
              name={row.name}
              namespace={row.namespace}
              onDelete={async (n, ns) => {
                const targetNamespace = ns || row.namespace;
                if (!n || !targetNamespace) return;
                await AppAPI.DeleteResource('rolebinding', targetNamespace, n);
              }}
            />
          )}
        />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection resourceName={row.name} data={row} loading={false} error={null} fields={quickInfoFields} />
          <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
            <ResourceEventsTab namespace={row.namespace} kind="RoleBinding" name={row.name} limit={20} />
          </div>
        </div>
      </div>
    );
  }
  if (tab === 'subjects') {
    return <SubjectsTable subjects={row.subjects} />;
  }
  if (tab === 'events') {
    return <ResourceEventsTab namespace={row.namespace} kind="RoleBinding" name={row.name} />;
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
          const text = await yamlLoader(row.namespace, row.name);
          if (mounted) setYaml(text || '');
        } catch (e: any) {
          if (mounted) setError(String(e));
        } finally {
          if (mounted) setLoading(false);
        }
      };
      load();
      return () => { mounted = false; };
    }, [row.namespace, row.name]);
    return <YamlTab content={yaml} loading={loading} error={error} />;
  }
  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="RoleBinding"
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

type RoleBindingsOverviewTableProps = { namespaces?: string[]; namespace?: string };

export default function RoleBindingsOverviewTable({ namespaces, namespace }: RoleBindingsOverviewTableProps) {
  const [data, setData] = useState<RoleBindingRow[]>([]);
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
    return () => { try { unsubscribe?.(); } catch (_) {} };
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
    return () => { try { unsubscribe?.(); } catch (_) {} };
  }, []);

  const fetchRoleBindings = async () => {
    const nsArr = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : (namespace ? [namespace] : []);
    if (nsArr.length === 0) return;
    setLoading(true);
    try {
      const lists = await Promise.all(nsArr.map((ns) => AppAPI.GetRoleBindings(ns).catch(() => [] as app.RoleBindingInfo[])));
      setData(normalizeRoleBindings(lists.flat()));
    } catch (err) {
      console.error('Error fetching role bindings:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoleBindings(); }, [namespaces, namespace]);

  useEffect(() => {
    const onUpdate = (list: RoleBindingInfoRaw[] | null | undefined) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        setData(normalizeRoleBindings(arr));
      } catch (_e) {
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    EventsOn('rolebindings:update', onUpdate);
    return () => { try { EventsOff('rolebindings:update'); } catch (_) {} };
  }, []);

  useEffect(() => {
    const onUpdate = (eventData: any) => {
      const nsArr = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : (namespace ? [namespace] : []);
      if (eventData?.resource === 'rolebinding' && nsArr.includes(eventData?.namespace)) {
        fetchRoleBindings();
      }
    };
    EventsOn('resource-updated', onUpdate);
    return () => { try { EventsOff('resource-updated'); } catch (_) {} };
  }, [JSON.stringify(namespaces), namespace]);

  const analyzeRoleBinding = async (row: RoleBindingRow) => {
    const key = `${row.namespace}/${row.name}`;
    const streamId = `rolebinding-${Date.now()}`;
    setHolmesState({ loading: true, response: null, error: null, key, streamId, streamingText: '', reasoningText: '', queryTimestamp: new Date().toISOString(), contextSteps: [], toolEvents: [] });
    try {
      await AnalyzeResourceStream('RoleBinding', row.namespace, row.name, streamId);
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

  const yamlLoader = (ns: string, name: string) => fetchRoleBindingYaml(ns, name);

  const getRowActions = (row: RoleBindingRow, api?: { openDetails?: (tabKey: string) => void }) => {
    const key = `${row.namespace}/${row.name}`;
    const isAnalyzing = holmesState.loading && holmesState.key === key;
    return [
      { label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes', disabled: isAnalyzing, onClick: () => { analyzeRoleBinding(row); api?.openDetails?.('holmes'); } },
      { label: 'Delete', danger: true, onClick: async () => {
        try {
          await AppAPI.DeleteResource('rolebinding', row.namespace, row.name);
          showSuccess(`RoleBinding '${row.name}' deleted`);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          showError(`Failed to delete role binding '${row.name}': ${message}`);
        }
      } },
    ];
  };

  return (
    <OverviewTableWithPanel
      title="Role Bindings"
      columns={columns}
      data={data}
      tabs={bottomTabs}
      loading={loading}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeRoleBinding, cancelHolmesAnalysis, yamlLoader)}
      resourceKind="RoleBinding"
      namespace={namespace}
      getRowActions={getRowActions}
      createKind="rolebinding"
    />
  );
}
