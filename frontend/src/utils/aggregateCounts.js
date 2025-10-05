// Utility functions for aggregating Kubernetes resource & pod status counts.
// Keeping pure & side-effect free for easy unit testing.

/**
 * Aggregate a list of pod status count objects into a single totals object.
 * Each object may contain: running, pending, failed, succeeded, unknown, total.
 * Missing fields or null entries are treated as zeros.
 * @param {Array<Object|null|undefined>} countsList
 * @returns {{running:number,pending:number,failed:number,succeeded:number,unknown:number,total:number}}
 */
export function aggregatePodStatusCounts(countsList) {
  const base = { running: 0, pending: 0, failed: 0, succeeded: 0, unknown: 0, total: 0 };
  if (!Array.isArray(countsList)) return base;
  return countsList.filter(Boolean).reduce((acc, c) => ({
    running: acc.running + (c.running || 0),
    pending: acc.pending + (c.pending || 0),
    failed: acc.failed + (c.failed || 0),
    succeeded: acc.succeeded + (c.succeeded || 0),
    unknown: acc.unknown + (c.unknown || 0),
    total: acc.total + (c.total || 0),
  }), base);
}

/**
 * Produce a stable signature string for an aggregated pod status counts object.
 * Can be used to cheaply detect changes.
 * @param {{running:number,pending:number,failed:number,succeeded:number,unknown:number,total:number}} agg
 * @returns {string}
 */
export function podAggSignature(agg) {
  if (!agg) return '0-0-0-0-0-0';
  return [agg.running, agg.pending, agg.failed, agg.succeeded, agg.unknown, agg.total].join('-');
}

/**
 * Flatten an array-of-arrays (list of resource lists) into a total length.
 * Non-array entries are ignored.
 * @param {Array<any>} lists
 * @returns {number}
 */
export function flattenLength(lists) {
  if (!Array.isArray(lists)) return 0;
  return lists.reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
}

