import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import AggregateLogsTab from '../../../components/AggregateLogsTab.jsx';
import ConsoleTab from '../../../layout/bottompanel/ConsoleTab.jsx';
import EmptyTabContent from '../../../components/EmptyTabContent.jsx';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages.js';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils.js';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';
import { AnalyzeSwarmTaskStream, CancelHolmesStream, onHolmesChatStream, onHolmesContextProgress } from '../../../holmes/holmesApi';
import {
  GetSwarmTasks,
  GetSwarmTaskLogs,
  GetSwarmTaskHealthLogs,
} from '../../swarmApi.js';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import HealthStatusBadge from './HealthStatusBadge.jsx';
import { showError } from '../../../notification.js';
import StatusBadge from '../../../components/StatusBadge.jsx';

const columns = [
  { key: 'id', label: 'Task ID', cell: ({ getValue }) => {
    const val = getValue();
    return val ? `${val.substring(0, 12)}...` : '-';
  }},
  { key: 'serviceName', label: 'Service' },
  { key: 'nodeName', label: 'Node' },
  { key: 'slot', label: 'Slot' },
  { key: 'state', label: 'State', cell: ({ getValue }) => {
    const state = getValue();
    return <StatusBadge status={state || '-'} size="small" />;
  }},
  { key: 'healthStatus', label: 'Health', cell: ({ row }) => {
    const data = row?.original;
    return <HealthStatusBadge status={data?.healthStatus} />;
  }},
  { key: 'desiredState', label: 'Desired', cell: ({ getValue }) => {
    const desired = getValue();
    return <StatusBadge status={desired || '-'} size="small" />;
  }},
  { key: 'containerId', label: 'Container', cell: ({ getValue }) => {
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

function HealthCheckSection({ row }) {
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!row?.id) return;
      setLoading(true);
      try {
        const data = await GetSwarmTaskHealthLogs(row.id);
        if (!active) return;
        setLogs(Array.isArray(data) ? data : []);
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
        ) : !logs || logs.length === 0 ? (
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

function TaskInfoPanel({ row }) {
  const [logs, setLogs] = useState(null);
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
        setLogs(Array.isArray(data) ? data : []);
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
  if (hasHc) {
    infoItems.push({ label: 'Health Status', value: row?.healthStatus || 'none' });
    infoItems.push({ label: 'Health Config', value: 'Configured' });
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
      borderLeft: '1px solid #30363d',
      background: '#0d1117',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      textAlign: 'left',
    }}>
      <div style={{
        height: 44,
        padding: '0 12px',
        borderBottom: '1px solid #30363d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontWeight: 600,
        textAlign: 'left',
        background: '#161b22',
        color: '#d4d4d4',
      }}>
        Details
      </div>
      <div style={{
        padding: 12,
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 10,
        flex: 1,
        overflow: 'auto',
        textAlign: 'left',
        color: '#d4d4d4',
      }}>
        {infoItems.map((item, idx) => {
          const isStatus = STATUS_LABELS.has(item.label);
          return (
            <div key={idx} style={{ fontSize: 12, display: 'grid', gap: 4 }}>
              <div style={{ color: '#858585' }}>{item.label}</div>
              <div style={{
                color: '#d4d4d4',
                wordBreak: item.breakWord ? 'break-word' : 'normal',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                justifyContent: 'flex-start',
                textAlign: 'left',
              }}>
                {isStatus ? (
                  <StatusBadge status={item.value || '-'} size="small" showDot={false} />
                ) : (
                  item.value
                )}
              </div>
            </div>
          );
        })}

        {hasHc && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: '#d4d4d4' }}>
              Recent Results
            </div>
            {loadingLogs ? (
              <div style={{ fontSize: 12, color: '#858585' }}>Loading…</div>
            ) : !logs || logs.length === 0 ? (
              <div style={{ fontSize: 12, color: '#858585' }}>No health check results.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {logs.slice(-4).map((l, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #30363d',
                      padding: '6px 8px',
                      fontSize: 11,
                      color: '#858585',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <div>Exit {l.exitCode}</div>
                      <div style={{ fontSize: 10 }}>{l.end ? formatTimestampDMYHMS(l.end) : '-'}</div>
                    </div>
                    {l.output ? (
                      <div style={{ marginTop: 4, color: '#d4d4d4', whiteSpace: 'pre-wrap', fontSize: 10 }}>{l.output}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskSummaryPanel({ row, onExec }) {
  const quickInfoFields = [
    { key: 'id', label: 'Task ID', type: 'break-word' },
    { key: 'serviceId', label: 'Service ID', type: 'break-word' },
    { key: 'serviceName', label: 'Service Name' },
    { key: 'nodeId', label: 'Node ID', type: 'break-word' },
    { key: 'nodeName', label: 'Node Name' },
    { key: 'slot', label: 'Slot' },
    {
      key: 'state',
      label: 'State',
      type: 'status',
      layout: 'flex',
      rightField: { key: 'desiredState', label: 'Desired State', type: 'status' }
    },
    { key: 'healthStatus', label: 'Health', type: 'status', getValue: (d) => d.healthStatus || 'none' },
    { key: 'containerId', label: 'Container ID', type: 'break-word' },
    { key: 'image', label: 'Image', type: 'break-word' },
    {
      key: 'networks',
      label: 'Networks',
      type: 'list',
      getValue: (d) => {
        const nets = Array.isArray(d.networks) ? d.networks : [];
        return nets.flatMap((n) => {
          const id = n.networkId ? `${String(n.networkId).slice(0, 12)}...` : 'unknown';
          const addrs = Array.isArray(n.addresses) ? n.addresses : [];
          if (!addrs.length) return [`${id}`];
          return addrs.map((a) => `${id}: ${a}`);
        });
      },
    },
    {
      key: 'mounts',
      label: 'Mounts',
      type: 'list',
      getValue: (d) => (Array.isArray(d.mounts) ? d.mounts : []).map(formatMount),
    },
    { key: 'error', label: 'Error', type: 'break-word' },
    { key: 'createdAt', label: 'Created', type: 'date' },
    { key: 'updatedAt', label: 'Updated', type: 'date' },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SummaryTabHeader
        name={`Task: ${row.id?.substring(0, 12) || 'unknown'}`}
        actions={(
          <button
            onClick={() => onExec && onExec()}
            disabled={!row?.containerId || (row?.state || '').toLowerCase() !== 'running'}
            title={
              !row?.containerId
                ? 'No container associated with this task yet'
                : (row?.state || '').toLowerCase() !== 'running'
                  ? 'Exec is only available for running tasks'
                  : 'Open interactive exec'
            }
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--gh-border, #30363d)',
              background: 'var(--gh-bg, #0d1117)',
              color: 'var(--gh-text, #c9d1d9)',
              cursor: (!row?.containerId || (row?.state || '').toLowerCase() !== 'running') ? 'not-allowed' : 'pointer',
              opacity: (!row?.containerId || (row?.state || '').toLowerCase() !== 'running') ? 0.5 : 1,
            }}
          >
            Exec
          </button>
        )}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
        <QuickInfoSection
          resourceName={row.id}
          data={row}
          loading={false}
          error={null}
          fields={quickInfoFields}
        />
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {row.containerId ? (
              <AggregateLogsTab
                title="Task Logs (preview)"
                reloadKey={row.id}
                loadLogs={() => GetSwarmTaskLogs(row.id, '100')}
              />
            ) : (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
                No container associated with this task yet.
              </div>
            )}
          </div>
        </div>
        <TaskInfoPanel row={row} />
      </div>
    </div>
  );
}

function formatMount(m) {
  if (!m) return '-';
  const type = m.type || 'mount';
  const src = m.source || '-';
  const tgt = m.target || '-';
  const ro = m.readOnly ? ' (ro)' : '';
  return `${type}:${src} -> ${tgt}${ro}`;
}

function renderPanelContent(row, tab, panelApi, holmesState, onAnalyze, onCancel) {
  if (tab === 'summary') {
    return <TaskSummaryPanel row={row} onExec={() => panelApi?.setActiveTab && panelApi.setActiveTab('exec')} />;
  }

  if (tab === 'logs') {
    if (!row.containerId) {
      const emptyMsg = getEmptyTabMessage('swarm-task-logs');
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
      <AggregateLogsTab
        title="Task Logs"
        reloadKey={row.id}
        loadLogs={() => GetSwarmTaskLogs(row.id, '500')}
      />
    );
  }

  if (tab === 'exec') {
    if (!row?.containerId) {
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
    if ((row?.state || '').toLowerCase() !== 'running') {
      return (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
          Exec is only available for running tasks.
        </div>
      );
    }

    return (
      <ConsoleTab
        swarmExec={true}
        swarmTaskId={row.id}
        shell="auto"
      />
    );
  }

  if (tab === 'holmes') {
    const key = `swarm/${row.id}`;
    return (
      <HolmesBottomPanel
        kind="Swarm Task"
        namespace="swarm"
        name={row.id}
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

export default function SwarmTasksOverviewTable() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    let active = true;

    const loadTasks = async () => {
      try {
        const data = await GetSwarmTasks();
        if (active) {
          setTasks(data || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load Swarm tasks:', err);
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
        setTasks(data);
      } else {
        loadTasks();
      }
    });

    return () => {
      active = false;
      if (typeof off === 'function') off();
    };
  }, []);

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

  if (loading) {
    return <div className="main-panel-loading">Loading Swarm tasks...</div>;
  }

  const analyzeWithHolmes = async (task) => {
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
      const message = err?.message || String(err);
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
      renderPanelContent={(row, tab, api) => renderPanelContent(row, tab, api, holmesState, analyzeWithHolmes, cancelHolmesAnalysis)}
      tableTestId="swarm-tasks-table"
      createPlatform="swarm"
      createKind="service"
      createButtonTitle="Create service (tasks are created by services)"
      createHint="Tasks can’t be created directly. Creating a service will create tasks."
      getRowActions={(row, api) => {
        const hasContainer = Boolean(row?.containerId);
        const isRunning = String(row?.state || '').toLowerCase() === 'running';
        const isAnalyzing = holmesState.loading && holmesState.key === `swarm/${row.id}`;

        return [
          {
            label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
            icon: '🧠',
            disabled: isAnalyzing,
            onClick: () => {
              analyzeWithHolmes(row);
              api?.openDetails?.('holmes');
            },
          },
          {
            label: 'Logs',
            icon: '📜',
            disabled: !hasContainer,
            onClick: () => api?.openDetails?.('logs'),
          },
          {
            label: 'Exec',
            icon: '🖥️',
            disabled: !hasContainer || !isRunning,
            onClick: () => api?.openDetails?.('exec'),
          },
        ];
      }}
    />
  );
}
