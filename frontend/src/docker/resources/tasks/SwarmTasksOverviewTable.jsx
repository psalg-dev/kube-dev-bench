import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import AggregateLogsTab from '../../../components/AggregateLogsTab.jsx';
import ConsoleTab from '../../../layout/bottompanel/ConsoleTab.jsx';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils.js';
import {
  GetSwarmTasks,
  GetSwarmTaskLogs,
  GetSwarmTaskHealthLogs,
} from '../../swarmApi.js';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import HealthStatusBadge from './HealthStatusBadge.jsx';

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
    const getColor = (s) => {
      switch (s?.toLowerCase()) {
        case 'running': return '#3fb950';
        case 'pending':
        case 'preparing':
        case 'starting': return '#e6b800';
        case 'complete': return '#8b949e';
        case 'failed':
        case 'rejected': return '#f85149';
        default: return '#8b949e';
      }
    };
    return <span style={{ color: getColor(state), fontWeight: 500 }}>{state}</span>;
  }},
  { key: 'healthStatus', label: 'Health', cell: ({ row }) => {
    const data = row?.original;
    return <HealthStatusBadge status={data?.healthStatus} />;
  }},
  { key: 'desiredState', label: 'Desired' },
  { key: 'containerId', label: 'Container', cell: ({ getValue }) => {
    const val = getValue();
    return val ? `${val.substring(0, 12)}...` : '-';
  }},
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'logs', label: 'Logs' },
  { key: 'exec', label: 'Exec' },
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
      } catch (e) {
        if (!active) return;
        setLogs([]);
      } finally {
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
      layout: 'flex',
      rightField: { key: 'desiredState', label: 'Desired State' }
    },
    { key: 'healthStatus', label: 'Health', getValue: (d) => d.healthStatus || 'none' },
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
          <div style={{ padding: '12px 16px 0 16px' }}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--gh-text, #c9d1d9)' }}>
              Timeline (derived)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
              <div>
                <div style={{ marginBottom: 2 }}>Created</div>
                <div style={{ color: 'var(--gh-text, #c9d1d9)' }}>{row.createdAt ? formatTimestampDMYHMS(row.createdAt) : '-'}</div>
              </div>
              <div>
                <div style={{ marginBottom: 2 }}>Updated</div>
                <div style={{ color: 'var(--gh-text, #c9d1d9)' }}>{row.updatedAt ? formatTimestampDMYHMS(row.updatedAt) : '-'}</div>
              </div>
              <div>
                <div style={{ marginBottom: 2 }}>Current State</div>
                <div style={{ color: 'var(--gh-text, #c9d1d9)' }}>{row.state || '-'}</div>
              </div>
              <div>
                <div style={{ marginBottom: 2 }}>Desired State</div>
                <div style={{ color: 'var(--gh-text, #c9d1d9)' }}>{row.desiredState || '-'}</div>
              </div>
            </div>
          </div>

          <HealthCheckSection row={row} />

          <div style={{ flex: 1, minHeight: 0, position: 'relative', marginTop: 12 }}>
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

function renderPanelContent(row, tab, panelApi) {
  if (tab === 'summary') {
    return <TaskSummaryPanel row={row} onExec={() => panelApi?.setActiveTab && panelApi.setActiveTab('exec')} />;
  }

  if (tab === 'logs') {
    if (!row.containerId) {
      return (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
          No container associated with this task yet.
        </div>
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
      return (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
          No container associated with this task yet.
        </div>
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

  return null;
}

export default function SwarmTasksOverviewTable() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <OverviewTableWithPanel
      title="Swarm Tasks"
      columns={columns}
      data={tasks}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      tableTestId="swarm-tasks-table"
      createPlatform="swarm"
      createKind="service"
      createButtonTitle="Create service (tasks are created by services)"
      createHint="Tasks can’t be created directly. Creating a service will create tasks."
    />
  );
}
