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

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #30363d' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Node</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Pod</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Status</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Ready</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Restarts</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Age</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>IP</th>
          </tr>
        </thead>
        <tbody>
          {detail.pods.map((pod, idx) => (
            <tr key={pod.name || idx} style={{ borderBottom: '1px solid #21262d' }}>
              <td style={{ padding: '8px 12px' }}>
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
                  <span style={{ color: 'var(--gh-text, #c9d1d9)' }}>{pod.node || 'Unknown'}</span>
                </span>
              </td>
              <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)', fontFamily: 'monospace', fontSize: 12 }}>
                {pod.name}
              </td>
              <td style={{ padding: '8px 12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: getStatusColor(pod.status)
                  }} />
                  <span style={{ color: 'var(--gh-text, #c9d1d9)' }}>{pod.status}</span>
                </span>
              </td>
              <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)' }}>{pod.ready}</td>
              <td style={{ padding: '8px 12px', color: pod.restarts > 0 ? '#f85149' : 'var(--gh-text, #c9d1d9)' }}>
                {pod.restarts}
              </td>
              <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)' }}>{pod.age}</td>
              <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)', fontFamily: 'monospace', fontSize: 12 }}>
                {pod.ip || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
