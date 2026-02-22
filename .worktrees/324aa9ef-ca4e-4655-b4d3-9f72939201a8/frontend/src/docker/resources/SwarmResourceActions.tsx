import type { CSSProperties, MouseEvent } from 'react';
import { useState } from 'react';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { showWarning } from '../../notification';

interface SwarmResourceActionsProps {
  resourceType: string;
  name: string;
  canScale?: boolean;
  currentReplicas?: number;
  onScale?: (_next: number) => Promise<void> | void;
  onRestart?: () => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onDrain?: () => Promise<void> | void;
  onActivate?: () => Promise<void> | void;
  availability?: string;
}
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
  availability = '', // For nodes: 'active', 'pause', 'drain'
}: SwarmResourceActionsProps) {
  const [showScaleDialog, setShowScaleDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newReplicas, setNewReplicas] = useState(currentReplicas);
  const [loading, setLoading] = useState(false);

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

  const modalOverlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
  };

  const modalStyle: CSSProperties = {
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
        <Button
          size="sm"
          onClick={() => {
            setNewReplicas(currentReplicas);
            setShowScaleDialog(true);
          }}
          disabled={loading}
        >
          Scale
        </Button>
      )}

      {/* Node availability buttons */}
      {onDrain && availability !== 'drain' && (
        <Button size="sm" onClick={onDrain} disabled={loading}>
          Drain
        </Button>
      )}
      {onActivate && availability !== 'active' && (
        <Button size="sm" onClick={onActivate} disabled={loading}>
          Activate
        </Button>
      )}

      {/* Restart button */}
      {onRestart && (
        <Button size="sm" onClick={handleRestart} disabled={loading}>
          Restart
        </Button>
      )}

      {/* Delete button */}
      {onDelete && (
        <Button variant="danger" size="sm" onClick={() => setShowDeleteDialog(true)} disabled={loading}>
          Delete
        </Button>
      )}

      {/* Scale Dialog */}
      {showScaleDialog && (
        <div style={modalOverlayStyle} onClick={() => setShowScaleDialog(false)}>
          <div style={modalStyle} onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
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
                onChange={(e) => setNewReplicas(parseInt(e.target.value, 10) || 0)}
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
              <Button size="sm" onClick={() => setShowScaleDialog(false)} disabled={loading}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleScale} disabled={loading}>
                {loading ? 'Scaling...' : 'Scale'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title={`Delete ${resourceType}?`}
        description={
          <>
            Are you sure you want to delete <strong style={{ color: 'var(--gh-text)' }}>{name}</strong>? This action cannot be undone.
          </>
        }
        confirmLabel={loading ? 'Deleting...' : 'Delete'}
        confirmVariant="danger"
        isBusy={loading}
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}