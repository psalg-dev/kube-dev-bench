import './EmptyState.css';

const EMPTY_STATE_ICONS = {
  files: '📁',
  data: '📊',
  error: '⚠️',
  search: '🔍',
  container: '📦',
  network: '🌐',
  storage: '💾',
  config: '⚙️',
  secret: '🔐',
  pod: '🐋',
  service: '🔌',
  default: '📭',
};

/**
 * EmptyState component for displaying empty/no-data states.
 * 
 * @param {Object} props
 * @param {string} [props.icon] - Icon key from EMPTY_STATE_ICONS or a custom emoji/character
 * @param {string} [props.title] - Main title text
 * @param {string} [props.message] - Secondary message text
 * @param {string} [props.hint] - Hint text with suggestions
 * @param {Function} [props.onAction] - Action button click handler
 * @param {string} [props.actionLabel] - Action button label
 * @param {string} [props.className] - Additional CSS class name
 */
export function EmptyState({
  icon,
  title,
  message,
  hint,
  onAction,
  actionLabel,
  className = '',
}) {
  const displayIcon = EMPTY_STATE_ICONS[icon] || icon || EMPTY_STATE_ICONS.default;

  return (
    <div className={`empty-state ${className}`}>
      <div className="empty-state-icon">{displayIcon}</div>
      {title && <div className="empty-state-title">{title}</div>}
      {message && <div className="empty-state-message">{message}</div>}
      {hint && <div className="empty-state-hint">{hint}</div>}
      {onAction && actionLabel && (
        <button
          type="button"
          className="empty-state-action"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
