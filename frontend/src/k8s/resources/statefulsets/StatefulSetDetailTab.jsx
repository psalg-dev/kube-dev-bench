import React, { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

export default function StatefulSetDetailTab({ namespace, statefulSetName }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('pods');

  useEffect(() => {
    if (!namespace || !statefulSetName) return;

    setLoading(true);
    setError(null);

    AppAPI.GetStatefulSetDetail(namespace, statefulSetName)
      .then(data => {
        setDetail(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch statefulset details');
        setLoading(false);
      });
  }, [namespace, statefulSetName]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'running': return '#2ea44f';
      case 'bound': return '#2ea44f';
      case 'pending': return '#e6b800';
      case 'failed': return '#f85149';
      default: return '#8b949e';
    }
  };

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['pods', 'pvcs'].map(section => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            style={{
              padding: '6px 12px',
              backgroundColor: activeSection === section ? '#238636' : '#21262d',
              border: '1px solid #30363d',
              borderRadius: 4,
              color: 'var(--gh-text, #c9d1d9)',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontSize: 13
            }}
          >
            {section}
            {section === 'pods' && detail?.pods && ` (${detail.pods.length})`}
            {section === 'pvcs' && detail?.pvcs && ` (${detail.pvcs.length})`}
          </button>
        ))}
      </div>

      {/* Pods section */}
      {activeSection === 'pods' && (
        <>
          {!detail?.pods || detail.pods.length === 0 ? (
            <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No pods found.</div>
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
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)', fontFamily: 'monospace' }}>{pod.name}</td>
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
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)' }}>{pod.restarts}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)' }}>{pod.age}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>{pod.node || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* PVCs section */}
      {activeSection === 'pvcs' && (
        <>
          {!detail?.pvcs || detail.pvcs.length === 0 ? (
            <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No PVCs found for this StatefulSet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #30363d' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Capacity</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Access Modes</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Storage Class</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Age</th>
                </tr>
              </thead>
              <tbody>
                {detail.pvcs.map((pvc, idx) => (
                  <tr key={pvc.name || idx} style={{ borderBottom: '1px solid #21262d' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)', fontFamily: 'monospace' }}>{pvc.name}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          backgroundColor: getStatusColor(pvc.status)
                        }} />
                        <span style={{ color: 'var(--gh-text, #c9d1d9)' }}>{pvc.status}</span>
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)' }}>{pvc.capacity}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>{pvc.accessModes}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>{pvc.storageClass || '-'}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)' }}>{pvc.age}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
