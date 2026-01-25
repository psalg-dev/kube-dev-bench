import { useEffect, useState } from 'react';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils.js';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { showError, showSuccess } from '../../../notification';

export default function DeploymentRolloutTab({ namespace, deploymentName }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyRevision, setBusyRevision] = useState(null);

  const fetchDetail = async () => {
    if (!namespace || !deploymentName) return;
    setLoading(true);
    setError(null);
    try {
      const data = await AppAPI.GetDeploymentDetail(namespace, deploymentName);
      setDetail(data);
    } catch (e) {
      setError(e?.message || 'Failed to fetch deployment details');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, deploymentName]);

  const handleRollback = async (revision) => {
    if (!revision || busyRevision) return;
    setBusyRevision(revision);
    try {
      await AppAPI.RollbackDeploymentToRevision(namespace, deploymentName, Number(revision));
      showSuccess(`Rollback triggered for Deployment '${deploymentName}' to revision #${revision}`);
      await fetchDetail();
    } catch (e) {
      showError(`Failed to rollback Deployment '${deploymentName}': ${e?.message || e}`);
    } finally {
      setBusyRevision(null);
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

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
  }

  const revisions = detail?.revisions || [];

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      {revisions.length === 0 ? (
        <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No revisions found.</div>
      ) : (
        <table className="panel-table">
          <thead>
            <tr>
              <th>Revision</th>
              <th>ReplicaSet</th>
              <th>Image</th>
              <th>Created</th>
              <th style={{ textAlign: 'center' }}>Replicas</th>
              <th style={{ textAlign: 'center' }}>Current</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {revisions.map((rev, idx) => {
              const isCurrent = !!rev.isCurrent;
              const revision = rev.revision;
              const rollbackDisabled = isCurrent || busyRevision !== null;
              return (
                <tr key={idx} style={{ backgroundColor: isCurrent ? '#23863610' : 'transparent' }}>
                  <td style={{ fontWeight: isCurrent ? 600 : 400 }}>#{revision}</td>
                  <td className="text-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{rev.replicaSet}</td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{rev.image}</td>
                  <td className="text-muted">{formatDate(rev.createdAt)}</td>
                  <td style={{ textAlign: 'center' }}>{rev.replicas}</td>
                  <td style={{ textAlign: 'center' }}>
                    {isCurrent && (
                      <span style={{ padding: '2px 8px', backgroundColor: '#238636', color: '#fff', borderRadius: 10, fontSize: 11 }}>Active</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      disabled={rollbackDisabled}
                      onClick={() => handleRollback(revision)}
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        borderRadius: 4,
                        border: '1px solid #353a42',
                        background: rollbackDisabled ? '#2d323b' : '#9e6a03',
                        borderColor: rollbackDisabled ? '#353a42' : '#d29922',
                        color: '#fff',
                        opacity: rollbackDisabled ? 0.6 : 1,
                        cursor: rollbackDisabled ? 'not-allowed' : 'pointer'
                      }}
                      title={isCurrent ? 'Current revision' : `Rollback to revision #${revision}`}
                    >
                      {busyRevision === revision ? 'Rolling back…' : 'Rollback'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
