import { useEffect, useState } from 'react';
import { GetPodEvents } from '../../../../wailsjs/go/main/App';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';

export default function PodEventsTab({ namespace, podName }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!podName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await GetPodEvents(namespace || '', podName);
      setEvents(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load();   }, [namespace, podName]);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--gh-border, #30363d)', background: 'var(--gh-bg-sidebar, #161b22)' }}>
        <span style={{ color: 'var(--gh-text, #c9d1d9)' }}>Events for {podName}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ padding: '6px 10px', background: 'var(--gh-input-bg, #21262d)', border: '1px solid var(--gh-border, #30363d)', color: 'var(--gh-text, #c9d1d9)', cursor: 'pointer' }}>Refresh</button>
        </div>
      </div>
      {loading && <div style={{ padding: 12, color: 'var(--gh-text-muted, #8b949e)' }}>Loading…</div>}
      {error && <div style={{ padding: 12, color: '#f85149' }}>Error: {error}</div>}
      {!loading && !error && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table className="panel-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Reason</th>
                <th>Message</th>
                <th style={{ textAlign: 'right' }}>Count</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No events.</td>
                </tr>
              )}
              {events.map((e, idx) => (
                <tr key={idx}>
                  <td>{e.type}</td>
                  <td>{e.reason}</td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{e.message}</td>
                  <td style={{ textAlign: 'right' }}>{e.count}</td>
                  <td>{formatTimestampDMYHMS(e.lastTimestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
