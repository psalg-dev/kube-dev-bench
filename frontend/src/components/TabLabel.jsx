import React from 'react';
import './TabLabel.css';

/**
 * TabLabel component for displaying tab labels with optional count badges.
 * Shows count in a badge format and applies muted styling when count is 0.
 *
 * @param {Object} props
 * @param {string} props.label - The tab label text
 * @param {number} [props.count] - Optional count to display in badge
 * @param {boolean} [props.loading] - Whether the count is currently loading
 * @param {boolean} [props.showCount] - Whether to show the count (default: true if count is defined)
 * @param {string} [props.className] - Additional CSS class name
 */
export function TabLabel({
  label,
  count,
  loading = false,
  showCount = true,
  className = '',
}) {
  const hasCount = typeof count === 'number' && showCount;
  const isEmpty = hasCount && count === 0;
  // Only show loading indicator when we don't have a count yet
  // If we already have a count, keep showing it during refresh to prevent flicker
  const showLoadingIndicator = loading && showCount && !hasCount;

  return (
    <span className={`tab-label ${isEmpty ? 'tab-label-muted' : ''} ${className}`}>
      <span className="tab-label-text">{label}</span>
      {showLoadingIndicator && (
        <span className="tab-count tab-count-loading" aria-label="Loading count">
          ...
        </span>
      )}
      {hasCount && (
        <span 
          className={`tab-count ${isEmpty ? 'tab-count-empty' : ''}`}
          aria-label={`${count} items`}
        >
          {count}
        </span>
      )}
    </span>
  );
}

export default TabLabel;
