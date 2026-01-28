import { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import AggregateLogsTab from '../../../components/AggregateLogsTab.jsx';
import ConsoleTab from '../../../layout/bottompanel/ConsoleTab.jsx';
import EmptyTabContent from '../../../components/EmptyTabContent.jsx';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages.js';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils.js';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';
import { AnalyzeSwarmTaskStream } from '../../../holmes/holmesApi';
import useHolmesStream from '../../../holmes/useHolmesStream';
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
  {
    key: 'id',
    label: 'Task ID',
    cell: ({ getValue }) => {
      const val = getValue();
      return val ? `${val.substring(0, 12)}...` : '-';
    },
  },
  { key: 'serviceName', label: 'Service' },
  { key: 'nodeName', label: 'Node' },
  { key: 'slot', label: 'Slot' },
  {
    key: 'state',
    label: 'State',
    cell: ({ getValue }) => {
      const state = getValue();
      return <StatusBadge status={state || '-'} size="small" />;
    },
  },
  {
    key: 'healthStatus',
    label: 'Health',
    cell: ({ row }) => {
      const data = row?.original;
      return <HealthStatusBadge status={data?.healthStatus} />;
    },
  },
  {
    key: 'desiredState',
    label: 'Desired',
    cell: ({ getValue }) => {
      const desired = getValue();
      return <StatusBadge status={desired || '-'} size="small" />;
    },
  },
  {
    key: 'containerId',
    label: 'Container',
    cell: ({ getValue }) => {
      const val = getValue();
      return val ? `${val.substring(0, 12)}...` : '-';
    },
  },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'logs', label: 'Logs' },
  { key: 'exec', label: 'Exec' },
  { key: 'holmes', label: 'Holmes' },
];

const STATUS_LABELS = new Set(['Current State', 'Desired State', 'Health Status']);

function TaskInfoPanel({ row }) {
  const [logs, setLogs] = useState(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoadingLogs(true);
      try {
        const data = await GetSwarmTaskHealthLogs(row?.id);
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

    if (row?.containerId) {
      load();
    } else {
      setLogs([]);
      setLoadingLogs(false);
    }

    return () => {
      active = false;
    };
  }, [row?.id, row?.containerId]);

  const hc = row?.healthCheck;
  const hasHc = !!hc && Array.isArray(hc.test) && hc.test.length > 0;
  const hasTimeline =
    row?.createdAt || row?.updatedAt || row?.state || row?.desiredState;

  // Hide panel if no data
  if (!hasTimeline && !hasHc) {
    return null;
  }

  const infoItems = [];

  // Timeline info
  if (row?.createdAt) {
    infoItems.push({
      label: 'Created',
      value: formatTimestampDMYHMS(row.createdAt),
    });
  }
  if (row?.updatedAt) {
    infoItems.push({
      label: 'Updated',
      value: formatTimestampDMYHMS(row.updatedAt),
    });
  }
  if (row?.state) {
    infoItems.push({ label: 'Current State', value: row.state });
  }
  if (row?.desiredState) {
    infoItems.push({ label: 'Desired State', value: row.desiredState });
  }

  // Health check config info
  infoItems.push({
    label: 'Health Status',
    value: row?.healthStatus || 'none',
  });
  infoItems.push({
    label: 'Health Config',
    value: hasHc ? 'Configured' : 'Not configured',
  });
  if (hasHc) {
    infoItems.push({
      label: 'Health Test',
      value: hc.test.join(' '),
      breakWord: true,
    });
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
    <div
      style={{
        width: 320,
        minWidth: 260,
        borderLeft: '1px solid #30363d',
        background: '#0d1117',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        textAlign: 'left',
      }}
    >
      <div
        style={{
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
        }}
      >
        Details
      </div>
      <div
        style={{
          padding: 12,
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 10,
          flex: 1,
          overflow: 'auto',
          textAlign: 'left',
          color: '#d4d4d4',
        }}
      >
        {infoItems.map((item, idx) => {
          const isStatus = STATUS_LABELS.has(item.label);
          return (
            <div key={idx} style={{ fontSize: 12, display: 'grid', gap: 4 }}>
              <div style={{ color: '#858585' }}>{item.label}</div>
              <div
                style={{
                  color: '#d4d4d4',
                  wordBreak: item.breakWord ? 'break-word' : 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                }}
              >
                {isStatus ? (
                  <StatusBadge
                    status={item.value || '-'}
                    size="small"
                    showDot={false}
                  />
                ) : (
                  item.value
                )}
              </div>
            </div>
          );
        })}

        <div style={{ marginTop: 6 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 12,
              marginBottom: 8,
              color: '#d4d4d4',
            }}
          >
            Health Check
          </div>
          <div style={{ fontSize: 12, color: '#858585', marginBottom: 10 }}>
            {hasHc ? 'Configured' : 'Not configured'}
          </div>
          <div
            style={{
              fontWeight: 600,
              fontSize: 12,
              marginBottom: 8,
              color: '#d4d4d4',
            }}
          >
            Recent Results
          </div>
          {loadingLogs ? (
            <div style={{ fontSize: 12, color: '#858585' }}>Loading…</div>
          ) : !logs || logs.length === 0 ? (
            <div style={{ fontSize: 12, color: '#858585' }}>
              No health check results.
            </div>
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
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 6,
                    }}
                  >
                    <div>Exit {l.exitCode}</div>
                    <div style={{ fontSize: 10 }}>
                      {l.end ? formatTimestampDMYHMS(l.end) : '-'}
                    </div>
                  </div>
                  {l.output ? (
                    <div
                      style={{
                        marginTop: 4,
                        color: '#d4d4d4',
                        whiteSpace: 'pre-wrap',
                        fontSize: 10,
                      }}
                    >
                      {l.output}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
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
      rightField: {
        key: 'desiredState',
        label: 'Desired State',
        type: 'status',
      },
    },
    {
      key: 'healthStatus',
      label: 'Health',
      type: 'status',
      getValue: (d) => d.healthStatus || 'none',
    },
    { key: 'containerId', label: 'Container ID', type: 'break-word' },
    { key: 'image', label: 'Image', type: 'break-word' },
    {
      key: 'networks',
      label: 'Networks',
      type: 'list',
      getValue: (d) => {
        const nets = Array.isArray(d.networks) ? d.networks : [];
        return nets.flatMap((n) => {
          const id = n.networkId
            ? `${String(n.networkId).slice(0, 12)}...`
            : 'unknown';
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
      getValue: (d) =>
        (Array.isArray(d.mounts) ? d.mounts : []).map(formatMount),
    },
    { key: 'error', label: 'Error', type: 'break-word' },
    { key: 'createdAt', label: 'Created', type: 'date' },
    { key: 'updatedAt', label: 'Updated', type: 'date' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <SummaryTabHeader
        name={`Task: ${row.id?.substring(0, 12) || 'unknown'}`}
        actions={
          <button
            onClick={() => onExec && onExec()}
            disabled={
              !row?.containerId ||
              (row?.state || '').toLowerCase() !== 'running'
            }
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
              cursor:
                !row?.containerId ||
                (row?.state || '').toLowerCase() !== 'running'
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                !row?.containerId ||
                (row?.state || '').toLowerCase() !== 'running'
                  ? 0.5
                  : 1,
            }}
          >
            Exec
          </button>
        }
      />
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          color: 'var(--gh-text, #c9d1d9)',
        }}
      >
        <QuickInfoSection
          resourceName={row.id}
          data={row}
          loading={false}
          error={null}
          fields={quickInfoFields}
        />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {row.containerId ? (
              <AggregateLogsTab
                title="Task Logs (preview)"
                reloadKey={row.id}
                loadLogs={() => GetSwarmTaskLogs(row.id, '100')}
              />
            ) : (
              <div
                style={{
                  padding: 32,
                  textAlign: 'center',
                  color: 'var(--gh-text-secondary)',
                }}
              >
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

function renderPanelContent(
  row,
  tab,
  panelApi,
  holmesState,
  onAnalyze,
  onCancel,
) {
  if (tab === 'summary') {
    return (
      <TaskSummaryPanel
        row={row}
        onExec={() => panelApi?.setActiveTab && panelApi.setActiveTab('exec')}
      />
    );
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
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            color: 'var(--gh-text-secondary)',
          }}
        >
          Exec is only available for running tasks.
        </div>
      );
    }

    return <ConsoleTab swarmExec={true} swarmTaskId={row.id} shell="auto" />;
  }

  if (tab === 'holmes') {
    const key = `swarm/${row.id}`;
    return (
      <HolmesBottomPanel
        kind="Swarm Task"
        namespace="swarm"
        name={row.id}
        onAnalyze={() => onAnalyze(row)}
        onCancel={
          holmesState.key === key && holmesState.streamId ? onCancel : null
        }
        response={holmesState.key === key ? holmesState.response : null}
        loading={holmesState.key === key && holmesState.loading}
        error={holmesState.key === key ? holmesState.error : null}
        queryTimestamp={
          holmesState.key === key ? holmesState.queryTimestamp : null
        }
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
  const { holmesState, startAnalysis, cancelAnalysis } = useHolmesStream();

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


  if (loading) {
    return <div className="main-panel-loading">Loading Swarm tasks...</div>;
  }

  const analyzeWithHolmes = async (task) => {
    const key = task?.id;
    if (!key) return;
    await startAnalysis({
      key: `swarm/${key}`,
      streamPrefix: 'swarm-task',
      run: (streamId) => AnalyzeSwarmTaskStream(task.id, streamId),
      onError: (message) => showError(`Holmes analysis failed: ${message}`),
    });
  };

  const cancelHolmesAnalysis = async () => {
    await cancelAnalysis();
  };

  return (
    <OverviewTableWithPanel
      title="Swarm Tasks"
      columns={columns}
      data={tasks}
      tabs={bottomTabs}
      renderPanelContent={(row, tab, api) =>
        renderPanelContent(
          row,
          tab,
          api,
          holmesState,
          analyzeWithHolmes,
          cancelHolmesAnalysis,
        )
      }
      tableTestId="swarm-tasks-table"
      createPlatform="swarm"
      createKind="service"
      createButtonTitle="Create service (tasks are created by services)"
      createHint="Tasks can’t be created directly. Creating a service will create tasks."
      getRowActions={(row, api) => {
        const hasContainer = Boolean(row?.containerId);
        const isRunning = String(row?.state || '').toLowerCase() === 'running';
        const isAnalyzing =
          holmesState.loading && holmesState.key === `swarm/${row.id}`;

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
