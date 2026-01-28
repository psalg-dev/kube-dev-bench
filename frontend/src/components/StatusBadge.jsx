/* eslint-disable react-refresh/only-export-components */
import './StatusBadge.css';

/**
 * Status color mapping for various resource states.
 * Provides consistent visual representation across the application.
 */
const STATUS_COLORS = {
  // Success states
  running: '#3fb950',
  ready: '#3fb950',
  available: '#3fb950',
  active: '#3fb950',
  healthy: '#3fb950',
  complete: '#3fb950',
  succeeded: '#3fb950',
  bound: '#3fb950',
  deployed: '#3fb950',

  // Warning states
  pending: '#d29922',
  creating: '#d29922',
  preparing: '#d29922',
  starting: '#d29922',
  waiting: '#d29922',
  initializing: '#d29922',
  terminating: '#d29922',
  suspended: '#d29922',
  pause: '#d29922',
  paused: '#d29922',
  uninstalling: '#d29922',

  // Error states
  failed: '#f85149',
  error: '#f85149',
  crashloopbackoff: '#f85149',
  imagepullbackoff: '#f85149',
  errpullimage: '#f85149',
  rejected: '#f85149',
  lost: '#f85149',
  inactive: '#f85149',
  deleted: '#f85149',
  down: '#f85149',
  notready: '#f85149',
  drain: '#f85149',
  stopped: '#f85149',

  // Neutral/Unknown states
  unknown: '#8b949e',
  released: '#8b949e',
  terminated: '#8b949e',
  superseded: '#8b949e',
};

/**
 * Get the color for a given status.
 * @param {string} status - The status string
 * @returns {string} The hex color code
 */
function getStatusColor(status) {
  if (!status) return STATUS_COLORS.unknown;
  const normalized = status.toLowerCase().replace(/[\s-_]/g, '');
  return STATUS_COLORS[normalized] || STATUS_COLORS.unknown;
}

function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#'))
    return `rgba(110,118,129,${alpha})`;
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) return `rgba(110,118,129,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((c) => Number.isNaN(c)))
    return `rgba(110,118,129,${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * StatusBadge component for displaying resource status with consistent styling.
 *
 * @param {Object} props
 * @param {string} props.status - The status text to display
 * @param {('small'|'medium'|'large')} [props.size='medium'] - Badge size
 * @param {boolean} [props.showDot=true] - Whether to show the status dot
 * @param {string} [props.className] - Additional CSS class name
 */
export function StatusBadge({
  status,
  size = 'medium',
  showDot = true,
  className = '',
}) {
  const color = getStatusColor(status);
  const bgColor = hexToRgba(color, 0.16);
  const borderColor = hexToRgba(color, 0.4);
  const displayStatus = status || 'Unknown';

  const sizeClass = size !== 'medium' ? `status-badge-${size}` : '';

  return (
    <span
      className={`status-badge status-badge-component ${sizeClass} ${className}`}
      style={{
        color,
        background: bgColor,
        border: `1px solid ${borderColor}`,
      }}
    >
      {showDot && (
        <span className="status-dot" style={{ backgroundColor: color }} />
      )}
      <span className={`status-text ${className}`} style={{ color }}>
        {displayStatus}
      </span>
    </span>
  );
}

/**
 * Get the status color for use in other components.
 * Useful when you need just the color without the full badge.
 *
 * @param {string} status - The status string
 * @returns {string} The hex color code
 */
export { getStatusColor };

export default StatusBadge;
