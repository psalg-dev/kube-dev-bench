import { useState, useCallback, useEffect, useRef } from 'react';
import './BulkProgressDialog.css';

/**
 * Progress dialog for tracking bulk operation execution.
 * Shows per-item status with retry support for failed items.
 * @param {boolean} open - Whether the dialog is open
 * @param {string} title - Dialog title
 * @param {Array} items - Array of items with their status: { key, name, namespace?, status: 'pending'|'running'|'success'|'error', error? }
 * @param {number} completed - Number of completed items
 * @param {number} total - Total number of items
 * @param {function} onRetryFailed - Callback to retry failed items
 * @param {function} onClose - Callback to close the dialog (only enabled when complete)
 */
export default function BulkProgressDialog({
  open,
  title = 'Processing',
  items = [],
  completed = 0,
  total = 0,
  onRetryFailed,
  onClose,
}) {
  const dialogRef = useRef(null);
  const listRef = useRef(null);

  const successCount = items.filter(item => item.status === 'success').length;
  const errorCount = items.filter(item => item.status === 'error').length;
  const isComplete = completed >= total && total > 0;
  const hasErrors = errorCount > 0;

  // Auto-scroll to show latest progress
  useEffect(() => {
    if (listRef.current) {
      const runningItem = listRef.current.querySelector('.bulk-progress-item-running');
      if (runningItem && typeof runningItem.scrollIntoView === 'function') {
        runningItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [items]);

  // Handle escape key (only when complete)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isComplete) {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, isComplete, onClose]);

  const handleRetry = useCallback(() => {
    if (onRetryFailed) {
      onRetryFailed();
    }
  }, [onRetryFailed]);

  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <span className="bulk-progress-icon bulk-progress-success" aria-label="Success">✓</span>;
      case 'error':
        return <span className="bulk-progress-icon bulk-progress-error" aria-label="Error">✗</span>;
      case 'running':
        return <span className="bulk-progress-icon bulk-progress-running" aria-label="Running">⟳</span>;
      default:
        return <span className="bulk-progress-icon bulk-progress-pending" aria-label="Pending">○</span>;
    }
  };

  if (!open) return null;

  return (
    <div
      className="bulk-progress-overlay"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-progress-title"
    >
      <div className="bulk-progress-dialog">
        <h2 id="bulk-progress-title" className="bulk-progress-title">
          {title}
        </h2>

        <div className="bulk-progress-bar-container">
          <div className="bulk-progress-bar">
            <div
              className={`bulk-progress-bar-fill ${hasErrors ? 'bulk-progress-bar-errors' : ''}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="bulk-progress-bar-text">
            {completed} / {total} ({progressPercent}%)
          </span>
        </div>

        <div className="bulk-progress-items-container" ref={listRef}>
          <ul className="bulk-progress-items-list" data-testid="bulk-progress-items">
            {items.map((item, idx) => {
              const itemKey = item.key || (item.namespace ? `${item.namespace}/${item.name}` : item.name) || idx;
              return (
              <li
                key={itemKey}
                className={`bulk-progress-item bulk-progress-item-${item.status}`}
              >
                <span className="bulk-progress-item-icon">
                  {getStatusIcon(item.status)}
                </span>
                <span className="bulk-progress-item-name">
                  {item.namespace && <span className="bulk-progress-namespace">{item.namespace}/</span>}
                  {item.name}
                </span>
                {item.error && (
                  <span className="bulk-progress-item-error" title={item.error}>
                    {item.error}
                  </span>
                )}
              </li>
              );
            })}
          </ul>
        </div>

        {isComplete && (
          <div className="bulk-progress-summary">
            <span className="bulk-progress-summary-success">{successCount} succeeded</span>
            {hasErrors && (
              <span className="bulk-progress-summary-error">{errorCount} failed</span>
            )}
          </div>
        )}

        <div className="bulk-progress-actions">
          {isComplete && hasErrors && onRetryFailed && (
            <button
              type="button"
              className="bulk-progress-retry"
              onClick={handleRetry}
              data-testid="bulk-progress-retry"
            >
              Retry Failed
            </button>
          )}
          <button
            type="button"
            className="bulk-progress-close"
            onClick={onClose}
            disabled={!isComplete}
            data-testid="bulk-progress-close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
