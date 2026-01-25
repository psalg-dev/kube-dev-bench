import { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

export default function JobPodsTab({ namespace, jobName }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!namespace || !jobName) return;

    setLoading(true);
    setError(null);

    AppAPI.GetJobDetail(namespace, jobName)
      .then(data => {
        setDetail(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch job details');
        setLoading(false);
      });
  }, [namespace, jobName]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
  }

  if (!detail || !detail.pods || detail.pods.length === 0) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>No pods found for this job.</div>;
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'running': return '#2ea44f';
      case 'succeeded': return '#2ea44f';
      case 'pending': return '#e6b800';
      case 'failed': return '#f85149';
      default: return '#8b949e';
    }
  };

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <table className="panel-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Ready</th>
            <th>Restarts</th>
            <th>Age</th>
            <th>Node</th>
          </tr>
        </thead>
        <tbody>
          {detail.pods.map((pod, idx) => (
            <tr key={pod.name || idx}>
              <td>{pod.name}</td>
              <td>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: getStatusColor(pod.status)
                  }} />
                  <span>{pod.status}</span>
                </span>
              </td>
              <td>{pod.ready}</td>
              <td>{pod.restarts}</td>
              <td>{pod.age}</td>
              <td className="text-muted">{pod.node || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {detail.conditions && detail.conditions.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ color: 'var(--gh-text, #c9d1d9)', marginBottom: 8 }}>Conditions</h4>
          <table className="panel-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {detail.conditions.map((cond, idx) => (
                <tr key={idx}>
                  <td>{cond.type}</td>
                  <td>
                    <span style={{
                      color: cond.status === 'True' ? '#2ea44f' : '#8b949e',
                      fontWeight: 500
                    }}>
                      {cond.status}
                    </span>
                  </td>
                  <td className="text-muted">{cond.reason || '-'}</td>
                  <td className="text-muted" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{cond.message || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
