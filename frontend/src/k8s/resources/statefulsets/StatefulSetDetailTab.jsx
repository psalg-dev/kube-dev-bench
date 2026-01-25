import { useEffect, useState } from 'react';
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
                    <td style={{ fontFamily: 'monospace' }}>{pod.name}</td>
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
          )}
        </>
      )}

      {/* PVCs section */}
      {activeSection === 'pvcs' && (
        <>
          {!detail?.pvcs || detail.pvcs.length === 0 ? (
            <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No PVCs found for this StatefulSet.</div>
          ) : (
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Capacity</th>
                  <th>Access Modes</th>
                  <th>Storage Class</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                {detail.pvcs.map((pvc, idx) => (
                  <tr key={pvc.name || idx}>
                    <td style={{ fontFamily: 'monospace' }}>{pvc.name}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          backgroundColor: getStatusColor(pvc.status)
                        }} />
                        <span>{pvc.status}</span>
                      </span>
                    </td>
                    <td>{pvc.capacity}</td>
                    <td className="text-muted">{pvc.accessModes}</td>
                    <td className="text-muted">{pvc.storageClass || '-'}</td>
                    <td>{pvc.age}</td>
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
