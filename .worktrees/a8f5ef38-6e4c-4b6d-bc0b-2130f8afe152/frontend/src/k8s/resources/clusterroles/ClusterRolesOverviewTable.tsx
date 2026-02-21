/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/rules-of-hooks */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import type { app } from '../../../../wailsjs/go/models';
import ResourceActions from '../../../components/ResourceActions';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import type { HolmesContextProgressEvent, HolmesResponse } from '../../../holmes/holmesApi';
import { AnalyzeResourceStream, CancelHolmesStream, onHolmesChatStream, onHolmesContextProgress } from '../../../holmes/holmesApi';
import HolmesBottomPanel, { type HolmesContextStep, type HolmesToolEvent } from '../../../holmes/HolmesBottomPanel';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { useResourceWatch } from '../../../hooks/useResourceWatch';
import { showError, showSuccess } from '../../../notification';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import { ResourceGraphTab } from '../../graph/ResourceGraphTab';
import PolicyRulesTable from '../rbac/PolicyRulesTable';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'ruleCount', label: 'Rules' },
  { key: 'age', label: 'Age' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'rules', label: 'Rules', countKey: 'rules' },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'relationships', label: 'Relationships', countable: false, testId: 'relationships-tab' },
  { key: 'holmes', label: 'Holmes', countable: false },
];

type ClusterRoleRow = {
  name: string;
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

const normalizeClusterRole = (r: RoleInfoRaw): ClusterRoleRow => ({
  name: r.name ?? r.Name ?? '',
  age: r.age ?? r.Age ?? '-',
  ruleCount: Array.isArray(r.rules ?? r.Rules) ? (r.rules ?? r.Rules)!.length : 0,
  labels: normalizeLabels(r.labels ?? r.Labels ?? r.metadata?.labels),
  annotations: normalizeLabels(r.annotations ?? r.Annotations ?? r.metadata?.annotations),
  rules: (Array.isArray(r.rules) ? r.rules : Array.isArray(r.Rules) ? (r.Rules as app.PolicyRule[]) : []) as app.PolicyRule[],
});
const normalizeClusterRoles = (arr: RoleInfoRaw[] | null | undefined): ClusterRoleRow[] => (arr || []).filter(Boolean).map(normalizeClusterRole);

const fetchClusterRoleYaml = (name?: string) => {
  if (!name) return Promise.resolve('');
  const hasSpecific = typeof (AppAPI as any).GetClusterRoleYAML === 'function';
  return hasSpecific
    ? (AppAPI as any).GetClusterRoleYAML(name)
    : AppAPI.GetResourceYAML('ClusterRole', '', name);
};

function renderPanelContent(
  row: ClusterRoleRow,
  tab: string,
  holmesState: HolmesState,
  onAnalyze: (_row: ClusterRoleRow) => void,
  onCancel: () => void,
  yamlLoader: (_name: string) => Promise<string>
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
            const rowData = data as ClusterRoleRow;
            return rowData.created || rowData.age;
          },
        },
      },
      { key: 'name', label: 'Cluster role name', type: 'break-word' },
      { key: 'labels', label: 'Labels', type: 'labels' },
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels}
          actions={(
            <ResourceActions
              resourceType="clusterrole"
              name={row.name}
              onDelete={async (n) => {
                if (!n) return;
                await AppAPI.DeleteResource('clusterrole', '', n);
              }}
            />
          )}
        />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection resourceName={row.name} data={row} loading={false} error={null} fields={quickInfoFields} />
          <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
            <ResourceEventsTab namespace="" kind="ClusterRole" name={row.name} limit={20} />
          </div>
        </div>
      </div>
    );
  }
  if (tab === 'rules') {
    return <PolicyRulesTable rules={row.rules} />;
  }
  if (tab === 'events') {
    return <ResourceEventsTab namespace="" kind="ClusterRole" name={row.name} />;
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
    return <ResourceGraphTab namespace="" kind="ClusterRole" name={row.name} />;
  }
  if (tab === 'holmes') {
    const key = row.name;
    return (
      <HolmesBottomPanel
        kind="ClusterRole"
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

type ClusterRolesOverviewTableProps = { namespace?: string };

export default function ClusterRolesOverviewTable({ namespace }: ClusterRolesOverviewTableProps) {
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

  const fetchClusterRoles = useCallback(async (): Promise<ClusterRoleRow[]> => {
    try {
      const list = await AppAPI.GetClusterRoles().catch(() => [] as app.RoleInfo[]);
      return normalizeClusterRoles(list);
    } catch (err) {
      console.error('Error fetching cluster roles:', err);
      return [];
    }
  }, []);

  const { data, loading } = useResourceWatch<ClusterRoleRow>('clusterroles:update', fetchClusterRoles, { mergeStrategy: 'replace' });

  const analyzeClusterRole = async (row: ClusterRoleRow) => {
    const key = row.name;
    const streamId = `clusterrole-${Date.now()}`;
    setHolmesState({ loading: true, response: null, error: null, key, streamId, streamingText: '', reasoningText: '', queryTimestamp: new Date().toISOString(), contextSteps: [], toolEvents: [] });
    try {
      await AnalyzeResourceStream('ClusterRole', '', row.name, streamId);
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

  const yamlLoader = (name: string) => fetchClusterRoleYaml(name);

  const getRowActions = (row: ClusterRoleRow, api?: { openDetails?: (_tabKey: string) => void }) => {
    const key = row.name;
    const isAnalyzing = holmesState.loading && holmesState.key === key;
    return [
      { label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes', disabled: isAnalyzing, onClick: () => { analyzeClusterRole(row); api?.openDetails?.('holmes'); } },
      { label: 'Delete', danger: true, onClick: async () => {
        try {
          await AppAPI.DeleteResource('clusterrole', '', row.name);
          showSuccess(`ClusterRole '${row.name}' deleted`);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          showError(`Failed to delete cluster role '${row.name}': ${message}`);
        }
      } },
    ];
  };
  return (
    <OverviewTableWithPanel
      title="Cluster Roles"
      columns={columns}
      data={data}
      tabs={bottomTabs}
      loading={loading}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeClusterRole, cancelHolmesAnalysis, yamlLoader)}
      resourceKind="ClusterRole"
      namespace={namespace}
      getRowActions={getRowActions}
      createKind="clusterrole"
    />
  );
}

