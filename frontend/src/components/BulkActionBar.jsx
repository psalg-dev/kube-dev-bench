import { useCallback } from 'react';
import './BulkActionBar.css';

/**
 * Bulk action toolbar displayed when rows are selected.
 * @param {number} selectedCount - Number of selected rows
 * @param {Array} actions - Array of action definitions: { key, label, icon?, danger?, onClick }
 * @param {function} onClearSelection - Callback to clear selection
 * @param {boolean} disabled - Whether actions are disabled (e.g., during execution)
 */
export default function BulkActionBar({ selectedCount, actions = [], onClearSelection, disabled = false }) {
  const handleClear = useCallback((e) => {
    e.preventDefault();
    if (typeof onClearSelection === 'function') {
      onClearSelection();
    }
  }, [onClearSelection]);

  if (selectedCount === 0) return null;

  return (
    <div className="bulk-action-bar" role="toolbar" aria-label="Bulk actions">
      <span className="bulk-action-count" data-testid="bulk-action-count">
        {selectedCount} selected
      </span>
      
      <div className="bulk-action-buttons">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={`bulk-action-button ${action.danger ? 'bulk-action-danger' : ''}`}
            onClick={action.onClick}
            disabled={disabled || action.disabled}
            title={action.label}
            data-testid={`bulk-action-${action.key}`}
          >
            {action.icon && <span className="bulk-action-icon" aria-hidden="true">{action.icon}</span>}
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="bulk-action-clear"
        onClick={handleClear}
        disabled={disabled}
        data-testid="bulk-action-clear"
      >
        Clear selection
      </button>
    </div>
  );
}
