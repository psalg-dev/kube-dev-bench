import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import AggregateLogsTab from '../../../components/AggregateLogsTab.jsx';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils.js';
import {
  GetSwarmTasks,
  GetSwarmTaskLogs,
} from '../../swarmApi.js';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';

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
  { key: 'desiredState', label: 'Desired' },
  { key: 'containerId', label: 'Container', cell: ({ getValue }) => {
    const val = getValue();
    return val ? `${val.substring(0, 12)}...` : '-';
  }},
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'logs', label: 'Logs' },
];

function formatMount(m) {
  if (!m) return '-';
  const type = m.type || 'mount';
  const src = m.source || '-';
  const tgt = m.target || '-';
  const ro = m.readOnly ? ' (ro)' : '';
  return `${type}:${src} -> ${tgt}${ro}`;
}

function renderPanelContent(row, tab) {
  if (tab === 'summary') {
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
        <SummaryTabHeader name={`Task: ${row.id?.substring(0, 12) || 'unknown'}`} />
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
