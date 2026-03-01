import './EmptyTabContent.css';

/**
 * Icon map for empty tab content icons.
 * Supports both K8s and Swarm resource types.
 */
const EMPTY_TAB_ICONS = {
  // K8s icons
  events: '📋',
  pods: '🐋',
  consumers: '🔗',
  endpoints: '🔌',
  history: '📜',
  rules: '📐',
  pvcs: '💾',
  data: '📊',
  default: '📭',
  // Swarm icons (mapped from icon strings in emptyTabMessages)
  services: '🐳',
  tasks: '📦',
  containers: '🐋',
  networks: '🌐',
  volumes: '💾',
  configs: '⚙️',
  secrets: '🔐',
  logs: '📜',
  exec: '💻',
  env: '📝',
  mounts: '💾',
  ports: '🔌',
  constraints: '📐',
  usedby: '🔗',
  options: '⚙️',
  ipam: '🌐',
};

/**
 * EmptyTabContent component for displaying helpful empty states in tabs.
 * Provides consistent styling and messaging across all empty tab states.
 *
 * @param {Object} props
 * @param {string} [props.icon] - Icon key from EMPTY_TAB_ICONS or a custom emoji/character
 * @param {string} [props.title] - Main title text (e.g., "No events recorded")
 * @param {string} [props.description] - Secondary description text
 * @param {string} [props.tip] - Helpful tip or suggestion
 * @param {Function} [props.onAction] - Action button click handler
 * @param {string} [props.actionLabel] - Action button label
 * @param {string} [props.className] - Additional CSS class name
 */
export function EmptyTabContent({
  icon,
  title,
  description,
  tip,
  onAction,
  actionLabel,
  className = '',
}) {
  const displayIcon = EMPTY_TAB_ICONS[icon] || icon || EMPTY_TAB_ICONS.default;

  return (
    <div className={`empty-tab-content ${className}`}>
      <div className="empty-tab-icon">{displayIcon}</div>
      {title && <div className="empty-tab-title">{title}</div>}
      {description && <div className="empty-tab-description">{description}</div>}
      {tip && <div className="empty-tab-tip">{tip}</div>}
      {onAction && actionLabel && (
        <button
          type="button"
          className="empty-tab-action"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyTabContent;
