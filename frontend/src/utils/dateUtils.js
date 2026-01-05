/**
 * Date formatting helpers.
 *
 * UI requirement: all displayed dates must use dd.mm.yyyy.
 * UI requirement: timestamps must use dd.mm.yyyy HH:mm:ss.
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Formats a date-like input as dd.mm.yyyy.
 *
 * Accepts ISO strings, Date objects, or epoch milliseconds.
 * Returns '-' for invalid / empty values.
 */
export function formatDateDMY(value) {
  if (!value) return '-';

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  const day = pad2(d.getDate());
  const month = pad2(d.getMonth() + 1);
  const year = String(d.getFullYear()).padStart(4, '0');

  return `${day}.${month}.${year}`;
}

/**
 * Formats a date-time-like input as dd.mm.yyyy HH:mm:ss.
 *
 * Accepts ISO strings, Date objects, or epoch milliseconds.
 * Returns '-' for invalid / empty values.
 */
export function formatTimestampDMYHMS(value) {
  if (!value) return '-';

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  const day = pad2(d.getDate());
  const month = pad2(d.getMonth() + 1);
  const year = String(d.getFullYear()).padStart(4, '0');
  const hours = pad2(d.getHours());
  const minutes = pad2(d.getMinutes());
  const seconds = pad2(d.getSeconds());

  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}
