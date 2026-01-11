import React, { useEffect, useState, useCallback } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import NodeTasksTab from './NodeTasksTab.jsx';
import NodeLabelsTab from './NodeLabelsTab.jsx';
import NodeLogsTab from './NodeLogsTab.jsx';
import {
  GetSwarmNodes,
  UpdateSwarmNodeAvailability,
  UpdateSwarmNodeRole,
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
  { key: 'logs', label: 'Logs' },
  { key: 'labels', label: 'Labels' },
];

function formatBytes(bytes) {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b <= 0) return '-';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const fixed = i === 0 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(fixed)} ${units[i]}`;
}

function formatNanoCPUs(nanoCpus) {
  const n = Number(nanoCpus);
  if (!Number.isFinite(n) || n <= 0) return '-';
  const cores = n / 1e9;
  const fixed = cores >= 10 ? 1 : 2;
  return `${cores.toFixed(fixed)} cores`;
}

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
      {
        key: 'platform',
        label: 'Platform',
        getValue: (d) => (d.os || d.arch) ? `${d.os || '?'} / ${d.arch || '?'}` : '-',
      },
      {
        key: 'capacity',
        label: 'Capacity',
        layout: 'flex',
        getValue: (d) => formatNanoCPUs(d.nanoCpus),
        rightField: {
          key: 'memoryBytes',
          label: 'Memory',
          getValue: (d) => formatBytes(d.memoryBytes),
        },
      },
    ];

    if (row.role === 'manager' && row.tls) {
      if (row.tls.trustRoot) {
        quickInfoFields.push({ key: 'tlsTrustRoot', label: 'TLS Trust Root', type: 'break-word', getValue: (d) => d.tls?.trustRoot });
      }
      if (row.tls.issuerSubject) {
        quickInfoFields.push({ key: 'tlsIssuerSubject', label: 'TLS Issuer Subject (base64)', type: 'break-word', getValue: (d) => d.tls?.issuerSubject });
      }
      if (row.tls.issuerPublicKey) {
        quickInfoFields.push({ key: 'tlsIssuerPublicKey', label: 'TLS Issuer Public Key (base64)', type: 'break-word', getValue: (d) => d.tls?.issuerPublicKey });
      }
    }

    const buttonStyle = {
      padding: '6px 12px',
      borderRadius: 4,
      border: '1px solid var(--gh-border, #30363d)',
      backgroundColor: 'var(--gh-button-bg, #21262d)',
      color: 'var(--gh-text, #c9d1d9)',
      cursor: 'pointer',
      fontSize: 12,
      fontWeight: 500,
    };

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

    const handlePromote = async () => {
      if (!window.confirm(`Promote node "${row.hostname}" to manager?`)) return;
      try {
        await UpdateSwarmNodeRole(row.id, 'manager');
        showSuccess(`Node ${row.hostname} promoted to manager`);
        onRefresh?.();
      } catch (err) {
        showError(`Failed to promote node: ${err}`);
      }
    };

    const handleDemote = async () => {
      if (row.leader) {
        showError('Cannot demote the current leader node');
        return;
      }
      if (!window.confirm(`Demote node "${row.hostname}" to worker?`)) return;
      try {
        await UpdateSwarmNodeRole(row.id, 'worker');
        showSuccess(`Node ${row.hostname} demoted to worker`);
        onRefresh?.();
      } catch (err) {
        showError(`Failed to demote node: ${err}`);
      }
    };

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.hostname}
          labels={row.labels}
          actions={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {row.role === 'worker' && (
                <button
                  id="swarm-node-promote-btn"
                  style={buttonStyle}
                  onClick={handlePromote}
                >
                  Promote
                </button>
              )}
              {row.role === 'manager' && (
                <button
                  id="swarm-node-demote-btn"
                  style={{ ...buttonStyle, opacity: row.leader ? 0.6 : 1, cursor: row.leader ? 'not-allowed' : 'pointer' }}
                  onClick={row.leader ? undefined : handleDemote}
                  disabled={row.leader}
                  title={row.leader ? 'Leader cannot be demoted' : undefined}
                >
                  Demote
                </button>
              )}
              <SwarmResourceActions
                resourceType="node"
                name={row.hostname}
                availability={row.availability}
                onDrain={handleDrain}
                onActivate={handleActivate}
                onDelete={row.role !== 'manager' ? handleDelete : undefined}
              />
            </div>
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

  if (tab === 'labels') {
    return (
      <NodeLabelsTab
        nodeId={row.id}
        initialLabels={row.labels || {}}
        onSaved={() => onRefresh?.()}
      />
    );
  }

  if (tab === 'logs') {
    return <NodeLogsTab nodeId={row.id} nodeName={row.hostname} />;
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
      if (!active) return;
      if (Array.isArray(data)) {
        setNodes(data);
      } else {
        refresh();
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
      createPlatform="swarm"
      createKind="node"
      tableTestId="swarm-nodes-table"
      getRowActions={(row) => {
        const availability = String(row?.availability || '').toLowerCase();
        const role = String(row?.role || '').toLowerCase();
        const isLeader = Boolean(row?.leader);

        return [
          {
            label: 'Drain',
            icon: '🚧',
            disabled: availability === 'drain',
            onClick: async () => {
              if (availability === 'drain') return;
              try {
                await UpdateSwarmNodeAvailability(row.id, 'drain');
                showSuccess(`Node ${row.hostname} set to drain`);
                refresh();
              } catch (err) {
                showError(`Failed to drain node: ${err}`);
              }
            },
          },
          {
            label: 'Activate',
            icon: '✅',
            disabled: availability === 'active',
            onClick: async () => {
              if (availability === 'active') return;
              try {
                await UpdateSwarmNodeAvailability(row.id, 'active');
                showSuccess(`Node ${row.hostname} activated`);
                refresh();
              } catch (err) {
                showError(`Failed to activate node: ${err}`);
              }
            },
          },
          {
            label: 'Promote…',
            icon: '⬆️',
            disabled: role !== 'worker',
            onClick: async () => {
              if (role !== 'worker') return;
              if (!window.confirm(`Promote node "${row.hostname}" to manager?`)) return;
              try {
                await UpdateSwarmNodeRole(row.id, 'manager');
                showSuccess(`Node ${row.hostname} promoted to manager`);
                refresh();
              } catch (err) {
                showError(`Failed to promote node: ${err}`);
              }
            },
          },
          {
            label: 'Demote…',
            icon: '⬇️',
            disabled: role !== 'manager' || isLeader,
            onClick: async () => {
              if (role !== 'manager') return;
              if (isLeader) {
                showError('Cannot demote the current leader node');
                return;
              }
              if (!window.confirm(`Demote node "${row.hostname}" to worker?`)) return;
              try {
                await UpdateSwarmNodeRole(row.id, 'worker');
                showSuccess(`Node ${row.hostname} demoted to worker`);
                refresh();
              } catch (err) {
                showError(`Failed to demote node: ${err}`);
              }
            },
          },
          {
            label: 'Remove',
            icon: '🗑️',
            danger: true,
            disabled: role === 'manager',
            onClick: async () => {
              if (role === 'manager') return;
              if (!window.confirm(`Remove node "${row.hostname}" from the swarm?`)) return;
              try {
                await RemoveSwarmNode(row.id, false);
                showSuccess(`Node ${row.hostname} removed`);
                refresh();
              } catch (err) {
                showError(`Failed to remove node: ${err}`);
              }
            },
          },
        ];
      }}
    />
  );
}
