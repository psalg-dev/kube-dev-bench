import { useCallback, useMemo } from 'react';
import { getBulkActions } from '../constants/bulkActions';
import './BulkActionBar.css';

/**
 * Bulk action toolbar displayed when rows are selected.
 * @param {number} selectedCount - Number of selected rows
 * @param {Array} actions - Array of action definitions: { key, label, icon?, danger?, onClick }
 * @param {function} onClearSelection - Callback to clear selection
 * @param {boolean} disabled - Whether actions are disabled (e.g., during execution)
 * @param {'default'|'compact'} variant - Visual variant for layout
 * @param {string} resourceKind - Resource kind for auto-generated actions
 * @param {'k8s'|'swarm'} platform - Platform for auto-generated actions
 * @param {function} onActionSelect - Callback for auto-generated actions
 */
export default function BulkActionBar({
  selectedCount,
  actions = [],
  onClearSelection,
  disabled = false,
  variant = 'default',
  resourceKind,
  platform = 'k8s',
  onActionSelect
}) {
  const handleClear = useCallback((e) => {
    e.preventDefault();
    if (typeof onClearSelection === 'function') {
      onClearSelection();
    }
  }, [onClearSelection]);

  const resolvedActions = useMemo(() => {
    if (Array.isArray(actions) && actions.length > 0) return actions;
    if (!resourceKind || typeof onActionSelect !== 'function') return [];
    return getBulkActions(platform, resourceKind).map((action) => ({
      ...action,
      id: action.key,
      onClick: () => {
        if (action.promptReplicas) {
          const input = window.prompt('Enter desired replicas', '1');
          if (input === null) return;
          const replicas = Number.parseInt(input, 10);
          if (Number.isNaN(replicas)) return;
          onActionSelect({ ...action, id: action.key }, { replicas });
          return;
        }
        onActionSelect({ ...action, id: action.key });
      }
    }));
  }, [actions, platform, resourceKind, onActionSelect]);

  if (selectedCount === 0) return null;

  return (
    <div
      className={`bulk-action-bar${variant === 'compact' ? ' bulk-action-bar--compact' : ''}`}
      role="toolbar"
      aria-label="Bulk actions"
    >
      <span className="bulk-action-count" data-testid="bulk-action-count">
        {selectedCount} selected
      </span>
      
      <div className="bulk-action-buttons">
        {resolvedActions.map((action) => (
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
