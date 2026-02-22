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

type EmptyTabIconKey = keyof typeof EMPTY_TAB_ICONS;

interface EmptyTabContentProps {
  icon?: EmptyTabIconKey | string;
  title?: string;
  description?: string;
  tip?: string;
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
}

/**
 * EmptyTabContent component for displaying helpful empty states in tabs.
 * Provides consistent styling and messaging across all empty tab states.
 */
export function EmptyTabContent({
  icon,
  title,
  description,
  tip,
  onAction,
  actionLabel,
  className = '',
}: EmptyTabContentProps) {
  const displayIcon = EMPTY_TAB_ICONS[icon as EmptyTabIconKey] || icon || EMPTY_TAB_ICONS.default;

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
