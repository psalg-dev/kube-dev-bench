import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { useHolmesAnalysis } from '../../../hooks/useHolmesAnalysis';
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
    return <StatusBadge status={avail || '-'} size="small" />;
  }},
  { key: 'state', label: 'State', cell: ({ getValue }) => {
    const state = getValue();
    return <StatusBadge status={state || '-'} size="small" />;
  }},
  { key: 'address', label: 'Address' },
  { key: 'engineVersion', label: 'Engine' },
  { key: 'leader', label: 'Leader', cell: ({ getValue }) => {
    return getValue() ? '✓' : '';
  }},
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
  const running = withContainer.find((t) => String(t.state || '').toLowerCase() === 'running');
  return running || withContainer[0] || null;
}

function NodeLogsPreview({ nodeId }) {
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingTasks(true);
    setTasksError('');

    (async () => {
      try {
        const data = await GetSwarmNodeTasks(nodeId);
        if (!active) return;
        setTasks(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!active) return;
        setTasks([]);
        setTasksError(e?.message || String(e));
      } finally {
        if (active) setLoadingTasks(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [nodeId]);

  const selectedTask = useMemo(() => pickBestTask(tasks), [tasks]);

  if (loadingTasks) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
        Loading node logs...
      </div>
    );
  }

  if (tasksError) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
        Unable to load node logs: {tasksError}
      </div>
    );
  }

  if (!selectedTask) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
        No tasks with containers running on this node.
      </div>
    );
  }

  const title = `Node Logs (task: ${selectedTask.serviceName || selectedTask.serviceId?.slice(0, 12) || 'service'})`;

  return (
    <AggregateLogsTab
      title={title}
      reloadKey={`${nodeId}:${selectedTask.id}`}
      loadLogs={() => GetSwarmTaskLogs(selectedTask.id, '100')}
    />
  );
}

function NodeJoinInfoPanel({ role }) {
  const [joinTokens, setJoinTokens] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const data = await GetSwarmJoinTokens();
        if (!active) return;
        setJoinTokens(data);
      } catch (e) {
        if (!active) return;
        setError(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (error || !joinTokens?.addr) {
    return null; // Hide panel if there's an error or no data
  }

  const panelStyle = {
    width: 280,
    minWidth: 200,
    borderLeft: '1px solid var(--gh-border, #30363d)',
    padding: 12,
    background: 'var(--gh-canvas-subtle, #161b22)',
    overflow: 'auto',
  };

  const sectionStyle = {
    marginBottom: 16,
  };

  const labelStyle = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--gh-text-secondary, #8b949e)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const commandStyle = {
    background: 'var(--gh-bg, #0d1117)',
    border: '1px solid var(--gh-border, #30363d)',
    borderRadius: 4,
    padding: 8,
    fontSize: 11,
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    color: 'var(--gh-text, #c9d1d9)',
    position: 'relative',
  };

  const copyBtnStyle = {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: '2px 6px',
    fontSize: 10,
    background: 'var(--gh-button-bg, #21262d)',
    border: '1px solid var(--gh-border, #30363d)',
    borderRadius: 4,
    color: 'var(--gh-text, #c9d1d9)',
    cursor: 'pointer',
  };

  // Only managers can access join tokens; if viewing a worker, show limited info
  const isManager = role === 'manager';

  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--gh-text, #c9d1d9)' }}>
        {isManager ? 'Join Commands' : 'Add Nodes'}
      </div>

      {joinTokens.commands?.worker && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Add Worker Node</div>
          <div style={commandStyle}>
            <div style={{ paddingRight: 40 }}>{joinTokens.commands.worker}</div>
            <button
              style={copyBtnStyle}
              onClick={() => handleCopy(joinTokens.commands.worker, 'worker')}
            >
              {copied === 'worker' ? '✓' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {isManager && joinTokens.commands?.manager && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Add Manager Node</div>
          <div style={commandStyle}>
            <div style={{ paddingRight: 40 }}>{joinTokens.commands.manager}</div>
            <button
              style={copyBtnStyle}
              onClick={() => handleCopy(joinTokens.commands.manager, 'manager')}
            >
              {copied === 'manager' ? '✓' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--gh-text-secondary, #8b949e)', marginTop: 8 }}>
        {isManager
          ? 'Run these commands on new nodes to join the swarm.'
          : 'Run this command on new nodes to add them as workers. Manager join commands are available when viewing a manager node.'}
      </div>
    </div>
  );
}

function renderPanelContent(row, tab, onRefresh, holmesState, onAnalyze, onCancel) {
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
        type: 'status',
        layout: 'flex',
        rightField: { key: 'state', label: 'State', type: 'status' }
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
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <NodeLogsPreview nodeId={row.id} />
            </div>
          </div>
          <NodeJoinInfoPanel role={row.role} />
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

  if (tab === 'holmes') {
    const key = row.id;
    return (
      <HolmesBottomPanel
        resourceType="Swarm Node"
        resourceName={row.hostname}
        onAnalyze={() => onAnalyze?.(row)}
        onCancel={holmesState.key === key && holmesState.streamId ? onCancel : null}
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

export default function SwarmNodesOverviewTable() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { state: holmesState, analyze: analyzeWithHolmes, cancel: cancelHolmesAnalysis } = useHolmesAnalysis({
    kind: 'SwarmNode',
    analyzeFn: AnalyzeSwarmNodeStream,
  });

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const fetchTabCountsForRow = useCallback(async (row) => {
    if (!row?.id) return {};
    const tasks = await GetSwarmNodeTasks(row.id);
    return {
      tasks: Array.isArray(tasks) ? tasks.length : 0,
    };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, refresh, holmesState, analyzeWithHolmes, cancelHolmesAnalysis)}
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
