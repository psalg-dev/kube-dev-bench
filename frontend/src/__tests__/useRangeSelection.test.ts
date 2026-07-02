import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { computeRange, useRangeSelection } from '../components/DataTable/useRangeSelection';

describe('computeRange', () => {
  it('returns inclusive range when anchor is before target', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const result = computeRange(ids, 'b', 'd');
    expect(result).toEqual(['b', 'c', 'd']);
  });

  it('returns inclusive range when anchor is after target', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const result = computeRange(ids, 'd', 'b');
    expect(result).toEqual(['b', 'c', 'd']);
  });

  it('returns same range regardless of anchor/target order', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const forward = computeRange(ids, 'a', 'c');
    const backward = computeRange(ids, 'c', 'a');
    expect(forward).toEqual(backward);
  });

  it('returns [targetId] when anchor is null', () => {
    const ids = ['a', 'b', 'c'];
    const result = computeRange(ids, null, 'b');
    expect(result).toEqual(['b']);
  });

  it('returns [targetId] when anchor is not in list', () => {
    const ids = ['a', 'b', 'c'];
    const result = computeRange(ids, 'x', 'b');
    expect(result).toEqual(['b']);
  });

  it('returns [id] for single-element list', () => {
    const ids = ['a'];
    const result = computeRange(ids, 'a', 'a');
    expect(result).toEqual(['a']);
  });

  it('returns [targetId] when anchor and target are same', () => {
    const ids = ['a', 'b', 'c'];
    const result = computeRange(ids, 'b', 'b');
    expect(result).toEqual(['b']);
  });

  it('returns [targetId] when target not in list', () => {
    const ids = ['a', 'b', 'c'];
    const result = computeRange(ids, 'a', 'x');
    expect(result).toEqual(['x']);
  });
});

describe('useRangeSelection', () => {
  it('initializes with null anchor', () => {
    const { result } = renderHook(() => useRangeSelection());
    expect(result.current.anchorId).toBeNull();
  });

  it('setAnchor updates anchorId', () => {
    const { result } = renderHook(() => useRangeSelection());
    act(() => {
      result.current.setAnchor('a');
    });
    expect(result.current.anchorId).toBe('a');
  });

  it('rangeTo returns [targetId] when anchor is null', () => {
    const { result } = renderHook(() => useRangeSelection());
    const ids = ['a', 'b', 'c'];
    const range = result.current.rangeTo(ids, 'b');
    expect(range).toEqual(['b']);
  });

  it('rangeTo returns inclusive range between anchor and target', () => {
    const { result } = renderHook(() => useRangeSelection());
    const ids = ['a', 'b', 'c', 'd'];
    act(() => {
      result.current.setAnchor('b');
    });
    const range = result.current.rangeTo(ids, 'd');
    expect(range).toEqual(['b', 'c', 'd']);
  });

  it('rangeTo reflects anchor updates across calls', () => {
    const { result } = renderHook(() => useRangeSelection());
    const ids = ['a', 'b', 'c', 'd', 'e'];

    act(() => {
      result.current.setAnchor('b');
    });
    expect(result.current.rangeTo(ids, 'd')).toEqual(['b', 'c', 'd']);

    act(() => {
      result.current.setAnchor('d');
    });
    expect(result.current.rangeTo(ids, 'b')).toEqual(['b', 'c', 'd']);
  });

  it('setAnchor can clear anchor to null', () => {
    const { result } = renderHook(() => useRangeSelection());
    const ids = ['a', 'b', 'c'];

    act(() => {
      result.current.setAnchor('a');
    });
    expect(result.current.anchorId).toBe('a');

    act(() => {
      result.current.setAnchor(null);
    });
    expect(result.current.anchorId).toBeNull();
    expect(result.current.rangeTo(ids, 'b')).toEqual(['b']);
  });
});
