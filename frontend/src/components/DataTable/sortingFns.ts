import type { SortingFn } from '@tanstack/react-table';

export type ColumnSortType = 'text' | 'number' | 'duration' | 'datetime';

// ponytail: dedupe with tableSorting once raw engine is deleted
const UNIT_SECONDS: Record<string, number> = {
  y: 31536000,
  mo: 2592000,
  w: 604800,
  d: 86400,
  h: 3600,
  m: 60,
  s: 1,
};

/**
 * Parse duration strings like "5m", "1h", "2d", "1d2h30m" to seconds.
 * Handles numeric values as-is (treated as seconds).
 * Returns null if unparseable.
 */
const parseDurationToSeconds = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const str = String(value).trim().toLowerCase();
  if (!str) return null;

  let total = 0;
  let matched = false;
  // Use negative lookahead to prevent matching units followed by letters (e.g., "mo" in "month")
  const regex = /(\d+(?:\.\d+)?)\s*(y|mo|w|d|h|m|s)(?![a-z])/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    matched = true;
    const amount = Number(match[1]);
    const unit = match[2];
    const multiplier = UNIT_SECONDS[unit] || 0;
    total += amount * multiplier;
  }

  if (matched) return total;

  const numeric = Number(str);
  if (!Number.isNaN(numeric)) return numeric;

  return null;
};

/**
 * Normalize a value for comparison, handling special cases by type.
 * Returns null for null/undefined/empty, number for numeric values,
 * timestamp for dates, lowercase string for text.
 */
const normalizeSortValue = (value: unknown): number | string | null => {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 1 : 0;

  const str = String(value).trim();
  if (!str) return null;

  const numeric = Number(str);
  if (!Number.isNaN(numeric)) return numeric;

  const parsedDate = Date.parse(str);
  if (!Number.isNaN(parsedDate)) return parsedDate;

  return str.toLowerCase();
};

/**
 * Compare two normalized values, with nulls sorting last.
 */
const compareValues = (a: unknown, b: unknown): number => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

/**
 * Sort by text using locale-aware comparison with numeric sensitivity.
 * Nulls and empty strings sort last.
 */
export const textSortingFn: SortingFn<unknown> = (rowA, rowB, columnId) => {
  const aValue = normalizeSortValue(rowA.getValue(columnId));
  const bValue = normalizeSortValue(rowB.getValue(columnId));
  return compareValues(aValue, bValue);
};

/**
 * Sort by number, comparing numeric strings numerically (not lexically).
 * Nulls and empty strings sort last.
 */
export const numberSortingFn: SortingFn<unknown> = (rowA, rowB, columnId) => {
  const aValue = normalizeSortValue(rowA.getValue(columnId));
  const bValue = normalizeSortValue(rowB.getValue(columnId));
  return compareValues(aValue, bValue);
};

/**
 * Sort by duration, parsing duration strings like "5m", "1h", "2d" to seconds.
 * Nulls and empty strings sort last. Unparseable strings fall back to text comparison.
 */
export const durationSortingFn: SortingFn<unknown> = (rowA, rowB, columnId) => {
  const aRaw = rowA.getValue(columnId);
  const bRaw = rowB.getValue(columnId);

  // Handle nulls and empty strings
  const aIsEmpty = aRaw === null || aRaw === undefined || aRaw === '';
  const bIsEmpty = bRaw === null || bRaw === undefined || bRaw === '';

  if (aIsEmpty && bIsEmpty) return 0;
  if (aIsEmpty) return 1;
  if (bIsEmpty) return -1;

  // Try parsing as durations
  const aSeconds = parseDurationToSeconds(aRaw);
  const bSeconds = parseDurationToSeconds(bRaw);

  // If both parsed, compare numerically
  if (aSeconds !== null && bSeconds !== null) {
    return aSeconds - bSeconds;
  }

  // If one parsed and one didn't, parsed comes first
  if (aSeconds !== null) return -1;
  if (bSeconds !== null) return 1;

  // Both failed to parse, fall back to text comparison
  const aValue = normalizeSortValue(aRaw);
  const bValue = normalizeSortValue(bRaw);
  return compareValues(aValue, bValue);
};

/**
 * Sort by datetime, parsing ISO datetime strings and timestamps.
 * Nulls and empty strings sort last.
 */
export const datetimeSortingFn: SortingFn<unknown> = (rowA, rowB, columnId) => {
  const aRaw = rowA.getValue(columnId);
  const bRaw = rowB.getValue(columnId);

  // Handle nulls and empty strings
  const aIsEmpty = aRaw === null || aRaw === undefined || aRaw === '';
  const bIsEmpty = bRaw === null || bRaw === undefined || bRaw === '';

  if (aIsEmpty && bIsEmpty) return 0;
  if (aIsEmpty) return 1;
  if (bIsEmpty) return -1;

  // Handle numeric timestamps directly
  if (typeof aRaw === 'number' && typeof bRaw === 'number') {
    return aRaw - bRaw;
  }

  // Try parsing as datetime
  const aValue = normalizeSortValue(aRaw);
  const bValue = normalizeSortValue(bRaw);
  return compareValues(aValue, bValue);
};

/**
 * Get the sorting function for a given sort type.
 */
export const sortTypeToFn = (type: ColumnSortType): SortingFn<unknown> => {
  switch (type) {
    case 'text':
      return textSortingFn;
    case 'number':
      return numberSortingFn;
    case 'duration':
      return durationSortingFn;
    case 'datetime':
      return datetimeSortingFn;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
};
