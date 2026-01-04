import React, { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import AggregateLogsTab from '../../../components/AggregateLogsTab.jsx';
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
      if (active && Array.isArray(data)) {
        setTasks(data);
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
      createPlatform="swarm"
      createKind="task"
    />
  );
}
