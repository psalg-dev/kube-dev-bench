import { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

export default function ConfigMapConsumersTab({ namespace, configMapName }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!namespace || !configMapName) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await AppAPI.GetConfigMapConsumers(namespace, configMapName);
        if (!cancelled) setItems(Array.isArray(res) ? res : []);
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [namespace, configMapName]);

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
            <th>Kind</th>
            <th>Name</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c, idx) => (
            <tr key={`${c.kind || c.Kind}-${c.name || c.Name}-${idx}`}>
              <td>{c.kind ?? c.Kind}</td>
              <td>{c.name ?? c.Name}</td>
              <td className="text-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.refType ?? c.RefType ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
