import { act, renderHook } from '@testing-library/react';
import { SortingState } from '@tanstack/react-table';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePersistedTableState } from '../components/DataTable/usePersistedTableState';

describe('usePersistedTableState', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('default state', () => {
    it('should initialize with empty defaults when key is undefined', () => {
      const { result } = renderHook(() => usePersistedTableState());

      expect(result.current.columnOrder).toEqual([]);
      expect(result.current.columnVisibility).toEqual({});
      expect(result.current.sorting).toEqual([]);
    });

    it('should initialize with empty defaults when localStorage is empty', () => {
      const { result } = renderHook(() => usePersistedTableState('test-key'));

      expect(result.current.columnOrder).toEqual([]);
      expect(result.current.columnVisibility).toEqual({});
      expect(result.current.sorting).toEqual([]);
    });
  });

  describe('localStorage access with undefined key', () => {
    it('should not call localStorage.getItem when key is undefined', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');

      renderHook(() => usePersistedTableState());

      expect(getItemSpy).not.toHaveBeenCalled();
      getItemSpy.mockRestore();
    });

    it('should not call localStorage.setItem when key is undefined', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      const { result } = renderHook(() => usePersistedTableState());

      await act(async () => {
        result.current.setColumnOrder(['col1', 'col2']);
      });

      expect(setItemSpy).not.toHaveBeenCalled();
      setItemSpy.mockRestore();
    });
  });

  describe('columnOrder persistence', () => {
    it('should persist columnOrder to localStorage', async () => {
      const { result } = renderHook(() => usePersistedTableState('test-key'));

      const newOrder = ['col1', 'col2', 'col3'];
      await act(async () => {
        result.current.setColumnOrder(newOrder);
      });

      const stored = localStorage.getItem('datatable:test-key');
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed.columnOrder).toEqual(newOrder);
    });

    it('should read columnOrder from localStorage', () => {
      const data = {
        columnOrder: ['col1', 'col2'],
        columnVisibility: {},
        sorting: [],
      };
      localStorage.setItem('datatable:test-key', JSON.stringify(data));

      const { result } = renderHook(() => usePersistedTableState('test-key'));

      expect(result.current.columnOrder).toEqual(['col1', 'col2']);
    });

    it('should support updater function for setColumnOrder', async () => {
      const { result } = renderHook(() => usePersistedTableState('test-key'));

      await act(async () => {
        result.current.setColumnOrder(['col1', 'col2']);
      });

      await act(async () => {
        result.current.setColumnOrder((prev) => [...prev, 'col3']);
      });

      expect(result.current.columnOrder).toEqual(['col1', 'col2', 'col3']);
      const stored = JSON.parse(localStorage.getItem('datatable:test-key')!);
      expect(stored.columnOrder).toEqual(['col1', 'col2', 'col3']);
    });
  });

  describe('columnVisibility persistence', () => {
    it('should persist columnVisibility to localStorage', async () => {
      const { result } = renderHook(() => usePersistedTableState('test-key'));

      const newVisibility = { col1: true, col2: false };
      await act(async () => {
        result.current.setColumnVisibility(newVisibility);
      });

      const stored = localStorage.getItem('datatable:test-key');
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed.columnVisibility).toEqual(newVisibility);
    });

    it('should read columnVisibility from localStorage', () => {
      const data = {
        columnOrder: [],
        columnVisibility: { col1: true, col2: false },
        sorting: [],
      };
      localStorage.setItem('datatable:test-key', JSON.stringify(data));

      const { result } = renderHook(() => usePersistedTableState('test-key'));

      expect(result.current.columnVisibility).toEqual({ col1: true, col2: false });
    });

    it('should support updater function for setColumnVisibility', async () => {
      const { result } = renderHook(() => usePersistedTableState('test-key'));

      await act(async () => {
        result.current.setColumnVisibility({ col1: true });
      });

      await act(async () => {
        result.current.setColumnVisibility((prev) => ({ ...prev, col2: false }));
      });

      expect(result.current.columnVisibility).toEqual({ col1: true, col2: false });
      const stored = JSON.parse(localStorage.getItem('datatable:test-key')!);
      expect(stored.columnVisibility).toEqual({ col1: true, col2: false });
    });
  });

  describe('sorting persistence', () => {
    it('should persist sorting to localStorage', async () => {
      const { result } = renderHook(() => usePersistedTableState('test-key'));

      const newSorting: SortingState = [{ id: 'col1', desc: true }];
      await act(async () => {
        result.current.setSorting(newSorting);
      });

      const stored = localStorage.getItem('datatable:test-key');
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed.sorting).toEqual(newSorting);
    });

    it('should read sorting from localStorage', () => {
      const sortingData: SortingState = [{ id: 'col1', desc: false }];
      const data = {
        columnOrder: [],
        columnVisibility: {},
        sorting: sortingData,
      };
      localStorage.setItem('datatable:test-key', JSON.stringify(data));

      const { result } = renderHook(() => usePersistedTableState('test-key'));

      expect(result.current.sorting).toEqual(sortingData);
    });

    it('should support updater function for setSorting', async () => {
      const { result } = renderHook(() => usePersistedTableState('test-key'));

      await act(async () => {
        result.current.setSorting([{ id: 'col1', desc: true }]);
      });

      await act(async () => {
        result.current.setSorting((prev) => [
          ...prev,
          { id: 'col2', desc: false },
        ]);
      });

      expect(result.current.sorting).toEqual([
        { id: 'col1', desc: true },
        { id: 'col2', desc: false },
      ]);
      const stored = JSON.parse(localStorage.getItem('datatable:test-key')!);
      expect(stored.sorting).toEqual([
        { id: 'col1', desc: true },
        { id: 'col2', desc: false },
      ]);
    });
  });

  describe('localStorage integration', () => {
    it('should persist all three fields together in one localStorage entry', async () => {
      const { result } = renderHook(() => usePersistedTableState('test-key'));

      await act(async () => {
        result.current.setColumnOrder(['a', 'b']);
        result.current.setColumnVisibility({ x: true });
        result.current.setSorting([{ id: 'a', desc: true }]);
      });

      const stored = localStorage.getItem('datatable:test-key');
      const parsed = JSON.parse(stored!);

      expect(parsed).toEqual({
        columnOrder: ['a', 'b'],
        columnVisibility: { x: true },
        sorting: [{ id: 'a', desc: true }],
      });
    });

    it('should read all three fields from one localStorage entry', () => {
      const data = {
        columnOrder: ['a', 'b', 'c'],
        columnVisibility: { x: true, y: false },
        sorting: [{ id: 'b', desc: false }],
      };
      localStorage.setItem('datatable:test-key', JSON.stringify(data));

      const { result } = renderHook(() => usePersistedTableState('test-key'));

      expect(result.current.columnOrder).toEqual(['a', 'b', 'c']);
      expect(result.current.columnVisibility).toEqual({ x: true, y: false });
      expect(result.current.sorting).toEqual([{ id: 'b', desc: false }]);
    });
  });

  describe('corrupt localStorage data', () => {
    it('should fall back to defaults on corrupt JSON', () => {
      localStorage.setItem('datatable:test-key', '{invalid json}');

      const { result } = renderHook(() => usePersistedTableState('test-key'));

      expect(result.current.columnOrder).toEqual([]);
      expect(result.current.columnVisibility).toEqual({});
      expect(result.current.sorting).toEqual([]);
    });

    it('should not throw on corrupt JSON', () => {
      localStorage.setItem('datatable:test-key', 'not-json');

      expect(() => {
        renderHook(() => usePersistedTableState('test-key'));
      }).not.toThrow();
    });

    it('should fall back to defaults on missing columnOrder', () => {
      const data = {
        columnVisibility: {},
        sorting: [],
      };
      localStorage.setItem('datatable:test-key', JSON.stringify(data));

      const { result } = renderHook(() => usePersistedTableState('test-key'));

      expect(result.current.columnOrder).toEqual([]);
    });

    it('should fall back to defaults on missing columnVisibility', () => {
      const data = {
        columnOrder: [],
        sorting: [],
      };
      localStorage.setItem('datatable:test-key', JSON.stringify(data));

      const { result } = renderHook(() => usePersistedTableState('test-key'));

      expect(result.current.columnVisibility).toEqual({});
    });

    it('should fall back to defaults on missing sorting', () => {
      const data = {
        columnOrder: [],
        columnVisibility: {},
      };
      localStorage.setItem('datatable:test-key', JSON.stringify(data));

      const { result } = renderHook(() => usePersistedTableState('test-key'));

      expect(result.current.sorting).toEqual([]);
    });
  });

  describe('multiple instances with same key', () => {
    it('should read persisted state from another instance', () => {
      const { result: result1 } = renderHook(() =>
        usePersistedTableState('shared-key'),
      );

      act(() => {
        result1.current.setColumnOrder(['col1', 'col2']);
      });

      const { result: result2 } = renderHook(() =>
        usePersistedTableState('shared-key'),
      );

      expect(result2.current.columnOrder).toEqual(['col1', 'col2']);
    });
  });
});
