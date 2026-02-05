/**
 * Tests for useTableSelection hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useTableSelection from '../hooks/useTableSelection';

type Row = { id: string; name: string };

function createRows(count: number): Row[] {
  return Array.from({ length: count }, (_, idx) => ({ id: `row-${idx + 1}`, name: `Row ${idx + 1}` }));
}

function getRowKey(row: Row): string {
  return row.id;
}

describe('useTableSelection', () => {
  it('initializes with no selection', () => {
    const data = createRows(3);
    const { result } = renderHook(() => useTableSelection(data, getRowKey));

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isIndeterminate).toBe(false);
  });

  it('toggles a row selection on/off', () => {
    const data = createRows(3);
    const { result } = renderHook(() => useTableSelection(data, getRowKey));

    act(() => {
      result.current.toggleRow('row-1', 0, false);
    });

    expect(result.current.selectedCount).toBe(1);
    expect(result.current.isSelected('row-1')).toBe(true);

    act(() => {
      result.current.toggleRow('row-1', 0, false);
    });

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isSelected('row-1')).toBe(false);
  });

  it('selects a range when rangeSelect is true', async () => {
    const data = createRows(4);
    const { result } = renderHook(() => useTableSelection(data, getRowKey));

    act(() => {
      result.current.toggleRow('row-1', 0, false);
    });

    act(() => {
      result.current.toggleRow('row-3', 2, true);
    });

    await waitFor(() => {
      expect(result.current.selectedCount).toBeGreaterThanOrEqual(2);
    });
    expect(result.current.isSelected('row-1')).toBe(true);
    expect(result.current.isSelected('row-3')).toBe(true);
  });

  it('handles range selection when index is omitted', () => {
    const data = createRows(3);
    const { result } = renderHook(() => useTableSelection(data, getRowKey));

    act(() => {
      result.current.toggleRow('row-1');
    });

    act(() => {
      result.current.toggleRow('row-2', undefined, true);
    });

    expect(result.current.selectedCount).toBe(2);
    expect(result.current.isSelected('row-1')).toBe(true);
    expect(result.current.isSelected('row-2')).toBe(true);
  });

  it('toggles all visible rows', () => {
    const data = createRows(3);
    const visibleData = data.slice(0, 2);
    const { result } = renderHook(() => useTableSelection(data, getRowKey, visibleData));

    act(() => {
      result.current.toggleAll();
    });

    expect(result.current.selectedCount).toBe(2);
    expect(result.current.isAllSelected).toBe(true);

    act(() => {
      result.current.toggleAll();
    });

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
  });

  it('clears selection state', () => {
    const data = createRows(2);
    const { result } = renderHook(() => useTableSelection(data, getRowKey));

    act(() => {
      result.current.toggleRow('row-1', 0, false);
      result.current.toggleRow('row-2', 1, false);
    });

    expect(result.current.selectedCount).toBe(2);

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isIndeterminate).toBe(false);
  });
});
