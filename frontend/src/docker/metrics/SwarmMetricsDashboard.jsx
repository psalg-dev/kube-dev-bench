import { useCallback, useMemo, useState } from 'react';
import MetricsChart from './MetricsChart.jsx';
import {
  MetricsStateProvider,
  useClusterMetrics,
} from './MetricsStateContext.jsx';
import TimeRangeSelector from './TimeRangeSelector.jsx';
import { navigateToResource } from '../../utils/resourceNavigation';
import './SwarmMetricsDashboard.css';

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

function formatBytesPerSec(bytesPerSec) {
  const b = Number(bytesPerSec);
  if (!Number.isFinite(b) || b <= 0) return '-';
  return `${formatBytes(b)}/s`;
}

function formatNanoCPUs(nanoCpus) {
  const n = Number(nanoCpus);
  if (!Number.isFinite(n) || n <= 0) return '-';
  const cores = n / 1e9;
  const fixed = cores >= 10 ? 1 : 2;
  return `${cores.toFixed(fixed)} cores`;
}

function formatPercent(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return '-';
  const clamped = Math.max(0, Math.min(9999, n));
  const fixed = clamped >= 100 ? 0 : clamped >= 10 ? 1 : 2;
  return `${clamped.toFixed(fixed)}%`;
}

function Card({ title, value, sub }) {
  return (
    <div className="swarm-metrics-card">
      <div className="swarm-metrics-card__title">{title}</div>
      <div className="swarm-metrics-card__value">{value}</div>
      {sub ? <div className="swarm-metrics-card__sub">{sub}</div> : null}
    </div>
  );
}

function SwarmMetricsDashboardInner() {
  const { history, latest, services, nodes, loading, error, refetch } =
    useClusterMetrics();
  const [rangeSeconds, setRangeSeconds] = useState(900);
  const [hoveredService, setHoveredService] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  const handleServiceClick = (svc) => {
    const name = svc.serviceName || svc.serviceId;
    if (name) {
      navigateToResource({ resource: 'SwarmService', name });
    }
  };

  const handleNodeClick = (node) => {
    const name = node.hostname || node.nodeId;
    if (name) {
      navigateToResource({ resource: 'SwarmNode', name });
    }
  };

  const filteredHistory = useMemo(() => {
    const arr = Array.isArray(history) ? history : [];
    const seconds = Number(rangeSeconds) || 0;
    if (!seconds) return arr;
    const cutoff = Date.now() - seconds * 1000;
    return arr.filter((p) => {
      const ts = Date.parse(p?.timestamp);
      return Number.isFinite(ts) ? ts >= cutoff : true;
    });
  }, [history, rangeSeconds]);

  const percent = useCallback((num, den) => {
    const n = Number(num);
    const d = Number(den);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return 0;
    return (n / d) * 100;
  }, []);

  const rateHistory = useMemo(() => {
    const arr = Array.isArray(filteredHistory) ? filteredHistory : [];
    if (arr.length < 2) return [];

    const out = [];
    for (let i = 1; i < arr.length; i++) {
      const prev = arr[i - 1];
      const curr = arr[i];

      const t0 = Date.parse(prev?.timestamp);
      const t1 = Date.parse(curr?.timestamp);
      const dt =
        Number.isFinite(t0) && Number.isFinite(t1)
          ? Math.max(0, (t1 - t0) / 1000)
          : 0;
      const rx0 = Number(prev?.networkRxBytes ?? 0);
      const rx1 = Number(curr?.networkRxBytes ?? 0);
      const tx0 = Number(prev?.networkTxBytes ?? 0);
      const tx1 = Number(curr?.networkTxBytes ?? 0);

      const rxDelta =
        Number.isFinite(rx0) && Number.isFinite(rx1) ? rx1 - rx0 : 0;
      const txDelta =
        Number.isFinite(tx0) && Number.isFinite(tx1) ? tx1 - tx0 : 0;

      out.push({
        timestamp: curr?.timestamp,
        cpuUsagePercent: Number(curr?.cpuUsagePercent ?? 0),
        memoryUsedBytes: Number(curr?.memoryUsedBytes ?? 0),
        rxPerSec: dt > 0 && rxDelta > 0 ? rxDelta / dt : 0,
        txPerSec: dt > 0 && txDelta > 0 ? txDelta / dt : 0,
      });
    }
    return out;
  }, [filteredHistory]);

  const serviceTopCpu = useMemo(() => {
    const arr = Array.isArray(services) ? services : [];
    return [...arr]
      .filter(
        (s) => Number(s?.cpuPercent) > 0 || Number(s?.memoryUsedBytes) > 0,
      )
      .sort((a, b) => Number(b?.cpuPercent ?? 0) - Number(a?.cpuPercent ?? 0))
      .slice(0, 6);
  }, [services]);

  const nodeTopCpu = useMemo(() => {
    const arr = Array.isArray(nodes) ? nodes : [];
    return [...arr]
      .filter(
        (n) => Number(n?.cpuPercent) > 0 || Number(n?.memoryUsedBytes) > 0,
      )
      .sort((a, b) => Number(b?.cpuPercent ?? 0) - Number(a?.cpuPercent ?? 0))
      .slice(0, 6);
  }, [nodes]);

  return (
    <div
      className="swarm-metrics-dashboard"
      data-testid="swarm-metrics-dashboard"
    >
      <div className="swarm-metrics-dashboard__container">
        <div className="swarm-metrics-dashboard__header">
          <h2 className="swarm-metrics-dashboard__title">Swarm Metrics</h2>
          <div className="swarm-metrics-dashboard__meta">
            {latest?.timestamp
              ? `Last update: ${latest.timestamp}`
              : 'Waiting for first update…'}
          </div>
        </div>

        {loading || error ? (
          <div className="swarm-metrics-dashboard__status">
            <div
              className={
                error
                  ? 'swarm-metrics-dashboard__statusText swarm-metrics-dashboard__statusText--error'
                  : 'swarm-metrics-dashboard__statusText'
              }
            >
              {error ? `Metrics error: ${error}` : 'Loading metrics…'}
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="swarm-metrics-dashboard__button"
            >
              Refresh
            </button>
          </div>
        ) : null}

        <div className="swarm-metrics-dashboard__cards swarm-metrics-dashboard__cards--top">
          <Card
            title="CPU capacity"
            value={latest ? formatNanoCPUs(latest.cpuCapacityNano) : '-'}
          />
          <Card
            title="CPU usage"
            value={latest ? formatPercent(latest.cpuUsagePercent) : '-'}
            sub={latest ? `Containers: ${latest.runningContainers ?? 0}` : ''}
          />
          <Card
            title="Memory capacity"
            value={latest ? formatBytes(latest.memoryCapacityBytes) : '-'}
          />
          <Card
            title="Memory used"
            value={latest ? formatBytes(latest.memoryUsedBytes) : '-'}
          />
        </div>

        {serviceTopCpu.length || nodeTopCpu.length ? (
          <div className="swarm-metrics-dashboard__sectionGrid">
            <div className="swarm-metrics-panel">
              <div className="swarm-metrics-panel__title">
                Top services (CPU)
              </div>
              {serviceTopCpu.length ? (
                <table className="swarm-metrics-miniTable">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>CPU</th>
                      <th>Mem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceTopCpu.map((s) => {
                      const isHovered = hoveredService === s.serviceId;
                      return (
                        <tr
                          key={s.serviceId}
                          onClick={() => handleServiceClick(s)}
                          onMouseEnter={() => setHoveredService(s.serviceId)}
                          onMouseLeave={() => setHoveredService(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ')
                              handleServiceClick(s);
                          }}
                          role="button"
                          tabIndex={0}
                          title={`Open service: ${s.serviceName || s.serviceId}`}
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
                            }}
                          >
                            {s.serviceName || s.serviceId}
                          </td>
                          <td>{formatPercent(s.cpuPercent)}</td>
                          <td>{formatBytes(s.memoryUsedBytes)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="swarm-metrics-dashboard__hint">
                  Waiting for stats…
                </div>
              )}
            </div>

            <div className="swarm-metrics-panel">
              <div className="swarm-metrics-panel__title">Top nodes (CPU)</div>
              {nodeTopCpu.length ? (
                <table className="swarm-metrics-miniTable">
                  <thead>
                    <tr>
                      <th>Node</th>
                      <th>CPU</th>
                      <th>Mem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodeTopCpu.map((n) => {
                      const isHovered = hoveredNode === n.nodeId;
                      return (
                        <tr
                          key={n.nodeId}
                          onClick={() => handleNodeClick(n)}
                          onMouseEnter={() => setHoveredNode(n.nodeId)}
                          onMouseLeave={() => setHoveredNode(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ')
                              handleNodeClick(n);
                          }}
                          role="button"
                          tabIndex={0}
                          title={`Open node: ${n.hostname || n.nodeId}`}
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
                            }}
                          >
                            {n.hostname || n.nodeId}
                          </td>
                          <td>{formatPercent(n.cpuPercent)}</td>
                          <td>{formatBytes(n.memoryUsedBytes)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="swarm-metrics-dashboard__hint">
                  Waiting for stats…
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="swarm-metrics-dashboard__controls">
          <div className="swarm-metrics-dashboard__hint">
            Charts use:{' '}
            {rangeSeconds
              ? `last ${Math.round(rangeSeconds / 60)} min`
              : 'all cached points'}{' '}
            ({filteredHistory.length} points)
          </div>
          <TimeRangeSelector
            valueSeconds={rangeSeconds}
            onChangeSeconds={setRangeSeconds}
            disabled={loading}
          />
        </div>

        <div className="swarm-metrics-dashboard__charts">
          <div className="swarm-metrics-panel">
            <div className="swarm-metrics-panel__title">
              Running tasks (sparkline)
            </div>
            <MetricsChart points={filteredHistory} valueKey="runningTasks" />
            <div className="swarm-metrics-panel__sub">
              {latest
                ? `Now: ${latest.runningTasks ?? '-'} (Total: ${latest.tasks ?? '-'})`
                : ''}
            </div>
          </div>
          <div className="swarm-metrics-panel">
            <div className="swarm-metrics-panel__title">
              Services (sparkline)
            </div>
            <MetricsChart
              points={filteredHistory}
              valueKey="services"
              color="#2ea44f"
            />
            <div className="swarm-metrics-panel__sub">
              {latest ? `Now: ${latest.services ?? '-'}` : ''}
            </div>
          </div>
          <div className="swarm-metrics-panel">
            <div className="swarm-metrics-panel__title">Nodes (sparkline)</div>
            <MetricsChart
              points={filteredHistory}
              valueKey="nodes"
              color="#a371f7"
              emptyText="No node data yet"
            />
            <div className="swarm-metrics-panel__sub">
              {latest
                ? `Ready: ${latest.readyNodes ?? '-'} (Total: ${latest.nodes ?? '-'})`
                : ''}
            </div>
          </div>
          <div className="swarm-metrics-panel">
            <div className="swarm-metrics-panel__title">
              CPU reservations (% of capacity)
            </div>
            <MetricsChart
              points={filteredHistory}
              valueFn={(p) =>
                percent(p?.cpuReservationsNano, p?.cpuCapacityNano)
              }
              color="#d29922"
              emptyText="No CPU data yet"
            />
            <div className="swarm-metrics-panel__sub">
              {latest
                ? `Reservations: ${formatNanoCPUs(latest.cpuReservationsNano)} • Limits: ${formatNanoCPUs(latest.cpuLimitsNano)}`
                : ''}
            </div>
          </div>
          <div className="swarm-metrics-panel">
            <div className="swarm-metrics-panel__title">
              Memory reservations (% of capacity)
            </div>
            <MetricsChart
              points={filteredHistory}
              valueFn={(p) =>
                percent(p?.memoryReservationsBytes, p?.memoryCapacityBytes)
              }
              color="#a371f7"
              emptyText="No memory data yet"
            />
            <div className="swarm-metrics-panel__sub">
              {latest
                ? `Reservations: ${formatBytes(latest.memoryReservationsBytes)} • Limits: ${formatBytes(latest.memoryLimitsBytes)}`
                : ''}
            </div>
          </div>

          <div className="swarm-metrics-panel">
            <div className="swarm-metrics-panel__title">
              CPU usage (% of capacity)
            </div>
            <MetricsChart
              points={rateHistory}
              valueKey="cpuUsagePercent"
              color="#58a6ff"
              emptyText="No CPU usage yet"
            />
          </div>

          <div className="swarm-metrics-panel">
            <div className="swarm-metrics-panel__title">Memory used</div>
            <MetricsChart
              points={rateHistory}
              valueKey="memoryUsedBytes"
              color="#2ea44f"
              emptyText="No memory usage yet"
            />
            <div className="swarm-metrics-panel__sub">
              {latest ? `Now: ${formatBytes(latest.memoryUsedBytes)}` : ''}
            </div>
          </div>

          <div className="swarm-metrics-panel">
            <div className="swarm-metrics-panel__title">
              Network RX (bytes/s)
            </div>
            <MetricsChart
              points={rateHistory}
              valueKey="rxPerSec"
              color="#d29922"
              emptyText="No network data yet"
            />
            <div className="swarm-metrics-panel__sub">
              {rateHistory.length
                ? `Last: ${formatBytesPerSec(rateHistory[rateHistory.length - 1]?.rxPerSec)}`
                : ''}
            </div>
          </div>

          <div className="swarm-metrics-panel">
            <div className="swarm-metrics-panel__title">
              Network TX (bytes/s)
            </div>
            <MetricsChart
              points={rateHistory}
              valueKey="txPerSec"
              color="#ff7b72"
              emptyText="No network data yet"
            />
            <div className="swarm-metrics-panel__sub">
              {rateHistory.length
                ? `Last: ${formatBytesPerSec(rateHistory[rateHistory.length - 1]?.txPerSec)}`
                : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SwarmMetricsDashboard() {
  return (
    <MetricsStateProvider>
      <SwarmMetricsDashboardInner />
    </MetricsStateProvider>
  );
}
