import React, { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

export default function ReplicaSetDetailTab({ namespace, replicaSetName }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!namespace || !replicaSetName) return;

    setLoading(true);
    setError(null);

    AppAPI.GetReplicaSetDetail(namespace, replicaSetName)
      .then(data => {
        setDetail(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch replicaset details');
        setLoading(false);
      });
  }, [namespace, replicaSetName]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'running': return '#2ea44f';
      case 'pending': return '#e6b800';
      case 'failed': return '#f85149';
      default: return '#8b949e';
    }
  };

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      {/* Owner info */}
      {detail?.ownerName && (
        <div style={{
          marginBottom: 16,
          padding: 12,
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <span style={{ color: 'var(--gh-text-muted, #8b949e)' }}>Controlled by:</span>
          <span style={{
            padding: '4px 8px',
            backgroundColor: '#21262d',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{
              fontSize: 11,
              padding: '1px 4px',
              borderRadius: 2,
              backgroundColor: '#58a6ff20',
              color: '#58a6ff'
            }}>
              {detail.ownerKind}
            </span>
            <span style={{ color: 'var(--gh-text, #c9d1d9)', fontWeight: 500 }}>
              {detail.ownerName}
            </span>
          </span>
        </div>
      )}

      {/* Pods section */}
      <h4 style={{ color: 'var(--gh-text, #c9d1d9)', marginBottom: 12 }}>
        Pods ({detail?.pods?.length || 0})
      </h4>

      {!detail?.pods || detail.pods.length === 0 ? (
        <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No pods found for this ReplicaSet.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Ready</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Restarts</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Age</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Node</th>
            </tr>
          </thead>
          <tbody>
            {detail.pods.map((pod, idx) => (
              <tr key={pod.name || idx} style={{ borderBottom: '1px solid #21262d' }}>
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
                <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>{pod.node || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
