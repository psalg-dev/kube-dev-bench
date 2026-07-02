import type { SortingFn } from '@tanstack/react-table';

export type ColumnSortType = 'text' | 'number' | 'duration' | 'datetime';

// Parse duration strings like "5m", "2h", "1d" to milliseconds
function parseDuration(str: string): number {
  const match = String(str).match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/i);
  if (!match) return 0;
  const [, num, unit] = match;
  const value = parseFloat(num);
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  return value * (multipliers[unit.toLowerCase()] || 0);
}

export const textSortingFn: SortingFn<unknown> = (rowA, rowB, columnId) => {
  const a = String(rowA.getValue(columnId) || '').toLowerCase();
  const b = String(rowB.getValue(columnId) || '').toLowerCase();
  return a.localeCompare(b);
};

export const numberSortingFn: SortingFn<unknown> = (rowA, rowB, columnId) => {
  const a = Number(rowA.getValue(columnId)) || 0;
  const b = Number(rowB.getValue(columnId)) || 0;
  return a - b;
};

export const durationSortingFn: SortingFn<unknown> = (rowA, rowB, columnId) => {
  const a = parseDuration(String(rowA.getValue(columnId) || ''));
  const b = parseDuration(String(rowB.getValue(columnId) || ''));
  return a - b;
};

export const datetimeSortingFn: SortingFn<unknown> = (rowA, rowB, columnId) => {
  const a = new Date(String(rowA.getValue(columnId) || '')).getTime() || 0;
  const b = new Date(String(rowB.getValue(columnId) || '')).getTime() || 0;
  return a - b;
};

export function sortTypeToFn(sortType: ColumnSortType): SortingFn<unknown> {
  switch (sortType) {
    case 'text':
      return textSortingFn;
    case 'number':
      return numberSortingFn;
    case 'duration':
      return durationSortingFn;
    case 'datetime':
      return datetimeSortingFn;
    default:
      return textSortingFn;
  }
}
