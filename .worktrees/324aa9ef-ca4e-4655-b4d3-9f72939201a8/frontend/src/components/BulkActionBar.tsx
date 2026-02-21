import './BulkActionBar.css';
type BulkActionBarProps = {
  selectedCount: number;
  actions?: BulkAction[];
  onAction?: (_action: BulkAction) => void | Promise<void>;
  onClear?: () => void;
  className?: string;
};
export default function BulkActionBar({
  selectedCount,
  actions = [],
  onAction,
  onClear,
  className = '',
}: BulkActionBarProps) {
  if (!selectedCount) return null;

  const safeActions = Array.isArray(actions) ? actions.filter(Boolean) : [];

  return (
    <div className={`bulk-action-bar ${className}`.trim()}>
      <span className="bulk-action-count">{selectedCount} selected</span>
      <div className="bulk-action-buttons">
        {safeActions.map((action) => (
          <button
            key={action.key || action.label}
            type="button"
            className={`bulk-action-button ${action.danger ? 'danger' : ''}`.trim()}
            disabled={Boolean(action.disabled)}
            title={action.title || ''}
            onClick={() => {
              if (action.disabled) return;
              onAction?.(action);
            }}
          >
            {action.icon ? (
              <span className="bulk-action-icon" aria-hidden="true">
                {action.icon}
              </span>
            ) : null}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className="bulk-action-clear" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
