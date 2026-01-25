import { useEffect, useState } from 'react';
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
      <table className="panel-table">
        <thead>
          <tr>
            <th style={{ width: 60 }}>#</th>
            <th>Scheduled Time</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((t, idx) => (
            <tr key={`${t}|${idx}`}>
              <td className="text-muted">{idx + 1}</td>
              <td>{formatTimestampDMYHMS(t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
