import { useCallback, useEffect, useMemo, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';
import { AnalyzeSwarmStackStream } from '../../../holmes/holmesApi';
import useHolmesStream from '../../../holmes/useHolmesStream';
import StackComposeTab from './StackComposeTab.jsx';
import StackResourcesTab from './StackResourcesTab.jsx';
import StackServicesTab from './StackServicesTab.jsx';
import UpdateStackModal from './UpdateStackModal.jsx';
import { useSwarmState } from '../../SwarmStateContext.jsx';
import {
  CreateSwarmStack,
  GetSwarmStackComposeYAML,
  GetSwarmStackResources,
  GetSwarmStackServices,
  GetSwarmStacks,
  RemoveSwarmStack,
} from '../../swarmApi.js';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import { showSuccess, showError } from '../../../notification.js';
import { navigateToResource } from '../../../utils/resourceNavigation';
import {
  pickDefaultSortKey,
  sortRows,
  toggleSortState,
} from '../../../utils/tableSorting.js';

const columns = [
  { key: 'name', label: 'Stack' },
  {
    key: 'services',
    label: 'Services',
    cell: ({ getValue }) => {
      const val = getValue();
      if (val == null) return '-';
      return String(val);
    },
  },
  { key: 'orchestrator', label: 'Orchestrator' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'services', label: 'Services', countKey: 'services' },
  { key: 'networks', label: 'Networks', countKey: 'networks' },
  { key: 'volumes', label: 'Volumes', countKey: 'volumes' },
  { key: 'configs', label: 'Configs', countKey: 'configs' },
  { key: 'secrets', label: 'Secrets', countKey: 'secrets' },
  { key: 'compose', label: 'Compose', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

function StackSummaryPanel({ row, onRefresh }) {
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState('');
  const [showUpdate, setShowUpdate] = useState(false);
  const [compose, setCompose] = useState('');
  const [composeLoading, setComposeLoading] = useState(false);
  const [hoveredService, setHoveredService] = useState(null);

  const quickInfoFields = [
    { key: 'name', label: 'Stack Name' },
    { key: 'services', label: 'Services' },
    { key: 'orchestrator', label: 'Orchestrator' },
  ];

  const loadCompose = useCallback(async () => {
    if (!row?.name || typeof GetSwarmStackComposeYAML !== 'function') return;
    setComposeLoading(true);
    try {
      const yml = await GetSwarmStackComposeYAML(row.name);
      setCompose(yml || '');
    } catch (err) {
      showError(`Failed to load stack compose: ${err}`);
      setCompose('');
    } finally {
      setComposeLoading(false);
    }
  }, [row?.name]);

  useEffect(() => {
    let active = true;
    if (!row?.name || typeof GetSwarmStackServices !== 'function') {
      setServices([]);
      setServicesLoading(false);
      return undefined;
    }

    const load = async () => {
      setServicesLoading(true);
      setServicesError('');
      try {
        const data = await GetSwarmStackServices(row.name);
        if (!active) return;
        setServices(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!active) return;
        setServices([]);
        setServicesError(err?.message || String(err));
      } finally {
        if (active) setServicesLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [row?.name]);

  const handleOpenUpdate = async () => {
    if (!compose) {
      await loadCompose();
    }
    setShowUpdate(true);
  };

  const handleRedeploy = async (yaml) => {
    if (!yaml) return;
    try {
      await CreateSwarmStack(row.name, yaml);
      showSuccess(`Redeployed stack "${row.name}"`);
      setShowUpdate(false);
      onRefresh?.();
    } catch (err) {
      showError(`Failed to redeploy stack: ${err}`);
    }
  };

  const serviceColumns = useMemo(
    () => [
      { key: 'name', label: 'Service' },
      { key: 'image', label: 'Image', breakWord: true },
      { key: 'mode', label: 'Mode' },
      { key: 'replicas', label: 'Replicas' },
    ],
    [],
  );
  const defaultSortKey = useMemo(
    () => pickDefaultSortKey(serviceColumns),
    [serviceColumns],
  );
  const [summarySortState, setSummarySortState] = useState(() => ({
    key: defaultSortKey,
    direction: 'asc',
  }));
  const sortedSummaryServices = useMemo(
    () =>
      sortRows(services, summarySortState.key, summarySortState.direction, (r, key) => {
        if (key === 'name') return r?.name || '';
        if (key === 'replicas') return Number(r?.replicas || 0);
        return r?.[key];
      }),
    [services, summarySortState],
  );

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

  const actionButtonStyle = {
    padding: '6px 12px',
    borderRadius: 4,
    border: '1px solid var(--gh-border, #30363d)',
    backgroundColor: 'var(--gh-button-bg, #21262d)',
    color: 'var(--gh-text, #c9d1d9)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  };

  const handleServiceClick = (svc) => {
    if (svc?.name) {
      navigateToResource({ resource: 'SwarmService', name: svc.name });
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
        name={row.name}
        actions={
          <button
            id="swarm-stack-update-btn"
            style={actionButtonStyle}
            onClick={handleOpenUpdate}
            disabled={composeLoading}
          >
            Update Stack
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
          resourceName={row.name}
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
            padding: 16,
            overflow: 'auto',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Services</div>
          {servicesLoading ? (
            <div style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>
              Loading services...
            </div>
          ) : servicesError ? (
            <div style={{ color: 'var(--gh-danger, #f85149)' }}>
              Failed to load services: {servicesError}
            </div>
          ) : services.length === 0 ? (
            <div style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>
              No services found for this stack.
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
              }}
            >
              <thead>
                <tr>
                  {serviceColumns.map((col) => (
                    <th
                      key={col.key}
                      aria-sort={
                        summarySortState.key === col.key
                          ? summarySortState.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      style={{
                        textAlign: 'left',
                        fontWeight: 600,
                        fontSize: 12,
                        color: 'var(--gh-text, #c9d1d9)',
                        borderBottom: '1px solid var(--gh-border, #30363d)',
                        padding: '8px 10px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <button
                        type="button"
                        style={headerButtonStyle}
                        onClick={() =>
                          setSummarySortState((cur) =>
                            toggleSortState(cur, col.key),
                          )
                        }
                      >
                        <span>{col.label}</span>
                        <span aria-hidden="true">
                          {summarySortState.key === col.key
                            ? summarySortState.direction === 'asc'
                              ? '▲'
                              : '▼'
                            : '↕'}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedSummaryServices.map((svc) => {
                  const isHovered = hoveredService === svc.id;
                  return (
                    <tr
                      key={svc.id || svc.name}
                      onClick={() => handleServiceClick(svc)}
                      onMouseEnter={() => setHoveredService(svc.id)}
                      onMouseLeave={() => setHoveredService(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ')
                          handleServiceClick(svc);
                      }}
                      role="button"
                      tabIndex={0}
                      title={`Open service: ${svc.name}`}
                      style={{
                        cursor: 'pointer',
                        background: isHovered
                          ? 'var(--gh-row-hover, rgba(88, 166, 255, 0.1))'
                          : undefined,
                      }}
                    >
                      <td
                        style={{
                          color: isHovered
                            ? 'var(--gh-link, #58a6ff)'
                            : undefined,
                          borderBottom: '1px solid var(--gh-border, #30363d)',
                          padding: '8px 10px',
                          fontSize: 12,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {svc.name?.replace(`${row.name}_`, '') || svc.name}
                      </td>
                      <td
                        className="mono"
                        style={{
                          borderBottom: '1px solid var(--gh-border, #30363d)',
                          padding: '8px 10px',
                          fontSize: 12,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {svc.image}
                      </td>
                      <td
                        style={{
                          borderBottom: '1px solid var(--gh-border, #30363d)',
                          padding: '8px 10px',
                          fontSize: 12,
                        }}
                      >
                        {svc.mode}
                      </td>
                      <td
                        style={{
                          borderBottom: '1px solid var(--gh-border, #30363d)',
                          padding: '8px 10px',
                          fontSize: 12,
                        }}
                      >
                        <span
                          className={
                            Number(svc.runningTasks) === Number(svc.replicas)
                              ? 'replica-ok'
                              : 'replica-warn'
                          }
                        >
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

function renderPanelContent(
  row,
  tab,
  onRefresh,
  holmesState,
  onAnalyze,
  onCancel,
) {
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

export default function SwarmStacksOverviewTable() {
  const swarm = useSwarmState();
  const connected = swarm?.connected;
  const [stacks, setStacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { holmesState, startAnalysis, cancelAnalysis } = useHolmesStream();

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

  if (!connected) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: 'center',
          color: 'var(--gh-text-secondary)',
        }}
      >
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
    await startAnalysis({
      key: `swarm/${key}`,
      streamPrefix: 'swarm-stack',
      run: (streamId) => AnalyzeSwarmStackStream(stack.name, streamId),
      onError: (message) => showError(`Holmes analysis failed: ${message}`),
    });
  };

  const cancelHolmesAnalysis = async () => {
    await cancelAnalysis();
  };

  return (
    <OverviewTableWithPanel
      title="Swarm Stacks"
      columns={columns}
      data={stacks}
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
      createKind="stack"
      createButtonTitle="Deploy stack (Compose YAML)"
      tableTestId="swarm-stacks-table"
      getRowActions={(row) => [
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
      ]}
    />
  );
}
