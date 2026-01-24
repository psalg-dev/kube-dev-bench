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
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #30363d' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Kind</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Name</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Reference</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c, idx) => (
            <tr key={`${c.kind || c.Kind}-${c.name || c.Name}-${idx}`} style={{ borderBottom: '1px solid #21262d' }}>
              <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)' }}>{c.kind ?? c.Kind}</td>
              <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)' }}>{c.name ?? c.Name}</td>
              <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)', fontFamily: 'monospace', fontSize: 12 }}>{c.refType ?? c.RefType ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
