import React from 'react';

export default function PVCBoundPVTab({ namespace, pvcName, pvName }) {
  const hasPV = pvName && pvName !== '-';

  const navigateToPV = () => {
    if (!hasPV) return;
    const event = new CustomEvent('navigate-to-resource', {
      detail: {
        resource: 'PersistentVolume',
        name: pvName,
        // PVs are cluster-scoped; empty namespace allows row match by name only
        namespace: ''
      }
    });
    window.dispatchEvent(event);
  };

  if (!hasPV) {
    return (
      <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>
        No bound PersistentVolume for PVC <span style={{ fontFamily: 'monospace' }}>{namespace}/{pvcName}</span>.
      </div>
    );
  }

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 10, color: 'var(--gh-text, #c9d1d9)', fontWeight: 600 }}>Bound PersistentVolume</div>
      <div style={{
        border: '1px solid #30363d',
        borderRadius: 6,
        background: 'var(--gh-bg, #0d1117)',
        padding: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--gh-text-muted, #8b949e)', fontSize: 12 }}>PV Name</div>
          <div style={{ color: 'var(--gh-text, #c9d1d9)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{pvName}</div>
        </div>
        <button
          type="button"
          onClick={navigateToPV}
          style={{
            padding: '6px 10px',
            fontSize: 12,
            borderRadius: 4,
            border: '1px solid #353a42',
            background: '#2d323b',
            color: '#fff',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
          title="Open PersistentVolume"
        >
          Open PV
        </button>
      </div>
      <div style={{ marginTop: 12, color: 'var(--gh-text-muted, #8b949e)', fontSize: 12 }}>
        Clicking “Open PV” switches to the Persistent Volumes view and opens the matching PV.
      </div>
    </div>
  );
}
