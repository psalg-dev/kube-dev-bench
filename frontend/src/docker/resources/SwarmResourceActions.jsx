import React, { useState } from 'react';
import { showWarning } from '../../notification';

/**
 * SwarmResourceActions - Reusable action buttons for Swarm resources
 * Provides scale, restart, and delete actions with confirmation dialogs
 */
export default function SwarmResourceActions({
  resourceType,
  name,
  canScale = false,
  currentReplicas = 0,
  onScale,
  onRestart,
  onDelete,
  onDrain,
  onActivate,
  availability, // For nodes: 'active', 'pause', 'drain'
}) {
  const [showScaleDialog, setShowScaleDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newReplicas, setNewReplicas] = useState(currentReplicas);
  const [loading, setLoading] = useState(false);

  const buttonStyle = {
    padding: '6px 12px',
    borderRadius: 4,
    border: '1px solid var(--gh-border, #30363d)',
    backgroundColor: 'var(--gh-button-bg, #21262d)',
    color: 'var(--gh-text, #c9d1d9)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  };

  const dangerButtonStyle = {
    ...buttonStyle,
    backgroundColor: 'rgba(215, 58, 73, 0.1)',
    borderColor: '#d73a49',
    color: '#f85149',
  };

  const handleScale = async () => {
    if (newReplicas < 0) {
      showWarning('Replicas cannot be negative');
      return;
    }
    setLoading(true);
    try {
      await onScale?.(newReplicas);
      setShowScaleDialog(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete?.();
      setShowDeleteDialog(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    setLoading(true);
    try {
      await onRestart?.();
    } finally {
      setLoading(false);
    }
  };

  const modalOverlayStyle = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
  };

  const modalStyle = {
    backgroundColor: 'var(--gh-bg, #0d1117)',
    borderRadius: 8,
    padding: 24,
    width: 360,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  };

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {/* Scale button (only for services with replicated mode) */}
      {canScale && onScale && (
        <button
          style={buttonStyle}
          onClick={() => {
            setNewReplicas(currentReplicas);
            setShowScaleDialog(true);
          }}
          disabled={loading}
        >
          Scale
        </button>
      )}

      {/* Node availability buttons */}
      {onDrain && availability !== 'drain' && (
        <button
          style={buttonStyle}
          onClick={onDrain}
          disabled={loading}
        >
          Drain
        </button>
      )}
      {onActivate && availability !== 'active' && (
        <button
          style={buttonStyle}
          onClick={onActivate}
          disabled={loading}
        >
          Activate
        </button>
      )}

      {/* Restart button */}
      {onRestart && (
        <button
          style={buttonStyle}
          onClick={handleRestart}
          disabled={loading}
        >
          Restart
        </button>
      )}

      {/* Delete button */}
      {onDelete && (
        <button
          style={dangerButtonStyle}
          onClick={() => setShowDeleteDialog(true)}
          disabled={loading}
        >
          Delete
        </button>
      )}

      {/* Scale Dialog */}
      {showScaleDialog && (
        <div style={modalOverlayStyle} onClick={() => setShowScaleDialog(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--gh-text)' }}>
              Scale {resourceType}: {name}
            </h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text-secondary)' }}>
                Number of replicas
              </label>
              <input
                type="number"
                min="0"
                value={newReplicas}
                onChange={(e) => setNewReplicas(parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'var(--gh-input-bg, #0d1117)',
                  border: '1px solid var(--gh-border, #30363d)',
                  borderRadius: 6,
                  color: 'var(--gh-text)',
                  fontSize: 14,
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                style={buttonStyle}
                onClick={() => setShowScaleDialog(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                style={{ ...buttonStyle, backgroundColor: '#238636', color: '#fff' }}
                onClick={handleScale}
                disabled={loading}
              >
                {loading ? 'Scaling...' : 'Scale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div style={modalOverlayStyle} onClick={() => setShowDeleteDialog(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--gh-text)' }}>
              Delete {resourceType}?
            </h3>
            <p style={{ marginBottom: 16, color: 'var(--gh-text-secondary)' }}>
              Are you sure you want to delete <strong style={{ color: 'var(--gh-text)' }}>{name}</strong>?
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                style={buttonStyle}
                onClick={() => setShowDeleteDialog(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                style={dangerButtonStyle}
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
