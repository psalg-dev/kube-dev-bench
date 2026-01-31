import { useState, useCallback, useEffect, useRef } from 'react';
import './BulkConfirmDialog.css';

/**
 * Confirmation dialog for bulk operations.
 * Shows a list of affected resources and requires typed count confirmation for 5+ items.
 * @param {boolean} open - Whether the dialog is open
 * @param {string} actionLabel - Label for the action (e.g., "Delete", "Restart")
 * @param {Array} items - Array of items to be affected (each should have name and optionally namespace)
 * @param {boolean} danger - Whether this is a destructive operation
 * @param {boolean} hasProductionWarning - Whether to show production/kube-system warning
 * @param {function} onConfirm - Callback when confirmed
 * @param {function} onCancel - Callback when cancelled
 */
export default function BulkConfirmDialog({
  open,
  actionLabel = 'Delete',
  items = [],
  danger = false,
  hasProductionWarning = false,
  onConfirm,
  onCancel,
}) {
  const [confirmText, setConfirmText] = useState('');
  const inputRef = useRef(null);
  const dialogRef = useRef(null);

  const requireTypedCount = items.length >= 5;
  const isConfirmEnabled = !requireTypedCount || confirmText === String(items.length);

  // Focus input when dialog opens
  useEffect(() => {
    if (open && requireTypedCount && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open, requireTypedCount]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  // Reset confirm text when dialog closes
  useEffect(() => {
    if (!open) {
      setConfirmText('');
    }
  }, [open]);

  const handleConfirm = useCallback(() => {
    if (isConfirmEnabled && onConfirm) {
      onConfirm();
    }
  }, [isConfirmEnabled, onConfirm]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === dialogRef.current) {
      onCancel?.();
    }
  }, [onCancel]);

  if (!open) return null;

  return (
    <div
      className="bulk-confirm-overlay"
      ref={dialogRef}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-confirm-title"
    >
      <div className="bulk-confirm-dialog">
        <h2 id="bulk-confirm-title" className="bulk-confirm-title">
          {danger && <span className="bulk-confirm-danger-icon" aria-hidden="true">⚠️</span>}
          {actionLabel} {items.length} {items.length === 1 ? 'item' : 'items'}?
        </h2>

        {hasProductionWarning && (
          <div className="bulk-confirm-warning" role="alert">
            <span className="bulk-confirm-warning-icon" aria-hidden="true">⚠️</span>
            <span>Some resources are in production or kube-system namespaces. Please review carefully.</span>
          </div>
        )}

        <div className="bulk-confirm-items-container">
          <p className="bulk-confirm-subtitle">The following resources will be affected:</p>
          <ul className="bulk-confirm-items-list" data-testid="bulk-confirm-items">
            {items.slice(0, 10).map((item, idx) => (
              <li key={item.key || `${item.namespace || ''}/${item.name}` || idx} className="bulk-confirm-item">
                {item.namespace && <span className="bulk-confirm-namespace">{item.namespace}/</span>}
                <span className="bulk-confirm-name">{item.name}</span>
              </li>
            ))}
            {items.length > 10 && (
              <li className="bulk-confirm-item bulk-confirm-more">
                ... and {items.length - 10} more
              </li>
            )}
          </ul>
        </div>

        {requireTypedCount && (
          <div className="bulk-confirm-typed">
            <label htmlFor="bulk-confirm-count">
              Type <strong>{items.length}</strong> to confirm:
            </label>
            <input
              id="bulk-confirm-count"
              ref={inputRef}
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={String(items.length)}
              className="bulk-confirm-input"
              data-testid="bulk-confirm-input"
              autoComplete="off"
            />
          </div>
        )}

        <div className="bulk-confirm-actions">
          <button
            type="button"
            className="bulk-confirm-cancel"
            onClick={onCancel}
            data-testid="bulk-confirm-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className={`bulk-confirm-submit ${danger ? 'bulk-confirm-submit-danger' : ''}`}
            onClick={handleConfirm}
            disabled={!isConfirmEnabled}
            data-testid="bulk-confirm-submit"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
