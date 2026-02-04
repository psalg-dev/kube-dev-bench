import { useEffect, useMemo, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../../utils/tableSorting.js';

export default function IngressBackendServicesTab({ namespace, ingressName }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [serviceDetails, setServiceDetails] = useState({});

  useEffect(() => {
    if (!namespace || !ingressName) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await AppAPI.GetIngressDetail(namespace, ingressName);
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [namespace, ingressName]);

  const services = useMemo(() => {
    const rules = detail?.rules || detail?.Rules || [];
    const seen = new Map();
    for (const r of rules) {
      const svc = r.serviceName ?? r.ServiceName;
      const port = r.servicePort ?? r.ServicePort;
      if (!svc) continue;
      const key = `${svc}:${port || ''}`;
      if (!seen.has(key)) seen.set(key, { name: svc, port: port || '-' });
    }
    return Array.from(seen.values());
  }, [detail]);

  useEffect(() => {
    if (!services.length) return;
    let cancelled = false;

    const run = async () => {
      // Best-effort: fetch extra info for each referenced service
      const updates = {};
      for (const s of services) {
        try {
          const info = await AppAPI.GetServiceSummary(namespace, s.name);
          updates[s.name] = info;
        } catch {
          // ignore
        }
      }
      if (!cancelled) setServiceDetails(prev => ({ ...prev, ...updates }));
    };

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, services.map(s => s.name).join('|')]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
  }

  if (!services.length) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>No backend services found in rules.</div>;
  }

  const columns = useMemo(() => ([
    { key: 'name', label: 'Service' },
    { key: 'port', label: 'Port' },
    { key: 'type', label: 'Type' },
    { key: 'clusterIP', label: 'ClusterIP' },
  ]), []);
  const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
  const [sortState, setSortState] = useState(() => ({ key: defaultSortKey, direction: 'asc' }));
  const sortedServices = useMemo(() => {
    return sortRows(services, sortState.key, sortState.direction, (row, key) => {
      const extra = serviceDetails[row?.name];
      if (key === 'type') return extra?.type ?? extra?.Type ?? '-';
      if (key === 'clusterIP') return extra?.clusterIP ?? extra?.ClusterIP ?? '-';
      return row?.[key];
    });
  }, [services, sortState, serviceDetails]);

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

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <table className="panel-table">
        <thead>
          <tr>
            <th aria-sort={sortState.key === 'name' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'name'))}>
                <span>Service</span>
                <span aria-hidden="true">{sortState.key === 'name' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
              </button>
            </th>
            <th aria-sort={sortState.key === 'port' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'port'))}>
                <span>Port</span>
                <span aria-hidden="true">{sortState.key === 'port' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
              </button>
            </th>
            <th aria-sort={sortState.key === 'type' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'type'))}>
                <span>Type</span>
                <span aria-hidden="true">{sortState.key === 'type' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
              </button>
            </th>
            <th aria-sort={sortState.key === 'clusterIP' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'clusterIP'))}>
                <span>ClusterIP</span>
                <span aria-hidden="true">{sortState.key === 'clusterIP' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedServices.map((s) => {
            const extra = serviceDetails[s.name];
            const type = extra?.type ?? extra?.Type ?? '-';
            const clusterIP = extra?.clusterIP ?? extra?.ClusterIP ?? '-';
            return (
              <tr key={`${s.name}:${s.port}`}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.name}</td>
                <td>{s.port}</td>
                <td className="text-muted">{type}</td>
                <td className="text-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{clusterIP}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ marginTop: 10, color: 'var(--gh-text-muted, #8b949e)', fontSize: 12 }}>
        This lists Services referenced by Ingress rules. Service details are fetched best-effort.
      </div>
    </div>
  );
}
