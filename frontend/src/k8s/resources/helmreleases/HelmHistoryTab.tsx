import { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { showError, showSuccess } from '../../../notification';
import StatusBadge from '../../../components/StatusBadge';
import type { app } from '../../../../wailsjs/go/models';

type HelmHistoryTabProps = {
  namespace?: string;
  releaseName?: string;
  onRefresh?: () => void;
};

export default function HelmHistoryTab({ namespace, releaseName, onRefresh }: HelmHistoryTabProps) {
  const [history, setHistory] = useState<app.HelmHistoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    AppAPI.GetHelmReleaseHistory(namespace ?? '', releaseName ?? '')
      .then((data) => {
        setHistory(data || []);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(message || 'Failed to load history');
        setHistory([]);
      })
      .finally(() => setLoading(false));
  }, [namespace, releaseName]);

  const handleRollback = async (revision: number) => {
    if (!window.confirm(`Rollback "${releaseName}" to revision ${revision}?`)) return;
    setRollingBack(revision);
    try {
      await AppAPI.RollbackHelmRelease(namespace ?? '', releaseName ?? '', revision);
      showSuccess(`Rolled back "${releaseName}" to revision ${revision}`);
      if (onRefresh) onRefresh();
      // Refresh history
      const data = await AppAPI.GetHelmReleaseHistory(namespace ?? '', releaseName ?? '');
      setHistory(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Rollback failed: ${message}`);
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
      <table className="panel-table">
        <thead>
          <tr>
            <th>Revision</th>
            <th>Updated</th>
            <th>Status</th>
            <th>Chart</th>
            <th>App Version</th>
            <th>Description</th>
            <th style={{ textAlign: 'center' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry, idx) => (
            <tr
              key={entry.revision}
              style={{
                background: idx === 0 ? 'rgba(46, 164, 79, 0.1)' : 'transparent',
              }}
            >
              <td>
                {entry.revision}
                {idx === 0 && <span style={{ marginLeft: 8, color: '#2ea44f', fontSize: 11 }}>(current)</span>}
              </td>
              <td className="text-muted">{entry.updated}</td>
              <td>
                <StatusBadge status={entry.status || '-'} size="small" showDot={false} />
              </td>
              <td className="text-muted">{entry.chart}</td>
              <td className="text-muted">{entry.appVersion || '-'}</td>
              <td className="text-muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.description || '-'}
              </td>
              <td style={{ textAlign: 'center' }}>
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

