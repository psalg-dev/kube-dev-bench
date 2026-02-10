import { useEffect, useRef, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import CronJobYamlTab from './CronJobYamlTab';
import CronJobHistoryTab from './CronJobHistoryTab';
import CronJobActionsTab from './CronJobActionsTab';
import CronJobNextRunsTab from './CronJobNextRunsTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../../components/ResourceActions';
import { showSuccess, showError } from '../../../notification';
import { StartJobFromCronJob, SuspendCronJob, ResumeCronJob } from '../kubeApi';
import { AnalyzeCronJobStream, CancelHolmesStream, onHolmesContextProgress, onHolmesChatStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel, { type HolmesContextStep, type HolmesToolEvent } from '../../../holmes/HolmesBottomPanel';
import type { HolmesResponse, HolmesContextProgressEvent } from '../../../holmes/holmesApi';
import type { app } from '../../../../wailsjs/go/models';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'suspend', label: 'Suspend' },
  { key: 'nextRun', label: 'Next run' },
  { key: 'age', label: 'Age' },
  { key: 'image', label: 'Image' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'history', label: 'History', ariaLabel: 'Job History', countKey: 'history' },
  { key: 'nextruns', label: 'Next Runs', countable: false },
  { key: 'actions', label: 'Actions', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

type CronJobRow = {
  name: string;
  namespace: string;
  schedule: string;
  suspend: boolean;
  nextRun: string;
  age: string;
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

type CronJobInfoRaw = app.CronJobInfo & {
  Name?: string;
  Namespace?: string;
  Schedule?: string;
  Suspend?: boolean;
  NextRun?: string;
  Age?: string;
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

const normalizeCronJob = (row: CronJobInfoRaw): CronJobRow => ({
  name: row.name ?? row.Name ?? '',
  namespace: row.namespace ?? row.Namespace ?? '',
  schedule: row.schedule ?? row.Schedule ?? '-',
  suspend: row.suspend ?? row.Suspend ?? false,
  nextRun: row.nextRun ?? row.NextRun ?? '-',
  age: row.age ?? row.Age ?? '-',
  image: row.image ?? row.Image ?? '',
  labels: normalizeLabels(row.labels ?? row.Labels ?? row.metadata?.labels),
});

const normalizeCronJobs = (arr: CronJobInfoRaw[] | null | undefined): CronJobRow[] =>
  (arr || []).filter(Boolean).map(normalizeCronJob);

function renderPanelContent(
  row: CronJobRow,
  tab: string,
  holmesState: HolmesState,
  onAnalyze: (row: CronJobRow) => void,
  onCancel: () => void
) {
  if (tab === 'summary') {
    const quickInfoFields: QuickInfoField[] = [
      {
        key: 'schedule',
        label: 'Schedule',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data: Record<string, unknown>) => {
            const rowData = data as CronJobRow;
            return rowData.created || rowData.age;
          },
        }
      },
      { key: 'namespace', label: 'Namespace' },
      {
        key: 'suspend',
        label: 'Suspend',
        getValue: (data: Record<string, unknown>) => {
          const rowData = data as CronJobRow;
          return rowData.suspend ? 'Yes' : 'No';
        },
      },
      { key: 'nextRun', label: 'Next run' },
      { key: 'image', label: 'Image', type: 'break-word' },
      { key: 'name', label: 'CronJob name', type: 'break-word' }
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels}
          actions={(
            <ResourceActions
              resourceType="cronjob"
              name={row.name}
              namespace={row.namespace}
              onDelete={async (n, ns) => {
                const targetNamespace = ns || row.namespace;
                if (!n || !targetNamespace) return;
                await AppAPI.DeleteResource('cronjob', targetNamespace, n);
              }}
            />
          )}
        />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: '#c9d1d9' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          {/* Event History at a glance */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
            <ResourceEventsTab namespace={row.namespace} kind="CronJob" name={row.name} limit={20} />
          </div>
        </div>
      </div>
    );
  }
  if (tab === 'history') {
    return <CronJobHistoryTab namespace={row.namespace} cronJobName={row.name} />;
  }
  if (tab === 'actions') {
    return <CronJobActionsTab namespace={row.namespace} cronJobName={row.name} suspend={row.suspend} />;
  }
  if (tab === 'nextruns') {
    return <CronJobNextRunsTab namespace={row.namespace} cronJobName={row.name} suspend={row.suspend} />;
  }
  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="CronJob"
        name={row.name}
      />
    );
  }
  if (tab === 'yaml') {
    return <CronJobYamlTab namespace={row.namespace} name={row.name} />;
  }
  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="CronJob"
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

function panelHeader(row: CronJobRow) {
  return <span style={{ fontWeight: 600 }}>{row.name}</span>;
}

type CronJobsOverviewTableProps = {
  namespaces?: string[];
};

export default function CronJobsOverviewTable({ namespaces = [] }: CronJobsOverviewTableProps) {
  const [cronJobs, setCronJobs] = useState<CronJobRow[]>([]);
  const [_loading, setLoading] = useState(false);
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
      try { unsubscribe?.(); } catch (_) {}
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
      try { unsubscribe?.(); } catch (_) {}
    };
  }, []);

  const fetchAllCronJobs = async () => {
    if (!Array.isArray(namespaces) || namespaces.length === 0) {
      setCronJobs([]);
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.all(
        namespaces.map((ns) => AppAPI.GetCronJobs(ns).catch(() => [] as app.CronJobInfo[]))
      );
      const flat = results.flat();
      setCronJobs(normalizeCronJobs(flat));
    } catch (e) {
      console.error('Error fetching cronjobs:', e);
      setCronJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllCronJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespaces]);

  useEffect(() => {
    const onUpdate = (list: CronJobInfoRaw[] | null | undefined) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        const filtered = namespaces ? arr.filter((d) => namespaces.includes(d?.namespace ?? d?.Namespace ?? '')) : arr;
        setCronJobs(normalizeCronJobs(filtered));
      } catch (_) {
        setCronJobs([]);
      } finally {
        setLoading(false);
      }
    };
    EventsOn('cronjobs:update', onUpdate);
    return () => { try { EventsOff('cronjobs:update'); } catch (_) {} };
  }, [namespaces]);

  // Generic resource-updated fallback (e.g. after CreateManifestOverlay)
  useEffect(() => {
    EventsOn('resource-updated', (eventData) => {
      if (eventData?.resource === 'cronjob' && Array.isArray(namespaces) && namespaces.includes(eventData?.namespace)) {
        fetchAllCronJobs();
      }
    });
    return () => {
      try { EventsOff('resource-updated'); } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespaces]);

  const analyzeCronJob = async (row: CronJobRow) => {
    const key = `${row.namespace}/${row.name}`;
    const streamId = `cronjob-${Date.now()}`;
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
      await AnalyzeCronJobStream(row.namespace, row.name, streamId);
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

  const getRowActions = (row: CronJobRow, api?: { openDetails?: (tabKey: string) => void }) => {
    const key = `${row.namespace}/${row.name}`;
    const isAnalyzing = holmesState.loading && holmesState.key === key;
    return [
      {
        label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
        icon: '🧠',
        disabled: isAnalyzing,
        onClick: () => {
          analyzeCronJob(row);
          api?.openDetails?.('holmes');
        },
      },
      {
        label: 'Start',
        icon: '▶',
        onClick: async () => {
          try {
            await StartJobFromCronJob(row.namespace, row.name);
            showSuccess(`Job started from CronJob '${row.name}'`);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            showError(`Failed to start job from CronJob '${row.name}': ${message}`);
          }
        },
      },
      {
        label: 'Suspend',
        icon: '⏸',
        onClick: async () => {
          try {
            await SuspendCronJob(row.namespace, row.name);
            showSuccess(`CronJob '${row.name}' suspended`);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            showError(`Failed to suspend CronJob '${row.name}': ${message}`);
          }
        },
      },
      {
        label: 'Resume',
        icon: '▶',
        onClick: async () => {
          try {
            await ResumeCronJob(row.namespace, row.name);
            showSuccess(`CronJob '${row.name}' resumed`);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            showError(`Failed to resume CronJob '${row.name}': ${message}`);
          }
        },
      },
      {
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        onClick: async () => {
          try {
            await AppAPI.DeleteResource('cronjob', row.namespace, row.name);
            showSuccess(`CronJob '${row.name}' deleted`);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            showError(`Failed to delete CronJob '${row.name}': ${message}`);
          }
        },
      },
    ];
  };

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={cronJobs}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeCronJob, cancelHolmesAnalysis)}
      panelHeader={panelHeader}
      title="Cron Jobs"
      resourceKind="cronjob"
      namespace={namespaces && namespaces.length === 1 ? namespaces[0] : ''}
      getRowActions={getRowActions}
    />
  );
}

