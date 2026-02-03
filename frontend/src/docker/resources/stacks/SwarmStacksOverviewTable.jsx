import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime';
import { useSwarmState } from '../../SwarmStateContext.jsx';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import StackServicesTab from './StackServicesTab.jsx';
import StackResourcesTab from './StackResourcesTab.jsx';
import StackComposeTab from './StackComposeTab.jsx';
import UpdateStackModal from './UpdateStackModal.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';
import { AnalyzeSwarmStackStream, CancelHolmesStream, onHolmesChatStream, onHolmesContextProgress } from '../../../holmes/holmesApi';
import { CreateSwarmStack, GetSwarmStackComposeYAML, GetSwarmStackResources, GetSwarmStackServices, GetSwarmStacks, RemoveSwarmStack, RollbackSwarmStack } from '../../swarmApi.js';
import { showSuccess, showError } from '../../../notification.js';
import { navigateToResource } from '../../../utils/resourceNavigation';
import StatusBadge from '../../../components/StatusBadge.jsx';
import './StackServicesTab.css';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../../utils/tableSorting.js';

export { default } from './SwarmStacksOverviewTableGeneric.jsx';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'services', label: 'Services' },
  { key: 'orchestrator', label: 'Orchestrator' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'services', label: 'Services', countKey: 'services' },
  { key: 'networks', label: 'Networks', countKey: 'networks' },
  { key: 'volumes', label: 'Volumes', countKey: 'volumes' },
  { key: 'configs', label: 'Configs', countKey: 'configs' },
  { key: 'secrets', label: 'Secrets', countKey: 'secrets' },
  { key: 'compose', label: 'Compose File', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

function StackSummaryPanel({ row, onRefresh }) {
  const [showUpdate, setShowUpdate] = useState(false);
  const [compose, setCompose] = useState('');
  const [loadingCompose, setLoadingCompose] = useState(false);
  const [health, setHealth] = useState({ healthy: 0, unhealthy: 0, total: 0 });
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [resourceCounts, setResourceCounts] = useState({ networks: 0, volumes: 0, configs: 0, secrets: 0 });
  const [hoveredService, setHoveredService] = useState(null);
  const initialLoadDoneRef = useRef(false);

  const summaryColumns = useMemo(() => ([
    { key: 'name', label: 'Name' },
    { key: 'image', label: 'Image' },
    { key: 'mode', label: 'Mode' },
    { key: 'replicas', label: 'Replicas' },
  ]), []);
  const defaultSummarySortKey = useMemo(() => pickDefaultSortKey(summaryColumns), [summaryColumns]);
  const [summarySortState, setSummarySortState] = useState(() => ({ key: defaultSummarySortKey, direction: 'asc' }));
  const sortedSummaryServices = useMemo(() => {
    return sortRows(services, summarySortState.key, summarySortState.direction, (svc, key) => {
      if (key === 'name') return svc?.name?.replace(`${row.name}_`, '') || svc?.name || '';
      if (key === 'replicas') return Number(svc?.replicas || 0);
      return svc?.[key];
    });
  }, [services, summarySortState, row.name]);

  const headerButtonStyle = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    font: 'inherit',
    padding: 0,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    textAlign: 'left',
  };

  const handleServiceClick = (svc) => {
    if (svc.name) {
      navigateToResource({ resource: 'SwarmService', name: svc.name });
    }
  };

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

  const downloadTextFile = (filename, content) => {
    const blob = new Blob([content ?? ''], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const loadCompose = async () => {
    setLoadingCompose(true);
    try {
      const y = await GetSwarmStackComposeYAML(row.name);
      setCompose(y || '');
      return y || '';
    } finally {
      setLoadingCompose(false);
    }
  };

  useEffect(() => {
    let active = true;
    initialLoadDoneRef.current = false;
    setLoadingServices(true);

    const loadHealth = async () => {
      try {
        const svcs = await GetSwarmStackServices(row.name);
        if (!active) return;
        const list = Array.isArray(svcs) ? svcs : [];
        setServices(list);
        let healthy = 0;
        let unhealthy = 0;
        for (const s of list) {
          if (s.mode === 'replicated') {
            if (Number(s.runningTasks) === Number(s.replicas)) healthy++; else unhealthy++;
          } else {
            if (Number(s.runningTasks) > 0) healthy++; else unhealthy++;
          }
        }
        setHealth({ healthy, unhealthy, total: list.length });
      } catch {
        if (active) {
          setHealth({ healthy: 0, unhealthy: 0, total: 0 });
          setServices([]);
        }
      } finally {
        if (active && !initialLoadDoneRef.current) {
          initialLoadDoneRef.current = true;
          setLoadingServices(false);
        }
      }
    };

    loadHealth();
    const interval = setInterval(loadHealth, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [row.name]);

  // Fetch resource counts
  useEffect(() => {
    let active = true;
    const loadResourceCounts = async () => {
      try {
        const res = await GetSwarmStackResources(row.name);
        if (!active) return;
        setResourceCounts({
          networks: Array.isArray(res?.networks) ? res.networks.length : 0,
          volumes: Array.isArray(res?.volumes) ? res.volumes.length : 0,
          configs: Array.isArray(res?.configs) ? res.configs.length : 0,
          secrets: Array.isArray(res?.secrets) ? res.secrets.length : 0,
        });
      } catch {
        if (active) setResourceCounts({ networks: 0, volumes: 0, configs: 0, secrets: 0 });
      }
    };

    loadResourceCounts();
    return () => {
      active = false;
    };
  }, [row.name]);

  const handleDelete = async () => {
      try {
        await RemoveSwarmStack(row.name);
        showSuccess(`Removed stack "${row.name}"`);
        onRefresh?.();
      } catch (err) {
        showError(`Failed to remove stack: ${err}`);
      }
  };

  const handleExport = async () => {
    try {
      const y = compose || (await loadCompose());
      downloadTextFile(`${row.name}.docker-compose.yml`, y || '');
      showSuccess(`Exported stack "${row.name}" compose`);
    } catch (err) {
      showError(`Failed to export compose: ${err}`);
    }
  };

  const handleOpenUpdate = async () => {
    try {
      const y = compose || (await loadCompose());
      setCompose(y || '');
      setShowUpdate(true);
    } catch (err) {
      showError(`Failed to load compose: ${err}`);
    }
  };

  const handleRedeploy = async (yaml) => {
    try {
      await CreateSwarmStack(row.name, yaml);
      showSuccess(`Updated stack "${row.name}"`);
      setShowUpdate(false);
      onRefresh?.();
    } catch (err) {
      showError(`Failed to update stack: ${err}`);
    }
  };

  const handleRollback = async () => {
    if (!window.confirm(`Rollback stack "${row.name}"? This will attempt to rollback each service in the stack.`)) return;
    try {
      await RollbackSwarmStack(row.name);
      showSuccess(`Rollback triggered for stack "${row.name}"`);
      onRefresh?.();
    } catch (err) {
      showError(`Failed to rollback stack: ${err}`);
    }
  };

    const quickInfoFields = [
      { key: 'name', label: 'Stack Name' },
      { 
        key: 'healthStatus', 
        label: 'Health Status',
        getValue: () => {
          if (health.total === 0) return 'No services';
          if (health.unhealthy === 0) return `All ${health.total} services healthy`;
          return `${health.healthy}/${health.total} healthy`;
        },
        render: (value) => {
          const isHealthy = health.unhealthy === 0 && health.total > 0;
          return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <StatusBadge status={isHealthy ? 'healthy' : 'unhealthy'} size="small" showDot={false} />
        <span>{value}</span>
        </div>
          );
        }
      },
      { 
        key: 'services', 
        label: 'Services',
        layout: 'flex',
        rightField: { key: 'orchestrator', label: 'Orchestrator' }
      },
      { 
        key: 'networks', 
        label: 'Networks', 
        getValue: () => resourceCounts.networks,
        layout: 'flex',
        rightField: { key: 'volumes', label: 'Volumes', getValue: () => resourceCounts.volumes }
      },
      { 
        key: 'configs', 
        label: 'Configs', 
        getValue: () => resourceCounts.configs,
        layout: 'flex',
        rightField: { key: 'secrets', label: 'Secrets', getValue: () => resourceCounts.secrets }
      },
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          actions={(
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                id="swarm-stack-update-btn"
                style={buttonStyle}
                onClick={handleOpenUpdate}
                disabled={loadingCompose}
              >
                {loadingCompose ? 'Loading...' : 'Update'}
              </button>
              <button
                id="swarm-stack-export-btn"
                style={buttonStyle}
                onClick={handleExport}
                disabled={loadingCompose}
              >
                Export
              </button>
              <button
                id="swarm-stack-rollback-btn"
                style={buttonStyle}
                onClick={handleRollback}
              >
                Rollback
              </button>
              <SwarmResourceActions
                resourceType="stack"
                name={row.name}
                onDelete={handleDelete}
              />
            </div>
          )}
        />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          <div style={{ flex: 1, minWidth: 0, borderLeft: '1px solid var(--gh-border, #30363d)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ 
              height: 44,
              padding: '0 12px', 
              fontWeight: 600, 
              color: '#d4d4d4', 
              borderBottom: '1px solid #30363d',
              background: '#161b22',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}>
              Services Overview
            </div>
            <div className="stack-services-container" style={{ position: 'relative', padding: 0 }}>
              {loadingServices ? (
                <div className="stack-services-loading">Loading services...</div>
              ) : services.length === 0 ? (
                <div className="stack-services-loading">No services in this stack</div>
              ) : (
                <table className="stack-services-table">
                  <thead>
                    <tr>
                      <th aria-sort={summarySortState.key === 'name' ? (summarySortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" style={headerButtonStyle} onClick={() => setSummarySortState((cur) => toggleSortState(cur, 'name'))}>
                          <span>Name</span>
                          <span aria-hidden="true">{summarySortState.key === 'name' ? (summarySortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th aria-sort={summarySortState.key === 'image' ? (summarySortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" style={headerButtonStyle} onClick={() => setSummarySortState((cur) => toggleSortState(cur, 'image'))}>
                          <span>Image</span>
                          <span aria-hidden="true">{summarySortState.key === 'image' ? (summarySortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th aria-sort={summarySortState.key === 'mode' ? (summarySortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" style={headerButtonStyle} onClick={() => setSummarySortState((cur) => toggleSortState(cur, 'mode'))}>
                          <span>Mode</span>
                          <span aria-hidden="true">{summarySortState.key === 'mode' ? (summarySortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th aria-sort={summarySortState.key === 'replicas' ? (summarySortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" style={headerButtonStyle} onClick={() => setSummarySortState((cur) => toggleSortState(cur, 'replicas'))}>
                          <span>Replicas</span>
                          <span aria-hidden="true">{summarySortState.key === 'replicas' ? (summarySortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSummaryServices.map((svc) => {
                      const isHovered = hoveredService === svc.id;
                      return (
                        <tr
                          key={svc.id}
                          onClick={() => handleServiceClick(svc)}
                          onMouseEnter={() => setHoveredService(svc.id)}
                          onMouseLeave={() => setHoveredService(null)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleServiceClick(svc); }}
                          role="button"
                          tabIndex={0}
                          title={`Open service: ${svc.name}`}
                          style={{
                            cursor: 'pointer',
                            background: isHovered ? 'var(--gh-row-hover, rgba(88, 166, 255, 0.1))' : undefined,
                          }}
                        >
                          <td style={{ color: isHovered ? 'var(--gh-link, #58a6ff)' : undefined }}>
                            {svc.name?.replace(`${row.name}_`, '') || svc.name}
                          </td>
                          <td className="mono">{svc.image}</td>
                          <td>{svc.mode}</td>
                          <td>
                            <span className={Number(svc.runningTasks) === Number(svc.replicas) ? 'replica-ok' : 'replica-warn'}>
                              {svc.runningTasks}/{svc.replicas}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <UpdateStackModal
          open={showUpdate}
          stackName={row.name}
          initialComposeYAML={compose}
          onClose={() => setShowUpdate(false)}
          onConfirm={handleRedeploy}
        />
      </div>
    );
}

function renderPanelContent(row, tab, onRefresh, holmesState, onAnalyze, onCancel) {
  if (tab === 'summary') {
    return <StackSummaryPanel row={row} onRefresh={onRefresh} />;
  }

  if (tab === 'services') {
    return <StackServicesTab stackName={row.name} />;
  }

  if (tab === 'networks') {
    return <StackResourcesTab stackName={row.name} resource="networks" />;
  }
  if (tab === 'volumes') {
    return <StackResourcesTab stackName={row.name} resource="volumes" />;
  }
  if (tab === 'configs') {
    return <StackResourcesTab stackName={row.name} resource="configs" />;
  }
  if (tab === 'secrets') {
    return <StackResourcesTab stackName={row.name} resource="secrets" />;
  }
  if (tab === 'compose') {
    return <StackComposeTab stackName={row.name} />;
  }
  if (tab === 'holmes') {
    const key = `swarm/${row.name}`;
    return (
      <HolmesBottomPanel
        resourceType="Swarm Stack"
        resourceName={row.name}
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

function SwarmStacksOverviewTableLegacy() {
  const swarm = useSwarmState();
  const connected = swarm?.connected;
  const [stacks, setStacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
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
  const holmesStateRef = useRef(holmesState);
  useEffect(() => {
    holmesStateRef.current = holmesState;
  }, [holmesState]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const fetchTabCountsForRow = useCallback(async (row) => {
    if (!row?.name) return {};
    const [services, resources] = await Promise.all([
      GetSwarmStackServices(row.name),
      GetSwarmStackResources(row.name),
    ]);
    const res = resources || {};
    return {
      services: Array.isArray(services) ? services.length : 0,
      networks: Array.isArray(res.networks) ? res.networks.length : 0,
      volumes: Array.isArray(res.volumes) ? res.volumes.length : 0,
      configs: Array.isArray(res.configs) ? res.configs.length : 0,
      secrets: Array.isArray(res.secrets) ? res.secrets.length : 0,
    };
  }, []);

  useEffect(() => {
    if (!connected) {
      setStacks([]);
      setLoading(false);
      return;
    }

    let active = true;

    const loadStacks = async () => {
      try {
        const data = await GetSwarmStacks();
        if (active) {
          setStacks(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load stacks:', err);
        if (active) {
          setStacks([]);
          setLoading(false);
        }
      }
    };

    loadStacks();

    const off = EventsOn('swarm:stacks:update', (data) => {
      if (!active) return;
      if (Array.isArray(data)) {
        setStacks(data);
      } else {
        refresh();
      }
    });

    return () => {
      active = false;
      if (typeof off === 'function') off();
    };
  }, [connected, refreshKey, refresh]);

  // Holmes streaming handler
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
      if (!payload.data) return;

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

  // Holmes context progress handler
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

  if (!connected) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
        Not connected to Docker Swarm
      </div>
    );
  }

  if (loading) {
    return <div className="main-panel-loading">Loading Swarm stacks...</div>;
  }

  const analyzeWithHolmes = async (stack) => {
    const key = stack?.name;
    if (!key) return;
    const streamId = `swarm-stack-${Date.now()}`;
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
      await AnalyzeSwarmStackStream(stack.name, streamId);
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
      title="Swarm Stacks"
      columns={columns}
      data={stacks}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, refresh, holmesState, analyzeWithHolmes, cancelHolmesAnalysis)}
      tabCountsFetcher={fetchTabCountsForRow}
      createPlatform="swarm"
      createKind="stack"
      createButtonTitle="Deploy stack (Compose YAML)"
      tableTestId="swarm-stacks-table"
      getRowActions={(row) => ([
        {
          label: 'Delete',
          icon: '🗑️',
          danger: true,
          onClick: async () => {
            if (!window.confirm(`Delete stack "${row.name}"?`)) return;
            try {
              await RemoveSwarmStack(row.name);
              showSuccess(`Removed stack "${row.name}"`);
              refresh();
            } catch (err) {
              showError(`Failed to remove stack: ${err}`);
            }
          },
        },
      ])}
    />
  );
}
