import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomPanel from '../../layout/bottompanel/BottomPanel.jsx';
import SummaryTabHeader from '../../layout/bottompanel/SummaryTabHeader.jsx';
import QuickInfoSection from '../../QuickInfoSection.jsx';
import AggregateLogsTab from '../../components/AggregateLogsTab.jsx';
import NodeTasksTab from '../resources/nodes/NodeTasksTab.jsx';
import NodeLabelsTab from '../resources/nodes/NodeLabelsTab.jsx';
import NodeLogsTab from '../resources/nodes/NodeLogsTab.jsx';
import ServiceTasksTab from '../resources/services/ServiceTasksTab.jsx';
import {
  GetClusterTopology,
  GetSwarmNode,
  GetSwarmService,
  GetSwarmServiceLogs,
} from '../swarmApi.js';
import './topology.css';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function nodeColorByState(state) {
  const s = String(state || '').toLowerCase();
  if (s === 'ready') return '#2ea44f';
  if (s === 'down') return '#ff7b72';
  return '#d29922';
}

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

function maskEnv(env) {
  const s = String(env || '');
  const idx = s.indexOf('=');
  if (idx === -1) return s;
  const key = s.slice(0, idx);
  const val = s.slice(idx + 1);
  if (!val) return `${key}=`;
  return `${key}=<hidden>`;
}

function formatMount(m) {
  if (!m) return '-';
  const type = m.type || 'mount';
  const src = m.source || '-';
  const tgt = m.target || '-';
  const ro = m.readOnly ? ' (ro)' : '';
  return `${type}:${src} -> ${tgt}${ro}`;
}

export default function TopologyView() {
  const [topo, setTopo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshInFlight = useRef(false);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelKind, setPanelKind] = useState(null); // 'node' | 'service'
  const [panelId, setPanelId] = useState('');
  const [panelRow, setPanelRow] = useState(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [panelActiveTab, setPanelActiveTab] = useState('summary');
  const [panelReloadKey, setPanelReloadKey] = useState(0);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const t = await GetClusterTopology();
      setTopo(t || null);
      setError('');
    } catch (e) {
      // Keep existing topology on background refresh failures.
      if (!silent) setTopo(null);
      setError(e?.message || String(e || 'Failed to load topology'));
    } finally {
      if (!silent) setLoading(false);
      refreshInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    refresh({ silent: false });
  }, [refresh]);

  // Auto-refresh (best-effort) without flicker.
  useEffect(() => {
    const id = setInterval(() => {
      refresh({ silent: true });
    }, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setPanelKind(null);
    setPanelId('');
    setPanelRow(null);
    setPanelError('');
    setPanelActiveTab('summary');
  }, []);

  // Handle escape key and click-outside for bottom panel.
  useEffect(() => {
    if (!panelOpen) return;

    const handleClick = (e) => {
      if (
        e.target.closest('.bottom-panel') ||
        e.target.closest('[data-resizing]') ||
        document.body.style.cursor === 'ns-resize'
      ) {
        return;
      }
      closePanel();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closePanel();
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [panelOpen, closePanel]);

  const loadPanelRow = useCallback(async () => {
    if (!panelOpen || !panelKind || !panelId) return;
    setPanelLoading(true);
    setPanelError('');
    try {
      const data = panelKind === 'node'
        ? await GetSwarmNode(panelId)
        : await GetSwarmService(panelId);
      setPanelRow(data || null);
    } catch (e) {
      setPanelRow(null);
      setPanelError(e?.message || String(e || 'Failed to load details'));
    } finally {
      setPanelLoading(false);
    }
  }, [panelOpen, panelKind, panelId]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await loadPanelRow();
    })();
    return () => {
      active = false;
    };
  }, [loadPanelRow, panelReloadKey]);

  const openNodeDetails = useCallback((n) => {
    if (!n?.id) return;
    setPanelKind('node');
    setPanelId(n.id);
    setPanelActiveTab('summary');
    setPanelOpen(true);
    setPanelRow(null);
    setPanelReloadKey((k) => k + 1);
  }, []);

  const openServiceDetails = useCallback((s) => {
    if (!s?.id) return;
    setPanelKind('service');
    setPanelId(s.id);
    setPanelActiveTab('summary');
    setPanelOpen(true);
    setPanelRow(null);
    setPanelReloadKey((k) => k + 1);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nodes = topo?.nodes || [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const services = topo?.services || [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const links = topo?.links || [];

  const layout = useMemo(() => {
    const w = 980;
    const leftX = 140;
    const rightX = w - 180;
    const topPad = 40;
    const rowH = 46;

    const nodePos = new Map();
    nodes.forEach((n, i) => {
      nodePos.set(n.id, { x: leftX, y: topPad + i * rowH });
    });

    const svcPos = new Map();
    services.forEach((s, i) => {
      svcPos.set(s.id, { x: rightX, y: topPad + i * rowH });
    });

    const h = Math.max(260, topPad + Math.max(nodes.length, services.length) * rowH + 40);
    return { w, h, leftX, rightX, nodePos, svcPos };
  }, [nodes, services]);

  const linkMax = useMemo(() => {
    const ws = links.map((l) => Number(l?.weight ?? 0)).filter((x) => Number.isFinite(x));
    return ws.length ? Math.max(...ws) : 1;
  }, [links]);

  const panelTabs = useMemo(() => {
    if (panelKind === 'node') {
      return [
        { key: 'summary', label: 'Summary' },
        { key: 'tasks', label: 'Tasks' },
        { key: 'logs', label: 'Logs' },
        { key: 'labels', label: 'Labels' },
      ];
    }
    if (panelKind === 'service') {
      return [
        { key: 'summary', label: 'Summary' },
        { key: 'tasks', label: 'Tasks' },
        { key: 'logs', label: 'Logs' },
      ];
    }
    return [{ key: 'summary', label: 'Summary' }];
  }, [panelKind]);

  const renderPanelContent = useCallback(() => {
    if (!panelRow) return null;

    if (panelKind === 'node') {
      if (panelActiveTab === 'tasks') {
        return <NodeTasksTab nodeId={panelRow.id} nodeName={panelRow.hostname} />;
      }
      if (panelActiveTab === 'logs') {
        return <NodeLogsTab nodeId={panelRow.id} nodeName={panelRow.hostname} />;
      }
      if (panelActiveTab === 'labels') {
        return (
          <NodeLabelsTab
            nodeId={panelRow.id}
            initialLabels={panelRow.labels || {}}
            onSaved={() => setPanelReloadKey((k) => k + 1)}
          />
        );
      }

      const quickInfoFields = [
        { key: 'id', label: 'Node ID', type: 'break-word' },
        { key: 'hostname', label: 'Hostname' },
        {
          key: 'role',
          label: 'Role',
          layout: 'flex',
          rightField: { key: 'leader', label: 'Leader', getValue: (d) => d.leader ? 'Yes' : 'No' },
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

      return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SummaryTabHeader name={panelRow.hostname} labels={panelRow.labels} />
          <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
            <QuickInfoSection
              resourceName={panelRow.hostname}
              data={panelRow}
              loading={false}
              error={null}
              fields={quickInfoFields}
            />
          </div>
        </div>
      );
    }

    if (panelKind === 'service') {
      if (panelActiveTab === 'tasks') {
        return <ServiceTasksTab serviceId={panelRow.id} serviceName={panelRow.name} />;
      }
      if (panelActiveTab === 'logs') {
        return (
          <AggregateLogsTab
            title="Service Logs"
            reloadKey={panelRow.id}
            loadLogs={() => GetSwarmServiceLogs(panelRow.id, '500')}
          />
        );
      }

      const quickInfoFields = [
        {
          key: 'mode',
          label: 'Mode',
          layout: 'flex',
          rightField: { key: 'replicas', label: 'Replicas' },
        },
        {
          key: 'runningTasks',
          label: 'Running Tasks',
          layout: 'flex',
          rightField: { key: 'createdAt', label: 'Created', type: 'date' },
        },
        { key: 'image', label: 'Image', type: 'break-word' },
        {
          key: 'ports',
          label: 'Ports',
          type: 'list',
          getValue: (d) => (Array.isArray(d.ports) ? d.ports : []).map(
            (p) => `${p.publishedPort}:${p.targetPort}/${p.protocol}${p.publishMode ? ` (${p.publishMode})` : ''}`
          ),
        },
        {
          key: 'env',
          label: 'Environment Variables',
          type: 'list',
          getValue: (d) => (Array.isArray(d.env) ? d.env : []).map(maskEnv),
        },
        {
          key: 'mounts',
          label: 'Mounts',
          type: 'list',
          getValue: (d) => (Array.isArray(d.mounts) ? d.mounts : []).map(formatMount),
        },
        {
          key: 'resources',
          label: 'Resources',
          type: 'list',
          getValue: (d) => {
            const r = d.resources;
            if (!r) return [];
            const out = [];
            if (r.limits) {
              out.push(`limits.cpu: ${formatNanoCPUs(r.limits.nanoCpus)}`);
              out.push(`limits.mem: ${formatBytes(r.limits.memoryBytes)}`);
            }
            if (r.reservations) {
              out.push(`reservations.cpu: ${formatNanoCPUs(r.reservations.nanoCpus)}`);
              out.push(`reservations.mem: ${formatBytes(r.reservations.memoryBytes)}`);
            }
            return out;
          },
        },
      ];

      return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SummaryTabHeader name={panelRow.name} labels={panelRow.labels} />
          <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
            <QuickInfoSection
              resourceName={panelRow.name}
              data={panelRow}
              loading={false}
              error={null}
              fields={quickInfoFields}
            />
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
              <AggregateLogsTab
                title="Service Logs"
                reloadKey={panelRow.id}
                loadLogs={() => GetSwarmServiceLogs(panelRow.id, '200')}
              />
            </div>
          </div>
        </div>
      );
    }

    return null;
  }, [panelRow, panelKind, panelActiveTab]);

  return (
    <div className="topologyRoot" data-testid="swarm-topology-view">
      <div className="topologyHeader">
        <h2 style={{ margin: 0 }}>Cluster Topology</h2>
        <div className="topologyHeaderRight">
          <div className="topologyMeta">
            {topo?.timestamp ? `Updated: ${topo.timestamp}` : ''}
          </div>
          <button className="topologyBtn" type="button" onClick={() => refresh({ silent: false })} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? <div className="topologyError">{error}</div> : null}

      <div className="topologyCanvas">
        <svg width={layout.w} height={layout.h} viewBox={`0 0 ${layout.w} ${layout.h}`}>
          {/* Links */}
          {links.map((l) => {
            const from = layout.svcPos.get(l.from);
            const to = layout.nodePos.get(l.to);
            if (!from || !to) return null;
            const w = clamp(Number(l.weight || 1), 1, linkMax);
            const strokeW = 1 + (w / linkMax) * 6;
            return (
              <g key={`${l.from}-${l.to}`}>
                <line
                  x1={to.x + 60}
                  y1={to.y}
                  x2={from.x - 60}
                  y2={from.y}
                  stroke="#58a6ff"
                  strokeOpacity={0.55}
                  strokeWidth={strokeW}
                />
              </g>
            );
          })}

          {/* Node labels */}
          {nodes.map((n) => {
            const p = layout.nodePos.get(n.id);
            if (!p) return null;
            return (
              <g key={n.id}>
                <circle cx={p.x} cy={p.y} r={10} fill={nodeColorByState(n.state)} />
                <text x={p.x + 16} y={p.y + 4} fill="#c9d1d9" fontSize="12">
                  {n.hostname || n.id}
                </text>
                <text x={p.x + 16} y={p.y + 18} fill="#8b949e" fontSize="11">
                  {`${n.role || ''} • tasks: ${n.taskCount ?? 0}`}
                </text>
              </g>
            );
          })}

          {/* Service labels */}
          {services.map((s) => {
            const p = layout.svcPos.get(s.id);
            if (!p) return null;
            return (
              <g key={s.id}>
                <rect x={p.x - 14} y={p.y - 10} width={12} height={12} fill="#a371f7" />
                <text x={p.x} y={p.y + 4} fill="#c9d1d9" fontSize="12">
                  {s.name || s.id}
                </text>
                <text x={p.x} y={p.y + 18} fill="#8b949e" fontSize="11">
                  {`${s.mode || ''} • running: ${s.runningTasks ?? 0}`}
                </text>
              </g>
            );
          })}

          {/* Column headers */}
          <text x={layout.leftX} y={22} fill="#8b949e" fontSize="12">Nodes</text>
          <text x={layout.rightX} y={22} fill="#8b949e" fontSize="12">Services</text>
        </svg>
      </div>

      <div className="topologyLists">
        <div className="topologyList">
          <div className="topologyListTitle">Nodes</div>
          <div className="topologyListBody">
            {nodes.length ? nodes.map((n) => (
              <button
                key={n.id}
                type="button"
                className="topologyListItemBtn"
                data-testid="topology-node-item"
                onClick={() => openNodeDetails(n)}
              >
                <div className="topologyListItemMain">{n.hostname || n.id}</div>
                <div className="topologyListItemSub">{`${n.role || ''} • ${n.state || ''} • tasks: ${n.taskCount ?? 0}`}</div>
              </button>
            )) : (
              <div className="topologyEmpty">No nodes found.</div>
            )}
          </div>
        </div>

        <div className="topologyList">
          <div className="topologyListTitle">Services</div>
          <div className="topologyListBody">
            {services.length ? services.map((s) => (
              <button
                key={s.id}
                type="button"
                className="topologyListItemBtn"
                data-testid="topology-service-item"
                onClick={() => openServiceDetails(s)}
              >
                <div className="topologyListItemMain">{s.name || s.id}</div>
                <div className="topologyListItemSub">{`${s.mode || ''} • running: ${s.runningTasks ?? 0} • tasks: ${s.taskCount ?? 0}`}</div>
              </button>
            )) : (
              <div className="topologyEmpty">No services found.</div>
            )}
          </div>
        </div>
      </div>

      <div className="topologyFootnote">
        Links show running task placement (service → node). In multi-node Swarm, data reflects what the connected manager can observe.
      </div>

      <BottomPanel
        open={panelOpen}
        onClose={closePanel}
        tabs={panelTabs}
        activeTab={panelActiveTab}
        onTabChange={(id) => setPanelActiveTab(id)}
        headerRight={null}
      >
        {panelLoading ? (
          <div className="main-panel-loading">Loading details…</div>
        ) : panelError ? (
          <div className="topologyPanelError">{panelError}</div>
        ) : (
          renderPanelContent()
        )}
      </BottomPanel>
    </div>
  );
}
