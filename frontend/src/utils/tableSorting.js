const UNIT_SECONDS = {
  y: 31536000,
  mo: 2592000,
  w: 604800,
  d: 86400,
  h: 3600,
  m: 60,
  s: 1,
};

export const getColumnKey = (column) => {
  const key = column?.accessorKey ?? column?.key ?? column?.id ?? column?.name;
  return key ? String(key) : '';
};

const getColumnLabel = (column) => {
  const label =
    column?.label ?? column?.header ?? column?.title ?? column?.name;
  return label ? String(label) : '';
};

export const pickDefaultSortKey = (columns = []) => {
  if (!Array.isArray(columns) || columns.length === 0) return '';

  const byAge = columns.find((col) => {
    const key = getColumnKey(col).toLowerCase();
    const label = getColumnLabel(col).toLowerCase();
    return key.includes('age') || label.includes('age');
  });
  if (byAge) return getColumnKey(byAge);

  const byName = columns.find((col) => {
    const key = getColumnKey(col).toLowerCase();
    const label = getColumnLabel(col).toLowerCase();
    return key.includes('name') || label.includes('name');
  });
  if (byName) return getColumnKey(byName);

  return getColumnKey(columns[0]);
};

const parseDurationToSeconds = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const str = String(value).trim().toLowerCase();
  if (!str) return null;

  let total = 0;
  let matched = false;
  const regex = /(\d+(?:\.\d+)?)\s*(y|mo|w|d|h|m|s)\b/g;
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

const normalizeSortValue = (value, sortKey) => {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 1 : 0;

  const key = String(sortKey || '').toLowerCase();
  if (
    key.includes('age') ||
    key.includes('uptime') ||
    key.includes('duration')
  ) {
    const duration = parseDurationToSeconds(value);
    if (duration !== null) return duration;
  }

  const str = String(value).trim();
  if (!str) return null;

  const numeric = Number(str);
  if (!Number.isNaN(numeric)) return numeric;

  const parsedDate = Date.parse(str);
  if (!Number.isNaN(parsedDate)) return parsedDate;

  return str.toLowerCase();
};

const compareValues = (a, b) => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
};

export const sortRows = (rows, sortKey, direction = 'asc', getValue) => {
  if (!Array.isArray(rows)) return [];
  if (!sortKey) return rows;

  const dir = direction === 'desc' ? -1 : 1;
  const valueGetter =
    typeof getValue === 'function' ? getValue : (row, key) => row?.[key];

  return rows
    .map((row, idx) => ({ row, idx }))
    .sort((a, b) => {
      const aValue = normalizeSortValue(valueGetter(a.row, sortKey), sortKey);
      const bValue = normalizeSortValue(valueGetter(b.row, sortKey), sortKey);
      const cmp = compareValues(aValue, bValue);
      if (cmp !== 0) return cmp * dir;
      return a.idx - b.idx;
    })
    .map((item) => item.row);
};

export const toggleSortState = (current, key) => {
  if (!key) return current;
  if (current?.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: 'asc' };
};
