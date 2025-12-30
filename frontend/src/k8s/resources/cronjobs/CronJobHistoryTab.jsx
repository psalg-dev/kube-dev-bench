import React, { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

export default function CronJobHistoryTab({ namespace, cronJobName }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!namespace || !cronJobName) return;

    setLoading(true);
    setError(null);

    AppAPI.GetCronJobDetail(namespace, cronJobName)
      .then(data => {
        setDetail(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch cronjob details');
        setLoading(false);
      });
  }, [namespace, cronJobName]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
  }

  if (!detail || !detail.jobs || detail.jobs.length === 0) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>No jobs found for this cronjob.</div>;
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'succeeded': return '#2ea44f';
      case 'running': return '#e6b800';
      case 'failed': return '#f85149';
      default: return '#8b949e';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'succeeded': return '✓';
      case 'running': return '●';
      case 'failed': return '✗';
      default: return '?';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <h4 style={{ color: 'var(--gh-text, #c9d1d9)', marginBottom: 12 }}>Job History (Last 10)</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #30363d' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Name</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Status</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Start Time</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Duration</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Succeeded</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Failed</th>
          </tr>
        </thead>
        <tbody>
          {detail.jobs.map((job, idx) => (
            <tr key={job.name || idx} style={{ borderBottom: '1px solid #21262d' }}>
              <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)' }}>{job.name}</td>
              <td style={{ padding: '8px 12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    color: getStatusColor(job.status),
                    fontWeight: 600
                  }}>
                    {getStatusIcon(job.status)}
                  </span>
                  <span style={{ color: getStatusColor(job.status) }}>{job.status}</span>
                </span>
              </td>
              <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>{formatDate(job.startTime)}</td>
              <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)' }}>{job.duration}</td>
              <td style={{ padding: '8px 12px', textAlign: 'center', color: job.succeeded > 0 ? '#2ea44f' : 'var(--gh-text-muted, #8b949e)' }}>{job.succeeded}</td>
              <td style={{ padding: '8px 12px', textAlign: 'center', color: job.failed > 0 ? '#f85149' : 'var(--gh-text-muted, #8b949e)' }}>{job.failed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
