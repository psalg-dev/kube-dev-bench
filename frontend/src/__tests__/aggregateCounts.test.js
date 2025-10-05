import { describe, it, expect } from 'vitest';
import { aggregatePodStatusCounts, podAggSignature, flattenLength } from '../utils/aggregateCounts';

describe('aggregateCounts utilities', () => {
  it('aggregates empty list safely', () => {
    const agg = aggregatePodStatusCounts([]);
    expect(agg).toEqual({ running:0, pending:0, failed:0, succeeded:0, unknown:0, total:0 });
    expect(podAggSignature(agg)).toBe('0-0-0-0-0-0');
  });

  it('aggregates null & undefined entries gracefully', () => {
    const agg = aggregatePodStatusCounts([null, undefined]);
    expect(agg.total).toBe(0);
  });

  it('sums multiple count objects', () => {
    const agg = aggregatePodStatusCounts([
      { running: 2, pending: 1, failed: 0, succeeded: 0, unknown: 0, total: 3 },
      { running: 1, pending: 0, failed: 1, succeeded: 0, unknown: 0, total: 2 }
    ]);
    expect(agg).toEqual({ running:3, pending:1, failed:1, succeeded:0, unknown:0, total:5 });
    expect(podAggSignature(agg)).toBe('3-1-1-0-0-5');
  });

  it('flattenLength returns 0 for non-array', () => {
    expect(flattenLength(null)).toBe(0);
  });

  it('flattenLength sums nested arrays', () => {
    expect(flattenLength([[1,2,3], ['a'], [], [4,5]])).toBe(3 + 1 + 0 + 2);
  });
});

