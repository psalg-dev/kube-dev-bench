import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import type { jobs } from '../../../../wailsjs/go/models';
import AggregateLogsTab from '../../../components/AggregateLogsTab';
import ResourceActions from '../../../components/ResourceActions';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import { useResourceWatch } from '../../../hooks/useResourceWatch';
import type { HolmesContextProgressEvent, HolmesResponse } from '../../../holmes/holmesApi';
import { AnalyzeJobStream, CancelHolmesStream, onHolmesChatStream, onHolmesContextProgress } from '../../../holmes/holmesApi';
import HolmesBottomPanel, { type HolmesContextStep, type HolmesToolEvent } from '../../../holmes/HolmesBottomPanel';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { showError, showSuccess } from '../../../notification';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import { ResourceGraphTab } from '../../graph/ResourceGraphTab';
import { StartJob } from '../kubeApi';
import JobPodsTab from './JobPodsTab';
import JobYamlTab from './JobYamlTab';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'completions', label: 'Completions' },
  { key: 'succeeded', label: 'Succeeded' },
  { key: 'active', label: 'Active' },
  { key: 'failed', label: 'Failed' },
  { key: 'age', label: 'Age' },
  { key: 'duration', label: 'Duration' },
  { key: 'image', label: 'Image' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'pods', label: 'Pods', countKey: 'pods' },
  { key: 'logs', label: 'Logs', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'relationships', label: 'Relationships', countable: false, testId: 'relationships-tab' },
  { key: 'holmes', label: 'Holmes', countable: false },
];

function renderPanelContent(
  row: JobRow,
  tab: string,
  holmesState: HolmesState,
  onAnalyze: (_row: JobRow) => void,
  onCancel: () => void
) {
  if (tab === 'summary') {
    const quickInfoFields: QuickInfoField[] = [
      {
        key: 'completions',
        label: 'Completions',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data: Record<string, unknown>) => {
            const rowData = data as JobRow;
            return rowData.created || rowData.age;
          },
        }
      },
      { key: 'namespace', label: 'Namespace' },
      { key: 'succeeded', label: 'Succeeded' },
      { key: 'active', label: 'Active' },
      { key: 'failed', label: 'Failed' },
      { key: 'duration', label: 'Duration' },
      { key: 'image', label: 'Image', type: 'break-word' },
      { key: 'name', label: 'Job name', type: 'break-word' }
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels}
          actions={(
            <ResourceActions
              resourceType="job"
              name={row.name}
              namespace={row.namespace}
              onDelete={async (n, ns) => {
                const targetNamespace = ns || row.namespace;
                if (!n || !targetNamespace) return;
                await AppAPI.DeleteResource('job', targetNamespace, n);
              }}
            />
          )}
        />
        {/* Main flex content */}
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
                loadLogs={() => AppAPI.GetJobLogs(row.namespace, row.name)}
              />
            </div>
            <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
              <ResourceEventsTab
                namespace={row.namespace}
                kind="Job"
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
    return <JobPodsTab namespace={row.namespace} jobName={row.name} />;
  }
  if (tab === 'logs') {
    return (
      <AggregateLogsTab
        title="Job Logs"
        reloadKey={`${row.namespace}/${row.name}`}
        loadLogs={() => AppAPI.GetJobLogs(row.namespace, row.name)}
      />
    );
  }
  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="Job"
        name={row.name}
      />
    );
  }
  if (tab === 'yaml') {
    return <JobYamlTab namespace={row.namespace} name={row.name} />;
  }
  if (tab === 'relationships') {
    return <ResourceGraphTab namespace={row.namespace} kind="Job" name={row.name} />;
  }
  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="Job"
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
type JobRow = {
  name: string;
  namespace: string;
  completions: number;
  succeeded: number;
  active: number;
  failed: number;
  age: string;
  duration: string;
  image: string;
  labels: Record<string, string>;
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

type JobInfoRaw = jobs.JobInfo & {
  Name?: string;
  Namespace?: string;
  Completions?: number;
  Succeeded?: number;
  Active?: number;
  Failed?: number;
  Age?: string;
  Duration?: string;
  Image?: string;
  Labels?: Record<string, string>;
  metadata?: { labels?: Record<string, string> };
};

const normalizeLabels = (labels?: Record<string, string> | null) => {
  if (!labels) return {};
  return Object.entries(labels).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = String(value ?? '');
    return acc;
  }, {});
};

const normalizeJob = (job: JobInfoRaw): JobRow => ({
  name: job.name ?? job.Name ?? '',
  namespace: job.namespace ?? job.Namespace ?? '',
  completions: job.completions ?? job.Completions ?? 0,
  succeeded: job.succeeded ?? job.Succeeded ?? 0,
  active: job.active ?? job.Active ?? 0,
  failed: job.failed ?? job.Failed ?? 0,
  age: job.age ?? job.Age ?? '-',
  duration: job.duration ?? job.Duration ?? '-',
  image: job.image ?? job.Image ?? '',
  labels: normalizeLabels(job.labels ?? job.Labels ?? job.metadata?.labels),
});

type JobsOverviewTableProps = {
  namespaces?: string[];
  namespace?: string;
};

function panelHeader(row: JobRow) {
  return <span style={{ fontWeight: 600 }}>{row.name}</span>;
}

export default function JobsOverviewTable({ namespaces, namespace }: JobsOverviewTableProps) {
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

  const selectedNamespaces = useMemo(
    () => (Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : (namespace ? [namespace] : [])),
    [namespaces, namespace]
  );

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
        setHolmesState((prev) => ({
          ...prev,
          loading: false,
          error: payload.error ? String(payload.error) : null,
        }));
        return;
      }

      const eventType = payload.event;
      if (!payload.data) {
        return;
      }

      let data: Record<string, unknown> | null;
      try {
        data = JSON.parse(payload.data);
      } catch {
        data = null;
      }

      if (eventType === 'ai_message' && data) {
        let handled = false;
        const reasoning = typeof data.reasoning === 'string' ? data.reasoning : '';
        if (reasoning) {
          setHolmesState((prev) => ({
            ...prev,
            reasoningText: (prev.reasoningText ? prev.reasoningText + '\n' : '') + reasoning,
          }));
          handled = true;
        }
        const content = typeof data.content === 'string' ? data.content : '';
        if (content) {
          setHolmesState((prev) => {
            const nextText = (prev.streamingText ? prev.streamingText + '\n' : '') + content;
            return { ...prev, streamingText: nextText, response: { response: nextText } };
          });
          handled = true;
        }
        if (handled) return;
      }

      if (eventType === 'start_tool_calling' && data && data.id !== undefined) {
        const id = String(data.id);
        const name = typeof data.tool_name === 'string' ? data.tool_name : 'tool';
        const description = typeof data.description === 'string' ? data.description : '';
        setHolmesState((prev) => ({
          ...prev,
          toolEvents: [...(prev.toolEvents || []), {
            id,
            name,
            status: 'running',
            description,
          }],
        }));
        return;
      }

      if (eventType === 'tool_calling_result' && data && data.tool_call_id) {
        const result = data.result as Record<string, unknown> | undefined;
        const status = String(result?.status ?? data.status ?? 'done');
        const description = typeof data.description === 'string' ? data.description : undefined;
        setHolmesState((prev) => ({
          ...prev,
          toolEvents: (prev.toolEvents || []).map((item) =>
            item.id === data.tool_call_id
              ? { ...item, status, description: description ?? item.description }
              : item
          ),
        }));
        return;
      }

      if (eventType === 'ai_answer_end' && data && data.analysis) {
        const analysis = typeof data.analysis === 'string' ? data.analysis : '';
        setHolmesState((prev) => ({
          ...prev,
          loading: false,
          response: { response: analysis },
          streamingText: analysis,
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
      try { unsubscribe?.(); } catch {}
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onHolmesContextProgress((event: HolmesContextProgressEvent) => {
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
      try { unsubscribe?.(); } catch {}
    };
  }, []);

  const normalizeJobs = (arr: JobInfoRaw[] | null | undefined) => (arr || []).filter(Boolean).map(normalizeJob);

  const initialFetchJobs = useCallback(async (): Promise<JobRow[]> => {
    if (selectedNamespaces.length === 0) return [];
    const lists = await Promise.all(
      selectedNamespaces.map((ns) => AppAPI.GetJobs(ns).catch(() => [] as jobs.JobInfo[]))
    );
    return normalizeJobs(lists.flat() as JobInfoRaw[]);
  }, [selectedNamespaces]);

  const { data: jobs, loading } = useResourceWatch<JobRow>(
    'jobs:update',
    initialFetchJobs,
    { mergeStrategy: 'replace' }
  );

  const analyzeJob = async (row: JobRow) => {
    const key = `${row.namespace}/${row.name}`;
    const streamId = `job-${Date.now()}`;
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
      await AnalyzeJobStream(row.namespace, row.name, streamId);
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
    try {
      await CancelHolmesStream(currentStreamId);
    } catch (err) {
      console.error('Failed to cancel Holmes stream:', err);
    }
  };

  const getRowActions = (row: JobRow, api?: { openDetails?: (_tabKey: string) => void }) => {
    const key = `${row.namespace}/${row.name}`;
    const isAnalyzing = holmesState.loading && holmesState.key === key;
    return [
      {
        label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
        icon: '🧠',
        disabled: isAnalyzing,
        onClick: () => {
          analyzeJob(row);
          api?.openDetails?.('holmes');
        },
      },
      {
        label: 'Start',
        icon: '▶',
        onClick: async () => {
          try {
            await StartJob(row.namespace, row.name);
            showSuccess(`Job '${row.name}' started`);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            showError(`Failed to start job '${row.name}': ${message}`);
          }
        },
      },
      {
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        onClick: async () => {
          try {
            await AppAPI.DeleteResource('job', row.namespace, row.name);
            showSuccess(`Job '${row.name}' deleted`);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            showError(`Failed to delete job '${row.name}': ${message}`);
          }
        },
      },
    ];
  };

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={jobs}
      loading={loading}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeJob, cancelHolmesAnalysis)}
      panelHeader={panelHeader}
      title="Jobs"
      resourceKind="Job"
      namespace={namespace}
      getRowActions={getRowActions}
    />
  );
}
