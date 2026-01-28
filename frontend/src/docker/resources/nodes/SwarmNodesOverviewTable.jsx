import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import StatusBadge from '../../../components/StatusBadge.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import AggregateLogsTab from '../../../components/AggregateLogsTab.jsx';
import NodeTasksTab from './NodeTasksTab.jsx';
import NodeLabelsTab from './NodeLabelsTab.jsx';
import NodeLogsTab from './NodeLogsTab.jsx';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';
import { AnalyzeSwarmNodeStream } from '../../../holmes/holmesApi';
import useHolmesStream from '../../../holmes/useHolmesStream';
import {
  GetSwarmNodes,
  GetSwarmNodeTasks,
  GetSwarmTaskLogs,
  GetSwarmJoinTokens,
  UpdateSwarmNodeAvailability,
  UpdateSwarmNodeRole,
  RemoveSwarmNode,
} from '../../swarmApi.js';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import { showSuccess, showError } from '../../../notification.js';

const columns = [
  { key: 'hostname', label: 'Hostname' },
  {
    key: 'role',
    label: 'Role',
    cell: ({ getValue }) => {
      const role = getValue();
      const isManager = role === 'manager';
      return (
        <span
          style={{
            color: isManager ? '#58a6ff' : 'inherit',
            fontWeight: isManager ? 500 : 400,
          }}
        >
          {role}
        </span>
      );
    },
  },
  {
    key: 'availability',
    label: 'Availability',
    cell: ({ getValue }) => {
      const avail = getValue();
      return <StatusBadge status={avail || '-'} size="small" />;
    },
  },
  {
    key: 'state',
    label: 'State',
    cell: ({ getValue }) => {
      const state = getValue();
      return <StatusBadge status={state || '-'} size="small" />;
    },
  },
  { key: 'address', label: 'Address' },
  { key: 'engineVersion', label: 'Engine' },
  {
    key: 'leader',
    label: 'Leader',
    cell: ({ getValue }) => {
      return getValue() ? '✓' : '';
    },
  },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'tasks', label: 'Tasks', countKey: 'tasks' },
  { key: 'logs', label: 'Logs', countable: false },
  { key: 'labels', label: 'Labels', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
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

function pickBestTask(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const withContainer = list.filter((t) => t?.id && t?.containerId);
  const running = withContainer.find(
    (t) => String(t.state || '').toLowerCase() === 'running',
  );
  return running || withContainer[0] || null;
}

function NodeSummaryPanel({ row, onRefresh }) {
  const availability = String(row?.availability || '').toLowerCase();
  const role = String(row?.role || '').toLowerCase();
  const isLeader = Boolean(row?.leader);

  const quickInfoFields = [
    { key: 'id', label: 'Node ID', type: 'break-word' },
    { key: 'hostname', label: 'Hostname' },
    {
      key: 'role',
      label: 'Role',
      layout: 'flex',
      rightField: {
        key: 'leader',
        label: 'Leader',
        getValue: (d) => (d.leader ? 'Yes' : 'No'),
      },
    },
    {
      key: 'availability',
      label: 'Availability',
      type: 'status',
      layout: 'flex',
      rightField: { key: 'state', label: 'State', type: 'status' },
    },
    { key: 'address', label: 'Address' },
    { key: 'engineVersion', label: 'Docker Version' },
    {
      key: 'platform',
      label: 'Platform',
      getValue: (d) =>
        d.os || d.arch ? `${d.os || '?'} / ${d.arch || '?'}` : '-',
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
      quickInfoFields.push({
        key: 'tlsTrustRoot',
        label: 'TLS Trust Root',
        type: 'break-word',
        getValue: (d) => d.tls?.trustRoot,
      });
    }
    if (row.tls.issuerSubject) {
      quickInfoFields.push({
        key: 'tlsIssuerSubject',
        label: 'TLS Issuer Subject (base64)',
        type: 'break-word',
        getValue: (d) => d.tls?.issuerSubject,
      });
    }
    if (row.tls.issuerPublicKey) {
      quickInfoFields.push({
        key: 'tlsIssuerPublicKey',
        label: 'TLS Issuer Public Key (base64)',
        type: 'break-word',
        getValue: (d) => d.tls?.issuerPublicKey,
      });
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

  const handlePromote = async () => {
    if (role !== 'worker') return;
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
    if (role !== 'manager') return;
    if (isLeader) {
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

  const handleDrain = async () => {
    if (availability === 'drain') return;
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
    if (role === 'manager') return;
    if (!window.confirm(`Remove node "${row.hostname}" from the swarm?`))
      return;
    try {
      await RemoveSwarmNode(row.id, false);
      showSuccess(`Node ${row.hostname} removed`);
      onRefresh?.();
    } catch (err) {
      showError(`Failed to remove node: ${err}`);
    }
  };

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
        name={row.hostname}
        labels={row.labels}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {role === 'worker' ? (
              <button
                style={buttonStyle}
                onClick={handlePromote}
                disabled={role !== 'worker'}
              >
                Promote
              </button>
            ) : (
              <button
                style={buttonStyle}
                onClick={handleDemote}
                disabled={role !== 'manager' || isLeader}
              >
                Demote
              </button>
            )}
            <SwarmResourceActions
              resourceType="node"
              name={row.hostname}
              onDrain={handleDrain}
              onActivate={handleActivate}
              onDelete={handleDelete}
            />
          </div>
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
          resourceName={row.hostname}
          data={row}
          loading={false}
          error={null}
          fields={quickInfoFields}
        />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            padding: 16,
            color: 'var(--gh-text-secondary, #8b949e)',
          }}
        >
          Use the actions above to manage node availability and role.
        </div>
      </div>
    </div>
  );
}

function renderPanelContent(
  row,
  tab,
  onRefresh,
  holmesState,
  onAnalyze,
  onCancel,
) {
  if (tab === 'summary') {
    return <NodeSummaryPanel row={row} onRefresh={onRefresh} />;
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

  if (tab === 'holmes') {
    const key = `swarm/${row.id}`;
    return (
      <HolmesBottomPanel
        resourceType="Swarm Node"
        resourceName={row.hostname}
        onAnalyze={() => onAnalyze?.(row)}
        onCancel={
          holmesState.key === key && holmesState.streamId ? onCancel : null
        }
        response={holmesState.key === key ? holmesState.response : null}
        loading={holmesState.key === key && holmesState.loading}
        error={holmesState.key === key ? holmesState.error : null}
        streamingText={holmesState.key === key ? holmesState.streamingText : ''}
        reasoningText={holmesState.key === key ? holmesState.reasoningText : ''}
        contextSteps={holmesState.key === key ? holmesState.contextSteps : []}
        toolEvents={holmesState.key === key ? holmesState.toolEvents : []}
        queryTimestamp={
          holmesState.key === key ? holmesState.queryTimestamp : null
        }
      />
    );
  }

  return null;
}

export default function SwarmNodesOverviewTable() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { holmesState, startAnalysis, cancelAnalysis } = useHolmesStream();
  const mountedRef = useRef(true);

  const loadNodes = useCallback(async () => {
    try {
      const data = await GetSwarmNodes();
      if (!mountedRef.current) return;
      setNodes(data || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load Swarm nodes:', err);
      if (!mountedRef.current) return;
      setNodes([]);
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    loadNodes();
  }, [loadNodes]);

  const fetchTabCountsForRow = useCallback(async (row) => {
    if (!row?.id) return {};
    const tasks = await GetSwarmNodeTasks(row.id);
    return {
      tasks: Array.isArray(tasks) ? tasks.length : 0,
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadNodes();

    const off = EventsOn('swarm:nodes:update', (data) => {
      if (!mountedRef.current) return;
      if (Array.isArray(data)) {
        setNodes(data);
      } else {
        loadNodes();
      }
    });

    return () => {
      mountedRef.current = false;
      if (typeof off === 'function') off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadNodes]);


  if (loading) {
    return <div className="main-panel-loading">Loading Swarm nodes...</div>;
  }

  const analyzeWithHolmes = async (node) => {
    const key = node?.id;
    if (!key) return;
    await startAnalysis({
      key: `swarm/${key}`,
      streamPrefix: 'swarm-node',
      run: (streamId) => AnalyzeSwarmNodeStream(node.id, streamId),
      onError: (message) => showError(`Holmes analysis failed: ${message}`),
    });
  };

  const cancelHolmesAnalysis = async () => {
    await cancelAnalysis();
  };

  return (
    <OverviewTableWithPanel
      title="Swarm Nodes"
      columns={columns}
      data={nodes}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) =>
        renderPanelContent(
          row,
          tab,
          refresh,
          holmesState,
          analyzeWithHolmes,
          cancelHolmesAnalysis,
        )
      }
      tabCountsFetcher={fetchTabCountsForRow}
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
              if (!window.confirm(`Promote node "${row.hostname}" to manager?`))
                return;
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
              if (!window.confirm(`Demote node "${row.hostname}" to worker?`))
                return;
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
              if (
                !window.confirm(`Remove node "${row.hostname}" from the swarm?`)
              )
                return;
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
