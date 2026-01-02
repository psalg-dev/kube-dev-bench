import React from 'react';
import './PVBoundPVCTab.css';

/**
 * Bound PVC tab for PersistentVolumes - shows details about the bound PVC.
 * 
 * @param {string} pvName - The name of the PersistentVolume
 * @param {string} claim - The claim in format "namespace/name" or "-" if unbound
 */
export default function PVBoundPVCTab({ pvName, claim }) {
  // Parse claim to get namespace and name
  const parseClaimInfo = () => {
    if (!claim || claim === '-') {
      return { bound: false, namespace: null, pvcName: null };
    }
    
    const parts = claim.split('/');
    if (parts.length === 2) {
      return { bound: true, namespace: parts[0], pvcName: parts[1] };
    }
    
    return { bound: true, namespace: 'unknown', pvcName: claim };
  };

  const claimInfo = parseClaimInfo();

  const openPVC = () => {
    if (!claimInfo.bound || !claimInfo.namespace || !claimInfo.pvcName) return;
    const event = new CustomEvent('navigate-to-resource', {
      detail: {
        resource: 'PersistentVolumeClaim',
        name: claimInfo.pvcName,
        namespace: claimInfo.namespace,
      }
    });
    window.dispatchEvent(event);
  };

  if (!claimInfo.bound) {
    return (
      <div className="pv-bound-pvc-tab">
        <div className="no-pvc-message">
          <div className="icon">📦</div>
          <h3>No Bound PVC</h3>
          <p>This PersistentVolume is not currently bound to any PersistentVolumeClaim.</p>
          <p className="hint">The volume is available for binding when a matching PVC is created.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pv-bound-pvc-tab">
      <div className="bound-pvc-header">
        <h3>Bound PersistentVolumeClaim</h3>
        <p>This volume is bound to the following PVC:</p>
      </div>

      <div className="pvc-card">
        <div className="pvc-icon">📋</div>
        <div className="pvc-details">
          <div className="pvc-row">
            <span className="pvc-label">PVC Name:</span>
            <span className="pvc-value">{claimInfo.pvcName}</span>
          </div>
          <div className="pvc-row">
            <span className="pvc-label">Namespace:</span>
            <span className="pvc-value">{claimInfo.namespace}</span>
          </div>
          <div className="pvc-row">
            <span className="pvc-label">Full Reference:</span>
            <span className="pvc-value code">{claim}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={openPVC}
          style={{
            padding: '6px 10px',
            fontSize: 12,
            borderRadius: 4,
            border: '1px solid #353a42',
            background: '#2d323b',
            color: '#fff',
            cursor: 'pointer'
          }}
          title="Open bound PersistentVolumeClaim"
        >
          Open PVC
        </button>
      </div>

      <div className="info-section">
        <h4>About PV-PVC Binding</h4>
        <p>
          A PersistentVolume (PV) is a piece of storage in the cluster that has been provisioned
          by an administrator or dynamically provisioned using Storage Classes.
        </p>
        <p>
          When a PersistentVolumeClaim (PVC) requests storage, Kubernetes binds it to an available
          PV that matches the requested storage size, access modes, and storage class.
        </p>
      </div>
    </div>
  );
}
