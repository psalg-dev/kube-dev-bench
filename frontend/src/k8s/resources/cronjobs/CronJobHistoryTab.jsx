import { useEffect, useState } from 'react';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils.js';
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
      return formatTimestampDMYHMS(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <h4 style={{ color: 'var(--gh-text, #c9d1d9)', marginBottom: 12 }}>Job History (Last 10)</h4>
      <table className="panel-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Start Time</th>
            <th>Duration</th>
            <th className="text-center">Succeeded</th>
            <th className="text-center">Failed</th>
          </tr>
        </thead>
        <tbody>
          {detail.jobs.map((job, idx) => (
            <tr key={job.name || idx}>
              <td>{job.name}</td>
              <td>
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
              <td className="text-muted">{formatDate(job.startTime)}</td>
              <td>{job.duration}</td>
              <td className="text-center" style={{ color: job.succeeded > 0 ? '#2ea44f' : undefined }}>{job.succeeded}</td>
              <td className="text-center" style={{ color: job.failed > 0 ? '#f85149' : undefined }}>{job.failed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
