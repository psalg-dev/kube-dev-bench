import React, { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';

export default function CronJobNextRunsTab({ namespace, cronJobName, suspend }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!namespace || !cronJobName) return;

    setLoading(true);
    setError(null);

    AppAPI.GetCronJobDetail(namespace, cronJobName)
      .then((data) => {
        setDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to fetch cronjob details');
        setLoading(false);
      });
  }, [namespace, cronJobName]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
  }

  if (suspend) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>CronJob is suspended.</div>;
  }

  const runs = Array.isArray(detail?.nextRuns) ? detail.nextRuns : (Array.isArray(detail?.NextRuns) ? detail.NextRuns : []);
  if (!runs || runs.length === 0) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>No upcoming runs available.</div>;
  }

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <h4 style={{ color: 'var(--gh-text, #c9d1d9)', marginBottom: 12 }}>Next Runs (Next 5)</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #30363d' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>#</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Scheduled Time</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((t, idx) => (
            <tr key={`${t}|${idx}`} style={{ borderBottom: '1px solid #21262d' }}>
              <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)', width: 60 }}>{idx + 1}</td>
              <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)' }}>{formatTimestampDMYHMS(t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
