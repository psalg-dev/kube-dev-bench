import { useEffect, useMemo, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

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
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
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

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <table className="panel-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Port</th>
            <th>Type</th>
            <th>ClusterIP</th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => {
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
