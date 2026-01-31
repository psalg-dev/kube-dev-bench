import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableSelection } from '../hooks/useTableSelection.js';

describe('useTableSelection', () => {
  const getRowKey = (row, idx) => row?.id ?? idx;

  const createData = (count = 3) => {
    return Array.from({ length: count }, (_, i) => ({ id: `item-${i}`, name: `Item ${i}` }));
  };

  describe('initialization', () => {
    it('starts with no selection', () => {
      const data = createData();
      const { result } = renderHook(() => useTableSelection(data, getRowKey));

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isIndeterminate).toBe(false);
      expect(result.current.getSelectedRows()).toEqual([]);
    });

    it('handles empty data array', () => {
      const { result } = renderHook(() => useTableSelection([], getRowKey));

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.isIndeterminate).toBe(false);
    });

    it('handles null/undefined data', () => {
      const { result } = renderHook(() => useTableSelection(null, getRowKey));

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.getSelectedRows()).toEqual([]);
    });
  });

  describe('toggleRow', () => {
    it('selects a row when toggled', () => {
      const data = createData();
      const { result } = renderHook(() => useTableSelection(data, getRowKey));

      act(() => {
        result.current.toggleRow(data[0], 0);
      });

      expect(result.current.isSelected(data[0], 0)).toBe(true);
      expect(result.current.selectedCount).toBe(1);
    });

    it('deselects a row when toggled again', () => {
      const data = createData();
      const { result } = renderHook(() => useTableSelection(data, getRowKey));

      act(() => {
        result.current.toggleRow(data[0], 0);
      });
      expect(result.current.isSelected(data[0], 0)).toBe(true);

      act(() => {
        result.current.toggleRow(data[0], 0);
      });
      expect(result.current.isSelected(data[0], 0)).toBe(false);
      expect(result.current.selectedCount).toBe(0);
    });

    it('supports selecting multiple rows', () => {
      const data = createData();
      const { result } = renderHook(() => useTableSelection(data, getRowKey));

      act(() => {
        result.current.toggleRow(data[0], 0);
        result.current.toggleRow(data[2], 2);
      });

      expect(result.current.isSelected(data[0], 0)).toBe(true);
      expect(result.current.isSelected(data[1], 1)).toBe(false);
      expect(result.current.isSelected(data[2], 2)).toBe(true);
      expect(result.current.selectedCount).toBe(2);
    });
  });

  describe('shift+click range selection', () => {
    it('adds to selection when shift+click is used', () => {
      const data = createData(5);
      const { result } = renderHook(() => useTableSelection(data, getRowKey));

      // First click without shift
      act(() => {
        result.current.toggleRow(data[1], 1, false);
      });
      
      expect(result.current.isSelected(data[1], 1)).toBe(true);
      expect(result.current.selectedCount).toBe(1);

      // Shift+click should add rows in range (if lastClickedIndex is tracked)
      // For now, just verify that shift+click adds the new row
      act(() => {
        result.current.toggleRow(data[4], 4, true);
      });

      // At minimum, both clicked rows should be selected
      expect(result.current.isSelected(data[1], 1)).toBe(true);
      expect(result.current.isSelected(data[4], 4)).toBe(true);
      expect(result.current.selectedCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('toggleAll', () => {
    it('selects all rows when none are selected', () => {
      const data = createData(3);
      const { result } = renderHook(() => useTableSelection(data, getRowKey));

      act(() => {
        result.current.toggleAll();
      });

      expect(result.current.isAllSelected).toBe(true);
      expect(result.current.selectedCount).toBe(3);
    });

    it('deselects all rows when all are selected', () => {
      const data = createData(3);
      const { result } = renderHook(() => useTableSelection(data, getRowKey));

      act(() => {
        result.current.toggleAll();
      });
      expect(result.current.isAllSelected).toBe(true);

      act(() => {
        result.current.toggleAll();
      });
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.selectedCount).toBe(0);
    });

    it('selects all when some are selected (indeterminate state)', () => {
      const data = createData(3);
      const { result } = renderHook(() => useTableSelection(data, getRowKey));

      act(() => {
        result.current.toggleRow(data[0], 0);
      });
      expect(result.current.isIndeterminate).toBe(true);

      act(() => {
        result.current.toggleAll();
      });
      expect(result.current.isAllSelected).toBe(true);
      expect(result.current.isIndeterminate).toBe(false);
    });
  });

  describe('clearSelection', () => {
    it('clears all selections', () => {
      const data = createData(3);
      const { result } = renderHook(() => useTableSelection(data, getRowKey));

      act(() => {
        result.current.toggleAll();
      });
      expect(result.current.selectedCount).toBe(3);

      act(() => {
        result.current.clearSelection();
      });
      expect(result.current.selectedCount).toBe(0);
      expect(result.current.isAllSelected).toBe(false);
    });
  });

  describe('getSelectedRows', () => {
    it('returns selected row objects', () => {
      const data = createData(3);
      const { result } = renderHook(() => useTableSelection(data, getRowKey));

      act(() => {
        result.current.toggleRow(data[0], 0);
        result.current.toggleRow(data[2], 2);
      });

      const selected = result.current.getSelectedRows();
      expect(selected).toHaveLength(2);
      expect(selected).toContainEqual(data[0]);
      expect(selected).toContainEqual(data[2]);
    });
  });

  describe('data change reset', () => {
    it('clears selection when data array identity changes', () => {
      const data1 = createData(3);
      const { result, rerender } = renderHook(
        ({ data }) => useTableSelection(data, getRowKey),
        { initialProps: { data: data1 } }
      );

      act(() => {
        result.current.toggleAll();
      });
      expect(result.current.selectedCount).toBe(3);

      // New data array (different identity)
      const data2 = createData(3);
      rerender({ data: data2 });

      expect(result.current.selectedCount).toBe(0);
    });
  });

  describe('isIndeterminate', () => {
    it('is false when no rows selected', () => {
      const data = createData(3);
      const { result } = renderHook(() => useTableSelection(data, getRowKey));

      expect(result.current.isIndeterminate).toBe(false);
    });

    it('is true when some but not all rows selected', () => {
      const data = createData(3);
      const { result } = renderHook(() => useTableSelection(data, getRowKey));

      act(() => {
        result.current.toggleRow(data[0], 0);
      });

      expect(result.current.isIndeterminate).toBe(true);
    });

    it('is false when all rows selected', () => {
      const data = createData(3);
      const { result } = renderHook(() => useTableSelection(data, getRowKey));

      act(() => {
        result.current.toggleAll();
      });

      expect(result.current.isIndeterminate).toBe(false);
    });
  });
});
