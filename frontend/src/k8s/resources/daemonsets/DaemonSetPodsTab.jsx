import { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

export default function DaemonSetPodsTab({ namespace, daemonSetName }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!namespace || !daemonSetName) return;

    setLoading(true);
    setError(null);

    AppAPI.GetDaemonSetDetail(namespace, daemonSetName)
      .then(data => {
        setDetail(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch daemonset details');
        setLoading(false);
      });
  }, [namespace, daemonSetName]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
  }

  if (!detail || !detail.pods || detail.pods.length === 0) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>No pods found for this DaemonSet.</div>;
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'running': return '#2ea44f';
      case 'pending': return '#e6b800';
      case 'failed': return '#f85149';
      default: return '#8b949e';
    }
  };

  // Group pods by node for visualization
  const podsByNode = {};
  detail.pods.forEach(pod => {
    const node = pod.node || 'Unknown';
    if (!podsByNode[node]) {
      podsByNode[node] = [];
    }
    podsByNode[node].push(pod);
  });

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: 'var(--gh-text, #c9d1d9)', fontWeight: 500 }}>
          Pods by Node
        </span>
        <span style={{
          fontSize: 12,
          padding: '2px 8px',
          borderRadius: 10,
          backgroundColor: '#238636',
          color: '#fff'
        }}>
          {detail.pods.length} pods on {Object.keys(podsByNode).length} nodes
        </span>
      </div>

      <table className="panel-table">
        <thead>
          <tr>
            <th>Node</th>
            <th>Pod</th>
            <th>Status</th>
            <th>Ready</th>
            <th>Restarts</th>
            <th>Age</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          {detail.pods.map((pod, idx) => (
            <tr key={pod.name || idx}>
              <td>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 8px',
                  backgroundColor: '#21262d',
                  borderRadius: 4,
                  fontSize: 12
                }}>
                  <span style={{ color: '#58a6ff' }}>🖥️</span>
                  <span>{pod.node || 'Unknown'}</span>
                </span>
              </td>
              <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                {pod.name}
              </td>
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
              <td style={{ color: pod.restarts > 0 ? '#f85149' : undefined }}>
                {pod.restarts}
              </td>
              <td>{pod.age}</td>
              <td className="text-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                {pod.ip || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
