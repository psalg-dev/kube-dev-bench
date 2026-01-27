import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import CronJobYamlTab from './CronJobYamlTab';
import CronJobHistoryTab from './CronJobHistoryTab';
import CronJobActionsTab from './CronJobActionsTab';
import CronJobNextRunsTab from './CronJobNextRunsTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import ResourceActions from '../../../components/ResourceActions.jsx';
import { showSuccess, showError } from '../../../notification';
import { StartJobFromCronJob, SuspendCronJob, ResumeCronJob } from '../kubeApi';
import { AnalyzeCronJobStream, CancelHolmesStream, onHolmesContextProgress, onHolmesChatStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';

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
  { key: 'history', label: 'Job History', countKey: 'history' },
  { key: 'nextruns', label: 'Next Runs', countable: false },
  { key: 'actions', label: 'Actions', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

function renderPanelContent(row, tab, holmesState, onAnalyze, onCancel) {
  if (tab === 'summary') {
    const quickInfoFields = [
      {
        key: 'schedule',
        label: 'Schedule',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data) => data.created || data.age
        }
      },
      { key: 'namespace', label: 'Namespace' },
      {
        key: 'suspend',
        label: 'Suspend',
        getValue: (data) => data.suspend ? 'Yes' : 'No'
      },
      { key: 'nextRun', label: 'Next run' },
      { key: 'image', label: 'Image', type: 'break-word' },
      { key: 'name', label: 'CronJob name', type: 'break-word' }
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader name={row.name} labels={row.labels || row.Labels || row.metadata?.labels} actions={<ResourceActions resourceType="cronjob" name={row.name} namespace={row.namespace} onDelete={async (n,ns)=>{await AppAPI.DeleteResource('cronjob', ns, n);}} />} />
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

function panelHeader(row) {
  return <span style={{ fontWeight: 600 }}>{row.name}</span>;
}

export default function CronJobsOverviewTable({ namespaces }) {
  const [cronJobs, setCronJobs] = useState([]);
  const [_loading, setLoading] = useState(false);
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
  const holmesStateRef = React.useRef(holmesState);
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

      let data;
      try {
        data = JSON.parse(payload.data);
      } catch {
        data = null;
      }

      if (eventType === 'ai_message' && data) {
        let handled = false;
        if (data.reasoning) {
          setHolmesState((prev) => ({
            ...prev,
            reasoningText: (prev.reasoningText ? prev.reasoningText + '\n' : '') + data.reasoning,
          }));
          handled = true;
        }
        if (data.content) {
          setHolmesState((prev) => {
            const nextText = (prev.streamingText ? prev.streamingText + '\n' : '') + data.content;
            return { ...prev, streamingText: nextText, response: { response: nextText } };
          });
          handled = true;
        }
        if (handled) return;
      }

      if (eventType === 'start_tool_calling' && data && data.id) {
        setHolmesState((prev) => ({
          ...prev,
          toolEvents: [...(prev.toolEvents || []), {
            id: data.id,
            name: data.tool_name || 'tool',
            status: 'running',
            description: data.description,
          }],
        }));
        return;
      }

      if (eventType === 'tool_calling_result' && data && data.tool_call_id) {
        const status = data.result?.status || data.status || 'done';
        setHolmesState((prev) => ({
          ...prev,
          toolEvents: (prev.toolEvents || []).map((item) =>
            item.id === data.tool_call_id
              ? { ...item, status, description: data.description || item.description }
              : item
          ),
        }));
        return;
      }

      if (eventType === 'ai_answer_end' && data && data.analysis) {
        setHolmesState((prev) => ({
          ...prev,
          loading: false,
          response: { response: data.analysis },
          streamingText: data.analysis,
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

  const normalize = (arr) => (arr || []).filter(Boolean).map((d) => ({
    name: d.name ?? d.Name,
    namespace: d.namespace ?? d.Namespace,
    schedule: d.schedule ?? d.Schedule ?? '-',
    suspend: d.suspend ?? d.Suspend ?? false,
    nextRun: d.nextRun ?? d.NextRun ?? '-',
    age: d.age ?? d.Age ?? '-',
    image: d.image ?? d.Image ?? '',
    labels: d.labels ?? d.Labels ?? d.metadata?.labels ?? {}
  }));

  const fetchAllCronJobs = async () => {
    if (!Array.isArray(namespaces) || namespaces.length === 0) {
      setCronJobs([]);
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.all(
        namespaces.map(ns => AppAPI.GetCronJobs(ns).catch(() => []))
      );
      // Flatten and normalize, filter out any nulls
      setCronJobs(normalize([].concat(...results).filter(Boolean)));
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
    const onUpdate = (list) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        const filtered = namespaces ? arr.filter((d) => namespaces.includes(d?.namespace || d?.Namespace)) : arr;
        setCronJobs(normalize(filtered));
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
    const unsubscribe = EventsOn('resource-updated', (eventData) => {
      if (eventData?.resource === 'cronjob' && Array.isArray(namespaces) && namespaces.includes(eventData?.namespace)) {
        fetchAllCronJobs();
      }
    });
    return () => {
      try { EventsOff('resource-updated', unsubscribe); } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespaces]);

  const analyzeCronJob = async (row) => {
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
          } catch (err) {
            showError(`Failed to start job from CronJob '${row.name}': ${err?.message || err}`);
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
          } catch (err) {
            showError(`Failed to suspend CronJob '${row.name}': ${err?.message || err}`);
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
          } catch (err) {
            showError(`Failed to resume CronJob '${row.name}': ${err?.message || err}`);
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
          } catch (err) {
            showError(`Failed to delete CronJob '${row.name}': ${err?.message || err}`);
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
