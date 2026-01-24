import { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

function getStatusColor(status) {
  const statusLower = (status || '').toLowerCase();
  if (statusLower === 'deployed') return '#2ea44f';
  if (statusLower === 'failed') return '#d73a49';
  if (statusLower === 'pending' || statusLower.includes('pending')) return '#e6b800';
  if (statusLower === 'superseded') return '#9aa0a6';
  return '#9aa0a6';
}

export default function HelmHistoryTab({ namespace, releaseName, onRefresh }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rollingBack, setRollingBack] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    AppAPI.GetHelmReleaseHistory(namespace, releaseName)
      .then((data) => {
        setHistory(data || []);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load history');
        setHistory([]);
      })
      .finally(() => setLoading(false));
  }, [namespace, releaseName]);

  const handleRollback = async (revision) => {
    if (!window.confirm(`Rollback "${releaseName}" to revision ${revision}?`)) return;
    setRollingBack(revision);
    try {
      await AppAPI.RollbackHelmRelease(namespace, releaseName, revision);
      if (onRefresh) onRefresh();
      // Refresh history
      const data = await AppAPI.GetHelmReleaseHistory(namespace, releaseName);
      setHistory(data || []);
    } catch (err) {
      alert(`Rollback failed: ${err.message || err}`);
    } finally {
      setRollingBack(null);
    }
  };

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading history...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: '#d73a49' }}>Error: {error}</div>;
  }

  if (history.length === 0) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>No history available</div>;
  }

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--gh-border, #30363d)', color: 'var(--gh-text-muted, #8b949e)' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px' }}>Revision</th>
            <th style={{ textAlign: 'left', padding: '8px 12px' }}>Updated</th>
            <th style={{ textAlign: 'left', padding: '8px 12px' }}>Status</th>
            <th style={{ textAlign: 'left', padding: '8px 12px' }}>Chart</th>
            <th style={{ textAlign: 'left', padding: '8px 12px' }}>App Version</th>
            <th style={{ textAlign: 'left', padding: '8px 12px' }}>Description</th>
            <th style={{ textAlign: 'center', padding: '8px 12px' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry, idx) => (
            <tr
              key={entry.revision}
              style={{
                borderBottom: '1px solid var(--gh-border, #30363d)',
                background: idx === 0 ? 'rgba(46, 164, 79, 0.1)' : 'transparent',
              }}
            >
              <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)' }}>
                {entry.revision}
                {idx === 0 && <span style={{ marginLeft: 8, color: '#2ea44f', fontSize: 11 }}>(current)</span>}
              </td>
              <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>{entry.updated}</td>
              <td style={{ padding: '8px 12px' }}>
                <span style={{ color: getStatusColor(entry.status), fontWeight: 500 }}>{entry.status}</span>
              </td>
              <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>{entry.chart}</td>
              <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>{entry.appVersion || '-'}</td>
              <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.description || '-'}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                {idx !== 0 && (
                  <button
                    onClick={() => handleRollback(entry.revision)}
                    disabled={rollingBack !== null}
                    style={{
                      padding: '4px 10px',
                      background: rollingBack === entry.revision ? '#666' : 'var(--gh-btn-bg, #21262d)',
                      color: 'var(--gh-btn-text, #c9d1d9)',
                      border: '1px solid var(--gh-border, #30363d)',
                      borderRadius: 4,
                      cursor: rollingBack !== null ? 'not-allowed' : 'pointer',
                      fontSize: 12,
                    }}
                  >
                    {rollingBack === entry.revision ? 'Rolling back...' : 'Rollback'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
