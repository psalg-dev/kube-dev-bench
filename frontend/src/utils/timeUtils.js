/**
 * Time utility functions
 */

/**
 * Format a timestamp as a human-readable age string
 * @param {string|Date} timestamp - The timestamp to format
 * @returns {string} Human-readable age (e.g., "5m", "2h", "3d")
 */
export function formatAge(timestamp) {
  if (!timestamp) return '-';

  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;

  if (isNaN(diffMs)) return '-';

  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d`;
  } else if (diffHours > 0) {
    return `${diffHours}h`;
  } else if (diffMins > 0) {
    return `${diffMins}m`;
  } else {
    return `${diffSecs}s`;
  }
}

/**
 * Format a timestamp as a relative time string
 * @param {string|Date} timestamp - The timestamp to format
 * @returns {string} Relative time (e.g., "5 minutes ago", "2 hours ago")
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return '-';

  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;

  if (isNaN(diffMs)) return '-';

  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 1) {
    return `${diffDays} days ago`;
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffHours > 1) {
    return `${diffHours} hours ago`;
  } else if (diffHours === 1) {
    return '1 hour ago';
  } else if (diffMins > 1) {
    return `${diffMins} minutes ago`;
  } else if (diffMins === 1) {
    return '1 minute ago';
  } else {
    return 'just now';
  }
}
