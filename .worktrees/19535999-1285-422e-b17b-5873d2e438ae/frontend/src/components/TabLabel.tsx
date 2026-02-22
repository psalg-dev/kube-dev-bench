import './TabLabel.css';

type TabLabelProps = {
  label: string;
  count?: number;
  loading?: boolean;
  showCount?: boolean;
  className?: string;
};

/**
 * TabLabel component for displaying tab labels with optional count badges.
 * Shows count in a badge format and applies muted styling when count is 0.
 */
export function TabLabel({
  label,
  count,
  loading = false,
  showCount = true,
  className = '',
}: TabLabelProps) {
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
