import { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { formatDateDMY } from '../../../utils/dateUtils.js';

export default function IngressTLSTab({ namespace, ingressName }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!namespace || !ingressName) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await AppAPI.GetIngressTLSSummary(namespace, ingressName);
        if (!cancelled) setItems(Array.isArray(res) ? res : []);
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [namespace, ingressName]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
  }

  if (!items || items.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>
        No TLS configured.
      </div>
    );
  }

  const fmt = (s) => {
    if (!s || s === '-') return '-';
    try {
      return formatDateDMY(s);
    } catch {
      return s;
    }
  };

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #30363d' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Secret</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Hosts</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Expires</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Days</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t, idx) => {
            const secretName = t.secretName ?? t.SecretName ?? '-';
            const hosts = t.hosts ?? t.Hosts ?? [];
            const notAfter = t.notAfter ?? t.NotAfter ?? '-';
            const days = t.daysRemaining ?? t.DaysRemaining;
            const err = t.error ?? t.Error;
            const isExpired = typeof days === 'number' && days < 0;
            const isSoon = typeof days === 'number' && days >= 0 && days <= 14;

            return (
              <tr key={`${secretName}-${idx}`} style={{ borderBottom: '1px solid #21262d' }}>
                <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)', fontFamily: 'monospace', fontSize: 12 }}>{secretName}</td>
                <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)' }}>{Array.isArray(hosts) && hosts.length ? hosts.join(', ') : '-'}</td>
                <td style={{ padding: '8px 12px', color: isExpired ? '#f85149' : isSoon ? '#d29922' : 'var(--gh-text, #c9d1d9)' }}>
                  {err ? `Error: ${err}` : fmt(notAfter)}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: isExpired ? '#f85149' : isSoon ? '#d29922' : 'var(--gh-text-muted, #8b949e)' }}>
                  {typeof days === 'number' ? days : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
