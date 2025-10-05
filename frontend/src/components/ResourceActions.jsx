import React, { useState, useEffect } from 'react';
import { showSuccess, showError, showWarning } from '../notification';

export default function ResourceActions({ resourceType, name, namespace, onRestart, onDelete, disabled }) {
  const [confirm, setConfirm] = useState({ type: null, expires: 0 });
  const CONFIRM_WINDOW = 3500; // ms
  const hasRestart = typeof onRestart === 'function';
  const hasDelete = typeof onDelete === 'function';

  // Reset confirmation automatically when window expires
  useEffect(() => {
    if (!confirm.type) return;
    const id = setTimeout(() => setConfirm({ type: null, expires: 0 }), Math.max(0, confirm.expires - Date.now()));
    return () => clearTimeout(id);
  }, [confirm]);

  const beginConfirm = (type) => {
    setConfirm({ type, expires: Date.now() + CONFIRM_WINDOW });
    showWarning(`${type === 'delete' ? 'Delete' : 'Restart'} ${resourceType.toLowerCase()} '${name}': click again to confirm`, { duration: 2500 });
  };

  const handleAction = async (actionType) => {
    if (disabled) return;
    if (actionType === 'restart' && !hasRestart) return;
    if (actionType === 'delete' && !hasDelete) return;
    // First click -> enter confirm mode
    if (confirm.type !== actionType) {
      beginConfirm(actionType);
      return;
    }
    // Second click within window executes
    try {
      if (actionType === 'restart') {
        await onRestart(name, namespace);
        showSuccess(`${resourceType} '${name}' restarted`);
      } else if (actionType === 'delete') {
        await onDelete(name, namespace);
        showSuccess(`${resourceType} '${name}' deleted`);
      }
    } catch (err) {
      showError(`Failed to ${actionType} ${resourceType.toLowerCase()} '${name}': ${err?.message || err}`);
    } finally {
      setConfirm({ type: null, expires: 0 });
    }
  };

  const restartPending = confirm.type === 'restart';
  const deletePending  = confirm.type === 'delete';

  const baseBtn = {
    padding: '4px 10px',
    fontSize: 12,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 4,
    border: '1px solid #353a42',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'background 0.15s, color 0.15s, border-color 0.15s'
  };

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      {hasRestart && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleAction('restart')}
          title={restartPending ? `Click to confirm restart of ${resourceType} '${name}'` : `Restart ${resourceType} '${name}' (rollout restart)`}
          style={{
            ...baseBtn,
            background: restartPending ? '#9e6a03' : '#2d323b',
            borderColor: restartPending ? '#d29922' : '#353a42',
            color: '#fff'
          }}
        >
          <span aria-hidden="true" style={{ lineHeight: 1 }}>⟳</span>
          {restartPending ? 'Confirm' : 'Restart'}
        </button>
      )}
      {hasDelete && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleAction('delete')}
          title={deletePending ? `Click to confirm delete of ${resourceType} '${name}'` : `Delete ${resourceType} '${name}'`}
          style={{
            ...baseBtn,
              background: deletePending ? '#f85149' : '#b22222',
              borderColor: deletePending ? '#f85149' : '#853131',
              color: '#fff'
          }}
        >
          <span aria-hidden="true" style={{ lineHeight: 1 }}>🗑</span>
          {deletePending ? 'Confirm' : 'Delete'}
        </button>
      )}
    </div>
  );
}
