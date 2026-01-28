import { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import './ReplicaSetOwnerTab.css';

/**
 * Shows the owner (typically a Deployment) of a ReplicaSet.
 *
 * @param {string} namespace - The namespace of the ReplicaSet
 * @param {string} replicaSetName - The name of the ReplicaSet
 */
export default function ReplicaSetOwnerTab({ namespace, replicaSetName }) {
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOwner = async () => {
      if (!replicaSetName || !namespace) return;

      setLoading(true);
      setError(null);

      try {
        const result = await AppAPI.GetReplicaSetDetail(
          namespace,
          replicaSetName,
        );
        if (result?.ownerName && result?.ownerKind) {
          setOwner({
            name: result.ownerName,
            kind: result.ownerKind,
          });
        } else {
          setOwner(null);
        }
      } catch (err) {
        setError(err?.message || String(err));
        setOwner(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOwner();
  }, [namespace, replicaSetName]);

  if (loading) {
    return (
      <div className="replicaset-owner-tab">
        <div className="owner-loading">Loading owner information...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="replicaset-owner-tab">
        <div className="owner-error">Error: {error}</div>
      </div>
    );
  }

  if (!owner) {
    return (
      <div className="replicaset-owner-tab">
        <div className="owner-empty">
          <div className="owner-empty-icon">📦</div>
          <div className="owner-empty-text">This ReplicaSet has no owner.</div>
          <div className="owner-empty-hint">
            It may have been created independently or orphaned.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="replicaset-owner-tab">
      <div className="owner-card">
        <div className="owner-header">
          <span className="owner-kind-badge">{owner.kind}</span>
          <span className="owner-label">Owner</span>
        </div>
        <div className="owner-name">{owner.name}</div>
        <div className="owner-namespace">
          <span className="owner-namespace-label">Namespace:</span>
          <span className="owner-namespace-value">{namespace}</span>
        </div>
        <div className="owner-hint">
          This ReplicaSet is managed by the {owner.kind} above.
        </div>
      </div>
    </div>
  );
}
