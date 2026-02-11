import { useEffect, useRef, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import PolicyRulesTable from '../rbac/PolicyRulesTable';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../../components/ResourceActions';
import { showSuccess, showError } from '../../../notification';
import { AnalyzeResourceStream, CancelHolmesStream, onHolmesContextProgress, onHolmesChatStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel, { type HolmesContextStep, type HolmesToolEvent } from '../../../holmes/HolmesBottomPanel';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import type { HolmesResponse, HolmesContextProgressEvent } from '../../../holmes/holmesApi';
import type { app } from '../../../../wailsjs/go/models';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'ruleCount', label: 'Rules' },
  { key: 'age', label: 'Age' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'rules', label: 'Rules', countKey: 'rules' },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

type RoleRow = {
  name: string;
  namespace: string;
  age: string;
  ruleCount: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  rules: app.PolicyRule[];
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

type RoleInfoRaw = app.RoleInfo & {
  Name?: string;
  Namespace?: string;
  Age?: string;
  Labels?: Record<string, string>;
  Annotations?: Record<string, string>;
  Rules?: app.PolicyRule[];
  metadata?: { labels?: Record<string, string>; annotations?: Record<string, string> };
};

const normalizeLabels = (labels?: Record<string, string> | null) => {
  if (!labels) return {};
  return Object.entries(labels).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = String(value ?? '');
    return acc;
  }, {});
};

const normalizeRole = (r: RoleInfoRaw): RoleRow => ({
  name: r.name ?? r.Name ?? '',
  namespace: r.namespace ?? r.Namespace ?? '',
  age: r.age ?? r.Age ?? '-',
  ruleCount: Array.isArray(r.rules ?? r.Rules) ? (r.rules ?? r.Rules)!.length : 0,
  labels: normalizeLabels(r.labels ?? r.Labels ?? r.metadata?.labels),
  annotations: normalizeLabels(r.annotations ?? r.Annotations ?? r.metadata?.annotations),
  rules: (Array.isArray(r.rules) ? r.rules : Array.isArray(r.Rules) ? (r.Rules as app.PolicyRule[]) : []) as app.PolicyRule[],
});

const normalizeRoles = (arr: RoleInfoRaw[] | null | undefined): RoleRow[] => (arr || []).filter(Boolean).map(normalizeRole);

const fetchRoleYaml = (namespace?: string, name?: string) => {
  if (!namespace || !name) return Promise.resolve('');
  const hasSpecific = typeof (AppAPI as any).GetRoleYAML === 'function';
  return hasSpecific
    ? (AppAPI as any).GetRoleYAML(namespace, name)
    : AppAPI.GetResourceYAML('Role', namespace, name);
};

function renderPanelContent(
  row: RoleRow,
  tab: string,
  holmesState: HolmesState,
  onAnalyze: (row: RoleRow) => void,
  onCancel: () => void,
  yamlLoader: (ns: string, name: string) => Promise<string>
) {
  if (tab === 'summary') {
    const quickInfoFields: QuickInfoField[] = [
      {
        key: 'ruleCount',
        label: 'Rules',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data: Record<string, unknown>) => {
            const rowData = data as RoleRow;
            return rowData.created || rowData.age;
          },
        },
      },
      { key: 'namespace', label: 'Namespace' },
      { key: 'name', label: 'Role name', type: 'break-word' },
      { key: 'labels', label: 'Labels', type: 'labels' },
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels}
          actions={(
            <ResourceActions
              resourceType="role"
              name={row.name}
              namespace={row.namespace}
              onDelete={async (n, ns) => {
                const targetNamespace = ns || row.namespace;
                if (!n || !targetNamespace) return;
                await AppAPI.DeleteResource('role', targetNamespace, n);
              }}
            />
          )}
        />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection resourceName={row.name} data={row} loading={false} error={null} fields={quickInfoFields} />
          <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
            <ResourceEventsTab namespace={row.namespace} kind="Role" name={row.name} limit={20} />
          </div>
        </div>
      </div>
    );
  }
  if (tab === 'rules') {
    return <PolicyRulesTable rules={row.rules} />;
  }
  if (tab === 'events') {
    return <ResourceEventsTab namespace={row.namespace} kind="Role" name={row.name} />;
  }
  if (tab === 'yaml') {
    // Inline YAML pane using generic GetResourceYAML; backend must support 'role' kind.
    // Fallback: shows error if unsupported.
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
        kind="Role"
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

type RolesOverviewTableProps = { namespaces?: string[]; namespace?: string };

export default function RolesOverviewTable({ namespaces, namespace }: RolesOverviewTableProps) {
  const [data, setData] = useState<RoleRow[]>([]);
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

  // Subscribe to Holmes chat stream events (pattern from other tables)
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
      let data: Record<string, unknown> | null;
      try { data = JSON.parse(payload.data); } catch { data = null; }
      if (eventType === 'ai_message' && data) {
        let handled = false;
        const reasoning = typeof (data as any).reasoning === 'string' ? (data as any).reasoning : '';
        if (reasoning) { setHolmesState((prev) => ({ ...prev, reasoningText: (prev.reasoningText ? prev.reasoningText + '\n' : '') + reasoning })); handled = true; }
        const content = typeof (data as any).content === 'string' ? (data as any).content : '';
        if (content) { setHolmesState((prev) => { const nextText = (prev.streamingText ? prev.streamingText + '\n' : '') + content; return { ...prev, streamingText: nextText, response: { response: nextText } }; }); handled = true; }
        if (handled) return;
      }
      if (eventType === 'start_tool_calling' && data && (data as any).id !== undefined) {
        const id = String((data as any).id);
        const name = typeof (data as any).tool_name === 'string' ? (data as any).tool_name : 'tool';
        const description = typeof (data as any).description === 'string' ? (data as any).description : '';
        setHolmesState((prev) => ({ ...prev, toolEvents: [...(prev.toolEvents || []), { id, name, status: 'running', description }] }));
        return;
      }
      if (eventType === 'tool_calling_result' && data && (data as any).tool_call_id) {
        const result = (data as any).result as Record<string, unknown> | undefined;
        const status = String(result?.status ?? (data as any).status ?? 'done');
        const description = typeof (data as any).description === 'string' ? (data as any).description : undefined;
        setHolmesState((prev) => ({ ...prev, toolEvents: (prev.toolEvents || []).map((item) => item.id === (data as any).tool_call_id ? { ...item, status, description: description ?? item.description } : item) }));
        return;
      }
      if (eventType === 'ai_answer_end' && data && (data as any).analysis) {
        const analysis = typeof (data as any).analysis === 'string' ? (data as any).analysis : '';
        setHolmesState((prev) => ({ ...prev, loading: false, response: { response: analysis }, streamingText: analysis }));
        return;
      }
      if (eventType === 'stream_end') {
        setHolmesState((prev) => { if (prev.streamingText) return { ...prev, loading: false, response: { response: prev.streamingText } }; return { ...prev, loading: false }; });
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

  const fetchRoles = async () => {
    const nsArr = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : (namespace ? [namespace] : []);
    if (nsArr.length === 0) return;
    setLoading(true);
    try {
      const lists = await Promise.all(nsArr.map((ns) => AppAPI.GetRoles(ns).catch(() => [] as app.RoleInfo[])));
      setData(normalizeRoles(lists.flat()));
    } catch (err) {
      console.error('Error fetching roles:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); }, [namespaces, namespace]);

  // Subscribe to generic resource-updated events (from CreateManifestOverlay)
  useEffect(() => {
    const onUpdate = (eventData: any) => {
      const nsArr = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : (namespace ? [namespace] : []);
      if (eventData?.resource === 'role' && nsArr.includes(eventData?.namespace)) {
        fetchRoles();
      }
    };
    EventsOn('resource-updated', onUpdate);
    return () => { try { EventsOff('resource-updated'); } catch (_) {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(namespaces), namespace]);

  const analyzeRole = async (row: RoleRow) => {
    const key = `${row.namespace}/${row.name}`;
    const streamId = `role-${Date.now()}`;
    setHolmesState({ loading: true, response: null, error: null, key, streamId, streamingText: '', reasoningText: '', queryTimestamp: new Date().toISOString(), contextSteps: [], toolEvents: [] });
    try { await AnalyzeResourceStream('Role', row.namespace, row.name, streamId); } catch (err: unknown) {
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

  const yamlLoader = (ns: string, name: string) => fetchRoleYaml(ns, name);

  const getRowActions = (row: RoleRow, api?: { openDetails?: (tabKey: string) => void }) => {
    const key = `${row.namespace}/${row.name}`;
    const isAnalyzing = holmesState.loading && holmesState.key === key;
    return [
      { label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes', icon: 'ðŸ§ ', disabled: isAnalyzing, onClick: () => { analyzeRole(row); api?.openDetails?.('holmes'); } },
      { label: 'Delete', icon: 'ðŸ—‘ï¸', danger: true, onClick: async () => { try { await AppAPI.DeleteResource('role', row.namespace, row.name); showSuccess(`Role '${row.name}' deleted`); } catch (err: unknown) { const message = err instanceof Error ? err.message : String(err); showError(`Failed to delete role '${row.name}': ${message}`); } } },
    ];
  };

  return (
    <OverviewTableWithPanel
      title="Roles"
      columns={columns}
      data={data}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeRole, cancelHolmesAnalysis, yamlLoader)}
      resourceKind="Role"
      namespace={namespace}
      getRowActions={getRowActions}
    />
  );
}


