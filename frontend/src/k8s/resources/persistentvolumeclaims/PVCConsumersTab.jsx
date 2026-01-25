import { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

export default function PVCConsumersTab({ namespace, pvcName }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!namespace || !pvcName) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await AppAPI.GetPVCConsumers(namespace, pvcName);
        if (!cancelled) setItems(Array.isArray(res) ? res : []);
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [namespace, pvcName]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
  }

  if (!items || items.length === 0) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>No consumers found.</div>;
  }

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <table className="panel-table">
        <thead>
          <tr>
            <th>Pod</th>
            <th>Node</th>
            <th>Status</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c, idx) => (
            <tr key={`${c.podName || c.PodName}-${idx}`}>
              <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.podName ?? c.PodName}</td>
              <td className="text-muted">{c.node ?? c.Node ?? '-'}</td>
              <td>{c.status ?? c.Status ?? '-'}</td>
              <td className="text-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.refType ?? c.RefType ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
