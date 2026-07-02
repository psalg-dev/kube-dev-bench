import { useState, useEffect } from 'react';
import type { SortingState } from '@tanstack/react-table';

interface TableState {
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  sorting: SortingState;
}

export function usePersistedTableState(persistKey?: string) {
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [sorting, setSorting] = useState<SortingState>([]);

  // Load from localStorage on mount
  useEffect(() => {
    if (!persistKey) return;
    const stored = localStorage.getItem(persistKey);
    if (stored) {
      try {
        const state: TableState = JSON.parse(stored);
        setColumnOrder(state.columnOrder || []);
        setColumnVisibility(state.columnVisibility || {});
        setSorting(state.sorting || []);
      } catch {
        // Ignore parse errors
      }
    }
  }, [persistKey]);

  // Persist to localStorage on change
  useEffect(() => {
    if (!persistKey) return;
    const state: TableState = {
      columnOrder,
      columnVisibility,
      sorting,
    };
    localStorage.setItem(persistKey, JSON.stringify(state));
  }, [persistKey, columnOrder, columnVisibility, sorting]);

  return {
    columnOrder,
    setColumnOrder,
    columnVisibility,
    setColumnVisibility,
    sorting,
    setSorting,
  };
}
