import React, { useEffect, useState, useCallback } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import NodeTasksTab from './NodeTasksTab.jsx';
import {
  GetSwarmNodes,
  UpdateSwarmNodeAvailability,
  RemoveSwarmNode,
} from '../../swarmApi.js';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import { showSuccess, showError } from '../../../notification.js';

const columns = [
  { key: 'hostname', label: 'Hostname' },
  { key: 'role', label: 'Role', cell: ({ getValue }) => {
    const role = getValue();
    const isManager = role === 'manager';
    return (
      <span style={{ color: isManager ? '#58a6ff' : 'inherit', fontWeight: isManager ? 500 : 400 }}>
        {role}
      </span>
    );
  }},
  { key: 'availability', label: 'Availability', cell: ({ getValue }) => {
    const avail = getValue();
    const getColor = (a) => {
      switch (a?.toLowerCase()) {
        case 'active': return '#3fb950';
        case 'pause': return '#e6b800';
        case 'drain': return '#f85149';
        default: return '#8b949e';
      }
    };
    return <span style={{ color: getColor(avail) }}>{avail}</span>;
  }},
  { key: 'state', label: 'State', cell: ({ getValue }) => {
    const state = getValue();
    const isReady = state === 'ready';
    return (
      <span style={{ color: isReady ? '#3fb950' : '#f85149' }}>
        {state}
      </span>
    );
  }},
  { key: 'address', label: 'Address' },
  { key: 'engineVersion', label: 'Engine' },
  { key: 'leader', label: 'Leader', cell: ({ getValue }) => {
    return getValue() ? '✓' : '';
  }},
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'tasks', label: 'Tasks' },
];

function renderPanelContent(row, tab, onRefresh) {
  if (tab === 'summary') {
    const quickInfoFields = [
      { key: 'id', label: 'Node ID', type: 'break-word' },
      { key: 'hostname', label: 'Hostname' },
      {
        key: 'role',
        label: 'Role',
        layout: 'flex',
        rightField: { key: 'leader', label: 'Leader', getValue: (d) => d.leader ? 'Yes' : 'No' }
      },
      {
        key: 'availability',
        label: 'Availability',
        layout: 'flex',
        rightField: { key: 'state', label: 'State' }
      },
      { key: 'address', label: 'Address' },
      { key: 'engineVersion', label: 'Docker Version' },
    ];

    const handleDrain = async () => {
      try {
        await UpdateSwarmNodeAvailability(row.id, 'drain');
        showSuccess(`Node ${row.hostname} set to drain`);
        onRefresh?.();
      } catch (err) {
        showError(`Failed to drain node: ${err}`);
      }
    };

    const handleActivate = async () => {
      try {
        await UpdateSwarmNodeAvailability(row.id, 'active');
        showSuccess(`Node ${row.hostname} activated`);
        onRefresh?.();
      } catch (err) {
        showError(`Failed to activate node: ${err}`);
      }
    };

    const handleDelete = async () => {
      try {
        await RemoveSwarmNode(row.id, false);
        showSuccess(`Node ${row.hostname} removed`);
        onRefresh?.();
      } catch (err) {
        showError(`Failed to remove node: ${err}`);
      }
    };

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.hostname}
          labels={row.labels}
          actions={
            <SwarmResourceActions
              resourceType="node"
              name={row.hostname}
              availability={row.availability}
              onDrain={handleDrain}
              onActivate={handleActivate}
              onDelete={row.role !== 'manager' ? handleDelete : undefined}
            />
          }
        />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.hostname}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
        </div>
      </div>
    );
  }

  if (tab === 'tasks') {
    return <NodeTasksTab nodeId={row.id} nodeName={row.hostname} />;
  }

  return null;
}

export default function SwarmNodesOverviewTable() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    let active = true;

    const loadNodes = async () => {
      try {
        const data = await GetSwarmNodes();
        if (active) {
          setNodes(data || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load Swarm nodes:', err);
        if (active) {
          setNodes([]);
          setLoading(false);
        }
      }
    };

    loadNodes();

    const off = EventsOn('swarm:nodes:update', (data) => {
      if (active && Array.isArray(data)) {
        setNodes(data);
      }
    });

    return () => {
      active = false;
      if (typeof off === 'function') off();
    };
  }, [refreshKey]);

  if (loading) {
    return <div className="main-panel-loading">Loading Swarm nodes...</div>;
  }

  return (
    <OverviewTableWithPanel
      title="Swarm Nodes"
      columns={columns}
      data={nodes}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, refresh)}
    />
  );
}
