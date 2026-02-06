import { useEffect, useRef, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import AggregateLogsTab from '../../../components/AggregateLogsTab';
import ConsoleTab from '../../../layout/bottompanel/ConsoleTab';
import EmptyTabContent from '../../../components/EmptyTabContent';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';
import HolmesBottomPanel, { type HolmesContextStep, type HolmesToolEvent } from '../../../holmes/HolmesBottomPanel';
import { AnalyzeSwarmTaskStream, CancelHolmesStream, onHolmesChatStream, onHolmesContextProgress, type HolmesResponse, type HolmesContextProgressEvent } from '../../../holmes/holmesApi';
import {
  GetSwarmTasks,
  GetSwarmTaskLogs,
  GetSwarmTaskHealthLogs,
} from '../../swarmApi';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import HealthStatusBadge from './HealthStatusBadge';
import { showError } from '../../../notification';
import StatusBadge from '../../../components/StatusBadge';
import type { docker } from '../../../../wailsjs/go/models';

type SwarmTaskRow = docker.SwarmTaskInfo;
type HealthLogEntry = docker.SwarmHealthLogEntry;

type CellValueContext = {
  getValue: () => string;
};

const columns = [
  { key: 'id', label: 'Task ID', cell: ({ getValue }: CellValueContext) => {
    const val = getValue();
    return val ? `${val.substring(0, 12)}...` : '-';
  }},
  { key: 'serviceName', label: 'Service' },
  { key: 'nodeName', label: 'Node' },
  { key: 'slot', label: 'Slot' },
  { key: 'state', label: 'State', cell: ({ getValue }: CellValueContext) => {
    const state = getValue();
    return <StatusBadge status={state || '-'} size="small" />;
  }},
  { key: 'healthStatus', label: 'Health', cell: ({ getValue }: CellValueContext) => {
    const status = getValue();
    return <HealthStatusBadge status={status} />;
  }},
  { key: 'desiredState', label: 'Desired', cell: ({ getValue }: CellValueContext) => {
    const desired = getValue();
    return <StatusBadge status={desired || '-'} size="small" />;
  }},
  { key: 'containerId', label: 'Container', cell: ({ getValue }: CellValueContext) => {
    const val = getValue();
    return val ? `${val.substring(0, 12)}...` : '-';
  }},
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'logs', label: 'Logs' },
  { key: 'exec', label: 'Exec' },
  { key: 'holmes', label: 'Holmes' },
];

type HealthCheckSectionProps = {
  row?: SwarmTaskRow | null;
};

function HealthCheckSection({ row }: HealthCheckSectionProps) {
  const [logs, setLogs] = useState<HealthLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!row?.id) return;
      setLoading(true);
      try {
        const data = await GetSwarmTaskHealthLogs(row.id);
        if (!active) return;
        setLogs(Array.isArray(data) ? (data as HealthLogEntry[]) : []);
      } catch (_e) {
        if (!active) return;
        setLogs([]);
      } finally {
        // eslint-disable-next-line no-unsafe-finally
        if (!active) return;
        setLoading(false);
      }
    };

    // Only attempt to fetch when there is a container.
    if (row?.containerId) {
      load();
    } else {
      setLogs([]);
    }

    return () => {
      active = false;
    };
  }, [row?.id, row?.containerId]);

  const hc = row?.healthCheck;
  const hasHc = !!hc && Array.isArray(hc.test) && hc.test.length > 0;

  return (
    <div style={{ padding: '12px 16px 0 16px' }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--gh-text, #c9d1d9)' }}>
        Health Check
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <HealthStatusBadge status={row?.healthStatus} />
        <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
          {hasHc ? 'Configured' : 'Not configured'}
        </div>
      </div>

      {hasHc ? (
        <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ marginBottom: 2 }}>Test</div>
            <div style={{ color: 'var(--gh-text, #c9d1d9)', wordBreak: 'break-word' }}>{hc.test.join(' ')}</div>
          </div>
          <div>
            <div style={{ marginBottom: 2 }}>Retries</div>
            <div style={{ color: 'var(--gh-text, #c9d1d9)' }}>{hc.retries ?? '-'}</div>
          </div>
          <div>
            <div style={{ marginBottom: 2 }}>Interval</div>
            <div style={{ color: 'var(--gh-text, #c9d1d9)' }}>{hc.interval || '-'}</div>
          </div>
          <div>
            <div style={{ marginBottom: 2 }}>Timeout</div>
            <div style={{ color: 'var(--gh-text, #c9d1d9)' }}>{hc.timeout || '-'}</div>
          </div>
          <div>
            <div style={{ marginBottom: 2 }}>Start Period</div>
            <div style={{ color: 'var(--gh-text, #c9d1d9)' }}>{hc.startPeriod || '-'}</div>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
          No health check configured.
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--gh-text, #c9d1d9)' }}>
          Recent Results
        </div>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>No health check results.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {logs.slice(-6).map((l, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid var(--gh-border, #30363d)',
                  padding: '6px 8px',
                  fontSize: 12,
                  color: 'var(--gh-text-secondary, #8b949e)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div>Exit {l.exitCode}</div>
                  <div>{l.end ? formatTimestampDMYHMS(l.end) : '-'}</div>
                </div>
                {l.output ? (
                  <div style={{ marginTop: 4, color: 'var(--gh-text, #c9d1d9)', whiteSpace: 'pre-wrap' }}>{l.output}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type TaskInfoPanelProps = {
  row?: SwarmTaskRow | null;
};

function TaskInfoPanel({ row }: TaskInfoPanelProps) {
  const [logs, setLogs] = useState<HealthLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const STATUS_LABELS = new Set(['Current State', 'Desired State', 'Health Status']);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!row?.id) return;
      setLoadingLogs(true);
      try {
        const data = await GetSwarmTaskHealthLogs(row.id);
        if (!active) return;
        setLogs(Array.isArray(data) ? (data as HealthLogEntry[]) : []);
      } catch (_e) {
        if (!active) return;
        setLogs([]);
      } finally {
        // eslint-disable-next-line no-unsafe-finally
        if (!active) return;
        setLoadingLogs(false);
      }
    };

    // Only attempt to fetch when there is a container.
    if (row?.containerId) {
      load();
    } else {
      setLogs([]);
    }

    return () => {
      active = false;
    };
  }, [row?.id, row?.containerId]);

  const hc = row?.healthCheck;
  const hasHc = !!hc && Array.isArray(hc.test) && hc.test.length > 0;
  const hasTimeline = row?.createdAt || row?.updatedAt || row?.state || row?.desiredState;

  // Hide panel if no data
  if (!hasTimeline && !hasHc) {
    return null;
  }

  const infoItems = [];

  // Timeline info
  if (row?.createdAt) {
    infoItems.push({ label: 'Created', value: formatTimestampDMYHMS(row.createdAt) });
  }
  if (row?.updatedAt) {
    infoItems.push({ label: 'Updated', value: formatTimestampDMYHMS(row.updatedAt) });
  }
  if (row?.state) {
    infoItems.push({ label: 'Current State', value: row.state });
  }
  if (row?.desiredState) {
    infoItems.push({ label: 'Desired State', value: row.desiredState });
  }

  // Health check config info
  infoItems.push({ label: 'Health Status', value: row?.healthStatus || 'none' });
  infoItems.push({ label: 'Health Config', value: hasHc ? 'Configured' : 'Not configured' });
  if (hasHc) {
    infoItems.push({ label: 'Health Test', value: hc.test.join(' '), breakWord: true });
    if (hc.retries != null) {
      infoItems.push({ label: 'Retries', value: String(hc.retries) });
    }
    if (hc.interval) {
      infoItems.push({ label: 'Interval', value: hc.interval });
    }
    if (hc.timeout) {
      infoItems.push({ label: 'Timeout', value: hc.timeout });
    }
    if (hc.startPeriod) {
      infoItems.push({ label: 'Start Period', value: hc.startPeriod });
    }
  }

  if (infoItems.length === 0) {
    return null;
  }

  return (
    <div style={{
      width: 320,
      minWidth: 260,
      borderLeft: '1px solid var(--gh-border, #30363d)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
    }}>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, color: 'var(--gh-text, #c9d1d9)' }}>
          Task Details
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {infoItems.map((item) => {
            const isStatus = STATUS_LABELS.has(item.label);
            return (
              <div key={item.label} style={{ display: 'grid', gap: 2 }}>
                <div style={{ fontSize: 11, color: 'var(--gh-text-secondary, #8b949e)' }}>{item.label}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--gh-text, #c9d1d9)',
                    wordBreak: item.breakWord ? 'break-word' : 'normal',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {isStatus ? <StatusBadge status={item.value} size="small" /> : item.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {row?.containerId ? (
        <div style={{ padding: '0 16px 16px 16px' }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--gh-text, #c9d1d9)' }}>
            Health Check Results
          </div>
          {loadingLogs ? (
            <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>Loading…</div>
          ) : logs.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>No health check results.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {logs.slice(-8).map((l, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid var(--gh-border, #30363d)',
                    padding: '6px 8px',
                    fontSize: 12,
                    color: 'var(--gh-text-secondary, #8b949e)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div>Exit {l.exitCode}</div>
                    <div>{l.end ? formatTimestampDMYHMS(l.end) : '-'}</div>
                  </div>
                  {l.output ? (
                    <div style={{ marginTop: 4, color: 'var(--gh-text, #c9d1d9)', whiteSpace: 'pre-wrap' }}>{l.output}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

type TaskSummaryPanelProps = {
  row?: SwarmTaskRow | null;
};

function TaskSummaryPanel({ row }: TaskSummaryPanelProps) {
  const quickInfoFields: Array<{ key: string; label: string; type?: 'break-word' | 'date' }> = [
    { key: 'id', label: 'Task ID', type: 'break-word' },
    { key: 'serviceName', label: 'Service' },
    { key: 'nodeName', label: 'Node' },
    { key: 'slot', label: 'Slot' },
    { key: 'state', label: 'State' },
    { key: 'desiredState', label: 'Desired' },
    { key: 'containerId', label: 'Container', type: 'break-word' },
    { key: 'createdAt', label: 'Created', type: 'date' },
    { key: 'updatedAt', label: 'Updated', type: 'date' },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SummaryTabHeader name={row?.serviceName || row?.id} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
        <QuickInfoSection
          resourceName={row?.id}
          data={row ?? undefined}
          loading={false}
          error={null}
          fields={quickInfoFields}
        />
        <TaskInfoPanel row={row} />
      </div>
      <HealthCheckSection row={row} />
    </div>
  );
}

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

function renderPanelContent(
  row: SwarmTaskRow,
  tab: string,
  holmesState: HolmesState,
  onAnalyze?: (task: SwarmTaskRow) => void,
  onCancel?: () => void
) {
  if (tab === 'summary') {
    return <TaskSummaryPanel row={row} />;
  }
  if (tab === 'logs') {
    return (
      <AggregateLogsTab
        title="Task Logs"
        reloadKey={row?.id}
        loadLogs={() => (row?.id ? GetSwarmTaskLogs(row.id, '500') : '')}
      />
    );
  }
  if (tab === 'exec') {
    if (!row?.id) {
      const emptyMsg = getEmptyTabMessage('swarm-task-exec');
      return (
        <EmptyTabContent
          icon={emptyMsg.icon}
          title={emptyMsg.title}
          description={emptyMsg.description}
          tip={emptyMsg.tip}
        />
      );
    }
    return (
      <ConsoleTab
        swarmExec={true}
        swarmTaskId={row.id}
      />
    );
  }
  if (tab === 'holmes') {
    const key = `swarm/${row?.id}`;
    return (
      <HolmesBottomPanel
        kind="Swarm Task"
        name={row?.id}
        onAnalyze={() => onAnalyze?.(row)}
        onCancel={holmesState.key === key && holmesState.streamId ? onCancel : undefined}
        response={holmesState.key === key ? holmesState.response : null}
        loading={holmesState.key === key && holmesState.loading}
        error={holmesState.key === key ? holmesState.error : null}
        streamingText={holmesState.key === key ? holmesState.streamingText : ''}
        reasoningText={holmesState.key === key ? holmesState.reasoningText : ''}
        contextSteps={holmesState.key === key ? holmesState.contextSteps : []}
        toolEvents={holmesState.key === key ? holmesState.toolEvents : []}
        queryTimestamp={holmesState.key === key ? holmesState.queryTimestamp : null}
      />
    );
  }

  return null;
}

export default function SwarmTasksOverviewTable() {
  const [tasks, setTasks] = useState<SwarmTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
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
  const holmesStateRef = useRef(holmesState);
  useEffect(() => {
    holmesStateRef.current = holmesState;
  }, [holmesState]);

  useEffect(() => {
    let active = true;

    const loadTasks = async () => {
      try {
        const data = await GetSwarmTasks();
        if (active) {
          setTasks(Array.isArray(data) ? (data as SwarmTaskRow[]) : []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load tasks:', err);
        if (active) {
          setTasks([]);
          setLoading(false);
        }
      }
    };

    loadTasks();
    const off = EventsOn('swarm:tasks:update', (data) => {
      if (!active) return;
      if (Array.isArray(data)) {
        setTasks(data as SwarmTaskRow[]);
      } else {
        loadTasks();
      }
    });

    return () => {
      active = false;
      if (typeof off === 'function') off();
    };
  }, []);

  // Holmes streaming handler
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
        setHolmesState((prev) => ({ ...prev, loading: false, error: String(payload.error) }));
        return;
      }

      const eventType = payload.event;
      if (!payload.data) return;

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

  // Holmes context progress handler
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

  if (loading) {
    return <div className="main-panel-loading">Loading Swarm tasks...</div>;
  }

  const analyzeWithHolmes = async (task: SwarmTaskRow) => {
    const key = task?.id;
    if (!key) return;
    const streamId = `swarm-task-${Date.now()}`;
    setHolmesState({
      loading: true,
      response: null,
      error: null,
      key: `swarm/${key}`,
      streamId,
      streamingText: '',
      reasoningText: '',
      queryTimestamp: new Date().toISOString(),
      contextSteps: [],
      toolEvents: [],
    });
    try {
      await AnalyzeSwarmTaskStream(task.id, streamId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setHolmesState((prev) => ({
        ...prev,
        loading: false,
        response: null,
        error: message,
      }));
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

  return (
    <OverviewTableWithPanel
      title="Swarm Tasks"
      columns={columns}
      data={tasks}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeWithHolmes, cancelHolmesAnalysis)}
      tableTestId="swarm-tasks-table"
    />
  );
}

export { SwarmTasksOverviewTable };


