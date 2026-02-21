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

type EmptyStateIconKey = keyof typeof EMPTY_STATE_ICONS;

interface EmptyStateProps {
  icon?: EmptyStateIconKey | string;
  title?: string;
  message?: string;
  hint?: string;
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
}

/**
 * EmptyState component for displaying empty/no-data states.
 */
export function EmptyState({
  icon,
  title,
  message,
  hint,
  onAction,
  actionLabel,
  className = '',
}: EmptyStateProps) {
  const displayIcon = EMPTY_STATE_ICONS[icon as EmptyStateIconKey] || icon || EMPTY_STATE_ICONS.default;

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
