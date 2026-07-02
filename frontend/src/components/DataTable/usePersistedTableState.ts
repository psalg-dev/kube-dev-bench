import { useEffect, useState } from 'react';
import { SortingState } from '@tanstack/react-table';

interface PersistedTableState {
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  sorting: SortingState;
}

interface UsePersistedTableStateReturn extends PersistedTableState {
  setColumnOrder: (value: string[] | ((prev: string[]) => string[])) => void;
  setColumnVisibility: (
    value: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => void;
  setSorting: (
    value: SortingState | ((prev: SortingState) => SortingState)
  ) => void;
}

const DEFAULT_STATE: PersistedTableState = {
  columnOrder: [],
  columnVisibility: {},
  sorting: [],
};

function loadFromLocalStorage(key: string): PersistedTableState {
  try {
    const stored = localStorage.getItem(`datatable:${key}`);
    if (!stored) return DEFAULT_STATE;

    const parsed = JSON.parse(stored);
    return {
      columnOrder: Array.isArray(parsed.columnOrder) ? parsed.columnOrder : [],
      columnVisibility:
        typeof parsed.columnVisibility === 'object' && parsed.columnVisibility !== null
          ? parsed.columnVisibility
          : {},
      sorting: Array.isArray(parsed.sorting) ? parsed.sorting : [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function usePersistedTableState(
  persistKey?: string,
): UsePersistedTableStateReturn {
  const [columnOrder, setColumnOrderState] = useState<string[]>(
    persistKey ? loadFromLocalStorage(persistKey).columnOrder : DEFAULT_STATE.columnOrder,
  );

  const [columnVisibility, setColumnVisibilityState] = useState<
    Record<string, boolean>
  >(
    persistKey
      ? loadFromLocalStorage(persistKey).columnVisibility
      : DEFAULT_STATE.columnVisibility,
  );

  const [sorting, setSortingState] = useState<SortingState>(
    persistKey ? loadFromLocalStorage(persistKey).sorting : DEFAULT_STATE.sorting,
  );

  // ponytail: single effect persists all fields together, avoiding stale state bug with multiple setters
  useEffect(() => {
    if (persistKey) {
      localStorage.setItem(
        `datatable:${persistKey}`,
        JSON.stringify({ columnOrder, columnVisibility, sorting }),
      );
    }
  }, [columnOrder, columnVisibility, sorting, persistKey]);

  const setColumnOrder = (
    value: string[] | ((prev: string[]) => string[])
  ) => {
    setColumnOrderState(typeof value === 'function' ? value(columnOrder) : value);
  };

  const setColumnVisibility = (
    value:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => {
    setColumnVisibilityState(
      typeof value === 'function' ? value(columnVisibility) : value,
    );
  };

  const setSorting = (
    value: SortingState | ((prev: SortingState) => SortingState)
  ) => {
    setSortingState(typeof value === 'function' ? value(sorting) : value);
  };

  return {
    columnOrder,
    setColumnOrder,
    columnVisibility,
    setColumnVisibility,
    sorting,
    setSorting,
  };
}
