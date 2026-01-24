import { useEffect, useState } from 'react';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils.js';
import * as AppAPI from '../../../../wailsjs/go/main/App';

export default function DeploymentPodsTab({ namespace, deploymentName }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('pods');

  useEffect(() => {
    if (!namespace || !deploymentName) return;

    setLoading(true);
    setError(null);

    AppAPI.GetDeploymentDetail(namespace, deploymentName)
      .then(data => {
        setDetail(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch deployment details');
        setLoading(false);
      });
  }, [namespace, deploymentName]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
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
      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['pods', 'conditions', 'revisions'].map(section => (
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
              textTransform: 'capitalize',
              fontSize: 13
            }}
          >
            {section}
            {section === 'pods' && detail?.pods && ` (${detail.pods.length})`}
            {section === 'revisions' && detail?.revisions && ` (${detail.revisions.length})`}
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
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)' }}>{pod.name}</td>
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

      {/* Conditions section */}
      {activeSection === 'conditions' && (
        <>
          {!detail?.conditions || detail.conditions.length === 0 ? (
            <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No conditions.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #30363d' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Last Transition</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Reason</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Message</th>
                </tr>
              </thead>
              <tbody>
                {detail.conditions.map((cond, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #21262d' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)' }}>{cond.type}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        color: cond.status === 'True' ? '#2ea44f' : '#f85149',
                        fontWeight: 500
                      }}>
                        {cond.status}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>{formatDate(cond.lastTransition)}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>{cond.reason || '-'}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{cond.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* Revisions section (Rollout History) */}
      {activeSection === 'revisions' && (
        <>
          {!detail?.revisions || detail.revisions.length === 0 ? (
            <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No revisions found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #30363d' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Revision</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>ReplicaSet</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Image</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Created</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Replicas</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Current</th>
                </tr>
              </thead>
              <tbody>
                {detail.revisions.map((rev, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #21262d', backgroundColor: rev.isCurrent ? '#23863610' : 'transparent' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)', fontWeight: rev.isCurrent ? 600 : 400 }}>
                      #{rev.revision}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)', fontFamily: 'monospace', fontSize: 12 }}>{rev.replicaSet}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{rev.image}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>{formatDate(rev.createdAt)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--gh-text, #c9d1d9)' }}>{rev.replicas}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {rev.isCurrent && (
                        <span style={{
                          padding: '2px 8px',
                          backgroundColor: '#238636',
                          color: '#fff',
                          borderRadius: 10,
                          fontSize: 11
                        }}>
                          Active
                        </span>
                      )}
                    </td>
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
