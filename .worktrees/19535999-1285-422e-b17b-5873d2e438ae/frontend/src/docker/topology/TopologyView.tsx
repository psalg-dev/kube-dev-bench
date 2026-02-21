/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import BottomPanel from '../../layout/bottompanel/BottomPanel';
import SummaryTabHeader from '../../layout/bottompanel/SummaryTabHeader';
import QuickInfoSection from '../../QuickInfoSection';
import AggregateLogsTab from '../../components/AggregateLogsTab';
import NodeTasksTab from '../resources/nodes/NodeTasksTab';
import NodeLabelsTab from '../resources/nodes/NodeLabelsTab';
import NodeLogsTab from '../resources/nodes/NodeLogsTab';
import ServiceTasksTab from '../resources/services/ServiceTasksTab';
import {
  GetClusterTopology,
  GetSwarmNode,
  GetSwarmService,
  GetSwarmServiceLogs,
} from '../swarmApi';
import './topology.css';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function nodeColorByState(state: string) {
  const s = String(state || '').toLowerCase();
  if (s === 'ready') return '#2ea44f';
  if (s === 'down') return '#ff7b72';
  return '#d29922';
}

function formatBytes(bytes: number) {
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

function formatNanoCPUs(nanoCpus: number) {
  const n = Number(nanoCpus);
  if (!Number.isFinite(n) || n <= 0) return '-';
  const cores = n / 1e9;
  const fixed = cores >= 10 ? 1 : 2;
  return `${cores.toFixed(fixed)} cores`;
}

function maskEnv(env: string) {
  const s = String(env || '');
  const idx = s.indexOf('=');
  if (idx === -1) return s;
  const key = s.slice(0, idx);
  const val = s.slice(idx + 1);
  if (!val) return `${key}=`;
  return `${key}=<hidden>`;
}

function formatMount(m: any) {
  if (!m) return '-';
  const type = m.type || 'mount';
  const src = m.source || '-';
  const tgt = m.target || '-';
  const ro = m.readOnly ? ' (ro)' : '';
  return `${type}:${src} -> ${tgt}${ro}`;
}

type TopologyData = {
  nodes?: any[];
  services?: any[];
  links?: any[];
  timestamp?: string;
};

type TopologyGraphNodeData = {
  kind: 'node' | 'service';
  row: any;
};

type PanelKind = 'node' | 'service' | null;

export default function TopologyView() {
  const [topo, setTopo] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshInFlight = useRef(false);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelKind, setPanelKind] = useState<PanelKind>(null); // 'node' | 'service'
  const [panelId, setPanelId] = useState('');
  const [panelRow, setPanelRow] = useState<any | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [panelActiveTab, setPanelActiveTab] = useState('summary');
  const [panelReloadKey, setPanelReloadKey] = useState(0);

  const refresh = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const t = await GetClusterTopology();
      setTopo((t as TopologyData) || null);
      setError('');
    } catch (e: any) {
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

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('.bottom-panel') ||
        target?.closest('[data-resizing]') ||
        document.body.style.cursor === 'ns-resize'
      ) {
        return;
      }
      closePanel();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
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
    } catch (e: any) {
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

  const openNodeDetails = useCallback((n: any) => {
    if (!n?.id) return;
    setPanelKind('node');
    setPanelId(n.id);
    setPanelActiveTab('summary');
    setPanelOpen(true);
    setPanelRow(null);
    setPanelReloadKey((k) => k + 1);
  }, []);

  const openServiceDetails = useCallback((s: any) => {
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

    const nodePos = new Map<string, { x: number; y: number }>();
    nodes.forEach((n: any, i: number) => {
      nodePos.set(n.id, { x: leftX, y: topPad + i * rowH });
    });

    const svcPos = new Map<string, { x: number; y: number }>();
    services.forEach((s: any, i: number) => {
      svcPos.set(s.id, { x: rightX, y: topPad + i * rowH });
    });

    const h = Math.max(260, topPad + Math.max(nodes.length, services.length) * rowH + 40);
    return { w, h, leftX, rightX, nodePos, svcPos };
  }, [nodes, services]);

  const linkMax = useMemo(() => {
    const ws = links.map((l: any) => Number(l?.weight ?? 0)).filter((x: number) => Number.isFinite(x));
    return ws.length ? Math.max(...ws) : 1;
  }, [links]);

  const graphNodes = useMemo<Node<TopologyGraphNodeData>[]>(() => {
    const out: Node<TopologyGraphNodeData>[] = [];

    nodes.forEach((n: any) => {
      const p = layout.nodePos.get(n.id);
      if (!p) return;
      const stateClass = String(n.state || '').toLowerCase();
      out.push({
        id: `node-${n.id}`,
        type: 'default',
        position: { x: p.x - 18, y: p.y - 14 },
        draggable: false,
        selectable: true,
        data: {
          kind: 'node',
          row: n,
          label: (
            <div className="topologyGraphLabel" data-testid="topology-graph-node">
              <div className="topologyGraphMain">
                <span className={`topologyGraphNodeDot topologyGraphNodeDot--${stateClass}`} />
                <span>{n.hostname || n.id}</span>
              </div>
              <div className="topologyGraphSub">{`${n.role || ''} • tasks: ${n.taskCount ?? 0}`}</div>
            </div>
          ),
        } as any,
      });
    });

    services.forEach((s: any) => {
      const p = layout.svcPos.get(s.id);
      if (!p) return;
      out.push({
        id: `service-${s.id}`,
        type: 'default',
        position: { x: p.x - 12, y: p.y - 14 },
        draggable: false,
        selectable: true,
        data: {
          kind: 'service',
          row: s,
          label: (
            <div className="topologyGraphLabel" data-testid="topology-graph-service">
              <div className="topologyGraphMain">
                <span className="topologyGraphServiceSquare" />
                <span>{s.name || s.id}</span>
              </div>
              <div className="topologyGraphSub">{`${s.mode || ''} • running: ${s.runningTasks ?? 0}`}</div>
            </div>
          ),
        } as any,
      });
    });

    return out;
  }, [nodes, services, layout]);

  const graphEdges = useMemo<Edge[]>(() => {
    return links.map((l: any) => {
      const w = clamp(Number(l.weight || 1), 1, linkMax);
      const strokeW = 1 + (w / linkMax) * 6;
      return {
        id: `${l.from}-${l.to}`,
        source: `service-${l.from}`,
        target: `node-${l.to}`,
        type: 'straight',
        style: {
          stroke: '#58a6ff',
          strokeOpacity: 0.55,
          strokeWidth: strokeW,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#58a6ff',
          width: 14,
          height: 14,
        },
      };
    });
  }, [links, linkMax]);

  const onGraphNodeClick = useCallback((_: unknown, rfNode: Node<TopologyGraphNodeData>) => {
    const row = rfNode?.data?.row;
    if (!row) return;
    if (rfNode?.data?.kind === 'node') {
      openNodeDetails(row);
      return;
    }
    if (rfNode?.data?.kind === 'service') {
      openServiceDetails(row);
    }
  }, [openNodeDetails, openServiceDetails]);

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
          rightField: { key: 'leader', label: 'Leader', getValue: (d: any) => d.leader ? 'Yes' : 'No' },
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
          getValue: (d: any) => (d.os || d.arch) ? `${d.os || '?'} / ${d.arch || '?'}` : '-',
        },
        {
          key: 'capacity',
          label: 'Capacity',
          layout: 'flex',
          getValue: (d: any) => formatNanoCPUs(d.nanoCpus),
          rightField: {
            key: 'memoryBytes',
            label: 'Memory',
            getValue: (d: any) => formatBytes(d.memoryBytes),
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
              fields={quickInfoFields as any}
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
          getValue: (d: any) => (Array.isArray(d.ports) ? d.ports : []).map(
            (p: any) => `${p.publishedPort}:${p.targetPort}/${p.protocol}${p.publishMode ? ` (${p.publishMode})` : ''}`
          ),
        },
        {
          key: 'env',
          label: 'Environment Variables',
          type: 'list',
          getValue: (d: any) => (Array.isArray(d.env) ? d.env : []).map(maskEnv),
        },
        {
          key: 'mounts',
          label: 'Mounts',
          type: 'list',
          getValue: (d: any) => (Array.isArray(d.mounts) ? d.mounts : []).map(formatMount),
        },
        {
          key: 'resources',
          label: 'Resources',
          type: 'list',
          getValue: (d: any) => {
            const r = d.resources;
            if (!r) return [];
            const out: string[] = [];
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
              fields={quickInfoFields as any}
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
        <div className="topologyCanvasHeader">
          <span>Nodes</span>
          <span>Services</span>
        </div>
        <div className="topologyFlowWrap" style={{ height: `${Math.max(280, layout.h + 16)}px` }}>
          <ReactFlow
            nodes={graphNodes}
            edges={graphEdges}
            onNodeClick={onGraphNodeClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.4}
            maxZoom={1.8}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            proOptions={{ hideAttribution: true }}
          >
            <Background color="rgba(110,118,129,0.18)" gap={18} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) => {
                if (n.data?.kind === 'service') return '#a371f7';
                return nodeColorByState((n.data?.row as any)?.state || '');
              }}
            />
          </ReactFlow>
        </div>
      </div>

      <div className="topologyLists">
        <div className="topologyList">
          <div className="topologyListTitle">Nodes</div>
          <div className="topologyListBody">
            {nodes.length ? nodes.map((n: any) => (
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
            {services.length ? services.map((s: any) => (
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

