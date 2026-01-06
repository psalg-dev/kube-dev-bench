import React, { useEffect, useState, useCallback } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import AggregateLogsTab from '../../../components/AggregateLogsTab.jsx';
import ServiceTasksTab from './ServiceTasksTab.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import {
  GetSwarmServices,
  ScaleSwarmService,
  RemoveSwarmService,
  RestartSwarmService,
  GetSwarmServiceLogs,
} from '../../swarmApi.js';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import { showSuccess, showError } from '../../../notification.js';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils.js';

const columns = [
  { key: 'name', label: 'Name' },
  {
    key: 'image',
    label: 'Image',
    cell: ({ getValue }) => {
      const val = getValue();
      if (!val) return '-';
      return (
        <span
          title={val}
          style={{
            display: 'inline-block',
            maxWidth: 360,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            verticalAlign: 'bottom',
          }}
        >
          {val}
        </span>
      );
    },
  },
  { key: 'mode', label: 'Mode' },
  { key: 'replicas', label: 'Replicas', cell: ({ getValue }) => {
    const val = getValue();
    return val !== undefined ? val : '-';
  }},
  { key: 'runningTasks', label: 'Running' },
  { key: 'ports', label: 'Ports', cell: ({ getValue }) => {
    const ports = getValue();
    if (!ports || ports.length === 0) return '-';
    return ports.map(p => `${p.publishedPort}:${p.targetPort}/${p.protocol}`).join(', ');
  }},
  { key: 'createdAt', label: 'Created', cell: ({ getValue }) => {
    const val = getValue();
    if (!val) return '-';
    return formatTimestampDMYHMS(val);
  }},
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'logs', label: 'Logs' },
];

function renderPanelContent(row, tab, onRefresh) {
  if (tab === 'summary') {
    const quickInfoFields = [
      {
        key: 'mode',
        label: 'Mode',
        layout: 'flex',
        rightField: {
          key: 'replicas',
          label: 'Replicas',
        }
      },
      {
        key: 'runningTasks',
        label: 'Running Tasks',
        layout: 'flex',
        rightField: {
          key: 'createdAt',
          label: 'Created',
          type: 'date',
        }
      },
      { key: 'image', label: 'Image', type: 'break-word' },
      { key: 'id', label: 'Service ID', type: 'break-word' },
    ];

    const handleScale = async (newReplicas) => {
      try {
        await ScaleSwarmService(row.id, newReplicas);
        showSuccess(`Scaled service ${row.name} to ${newReplicas} replicas`);
        onRefresh?.();
      } catch (err) {
        showError(`Failed to scale service: ${err}`);
      }
    };

    const handleRestart = async () => {
      try {
        await RestartSwarmService(row.id);
        showSuccess(`Restarted service ${row.name}`);
        onRefresh?.();
      } catch (err) {
        showError(`Failed to restart service: ${err}`);
      }
    };

    const handleDelete = async () => {
      try {
        await RemoveSwarmService(row.id);
        showSuccess(`Removed service ${row.name}`);
        onRefresh?.();
      } catch (err) {
        showError(`Failed to remove service: ${err}`);
      }
    };

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels}
          actions={
            <SwarmResourceActions
              resourceType="service"
              name={row.name}
              canScale={row.mode === 'replicated'}
              currentReplicas={row.replicas}
              onScale={handleScale}
              onRestart={handleRestart}
              onDelete={handleDelete}
            />
          }
        />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
            <AggregateLogsTab
              title="Service Logs"
              reloadKey={row.id}
              loadLogs={() => GetSwarmServiceLogs(row.id, '100')}
            />
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'tasks') {
    return <ServiceTasksTab serviceId={row.id} serviceName={row.name} />;
  }

  if (tab === 'logs') {
    return (
      <AggregateLogsTab
        title="Service Logs"
        reloadKey={row.id}
        loadLogs={() => GetSwarmServiceLogs(row.id, '500')}
      />
    );
  }

  return null;
}

export default function SwarmServicesOverviewTable() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    let active = true;

    const loadServices = async () => {
      try {
        const data = await GetSwarmServices();
        if (active) {
          setServices(data || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load Swarm services:', err);
        if (active) {
          setServices([]);
          setLoading(false);
        }
      }
    };

    loadServices();

    // Subscribe to real-time updates
    const off = EventsOn('swarm:services:update', (data) => {
      if (active && Array.isArray(data)) {
        setServices(data);
      } else if (active) {
        refresh();
      }
    });

    return () => {
      active = false;
      if (typeof off === 'function') off();
    };
  }, [refreshKey]);

  if (loading) {
    return <div className="main-panel-loading">Loading Swarm services...</div>;
  }

  return (
    <OverviewTableWithPanel
      title="Swarm Services"
      columns={columns}
      data={services}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, refresh)}
      tableTestId="swarm-services-table"
      createPlatform="swarm"
      createKind="service"
    />
  );
}
