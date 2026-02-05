import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface TableSelectionResult<TKey extends string | number, TRow> {
  selectedKeys: Set<TKey>;
  isSelected: (key: TKey) => boolean;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  toggleRow: (key: TKey, index?: number, rangeSelect?: boolean) => void;
  toggleAll: () => void;
  clearSelection: () => void;
  selectedCount: number;
  getSelectedRows: (rows?: TRow[]) => TRow[];
}

export default function useTableSelection<TRow, TKey extends string | number>(
  data: TRow[] | null | undefined,
  getRowKey: (row: TRow, index: number) => TKey,
  visibleData?: TRow[] | null
): TableSelectionResult<TKey, TRow> {
  const [selectedKeys, setSelectedKeys] = useState<Set<TKey>>(() => new Set());
  const lastClickedIndex = useRef<number | null>(null);
  const lastClickedKey = useRef<TKey | null>(null);

  const keySource = Array.isArray(visibleData) ? visibleData : data;

  const baseKeys = useMemo(() => {
    if (!Array.isArray(data)) return [] as TKey[];
    return data.map((row, idx) => getRowKey(row, idx));
  }, [data, getRowKey]);

  const keys = useMemo(() => {
    if (!Array.isArray(keySource)) return [] as TKey[];
    return keySource.map((row, idx) => getRowKey(row, idx));
  }, [keySource, getRowKey]);

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
    lastClickedIndex.current = null;
    lastClickedKey.current = null;
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSelectedKeys((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set<TKey>();
        baseKeys.forEach((key) => {
          if (prev.has(key)) {
            next.add(key);
          }
        });
        if (next.size === 0) {
          lastClickedIndex.current = null;
          lastClickedKey.current = null;
        }
        return next;
      });
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [baseKeys]);

  const isSelected = useCallback((key: TKey) => selectedKeys.has(key), [selectedKeys]);

  const toggleRow = useCallback((key: TKey, index?: number, rangeSelect = false) => {
    const resolvedIndex = Number.isFinite(index) && (index as number) >= 0
      ? (index as number)
      : keys.indexOf(key);

    setSelectedKeys((prev) => {
      const next = new Set<TKey>(prev);
      const hasKey = next.has(key);

      if (rangeSelect && resolvedIndex >= 0) {
        let anchor = lastClickedIndex.current;
        if (lastClickedKey.current !== null) {
          const keyIndex = keys.findIndex((k) => k === lastClickedKey.current);
          if (keyIndex >= 0) {
            anchor = keyIndex;
          }
        }
        if (anchor === null || anchor === undefined) {
          const firstSelectedIndex = keys.findIndex((k) => next.has(k));
          anchor = firstSelectedIndex >= 0 ? firstSelectedIndex : resolvedIndex;
        }
        const start = Math.min(anchor, resolvedIndex);
        const end = Math.max(anchor, resolvedIndex);
        for (let i = start; i <= end; i += 1) {
          const rangeKey = keys[i];
          if (rangeKey !== undefined) {
            next.add(rangeKey);
          }
        }
        return next;
      }

      if (hasKey) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });

    if (resolvedIndex >= 0) {
      lastClickedIndex.current = resolvedIndex;
      lastClickedKey.current = key;
    }
  }, [keys]);

  const toggleAll = useCallback(() => {
    setSelectedKeys((prev) => {
      if (keys.length === 0) return prev;
      const allSelected = keys.every((key) => prev.has(key));
      if (allSelected) {
        return new Set();
      }
      return new Set(keys);
    });
  }, [keys]);

  const selectedCount = selectedKeys.size;
  const isAllSelected = keys.length > 0 && keys.every((key) => selectedKeys.has(key));
  const isIndeterminate = selectedCount > 0 && !isAllSelected;

  const getSelectedRows = useCallback((rows?: TRow[]) => {
    if (!Array.isArray(rows) || rows.length === 0) return [] as TRow[];
    return rows.filter((row, idx) => selectedKeys.has(getRowKey(row, idx)));
  }, [selectedKeys, getRowKey]);

  return {
    selectedKeys,
    isSelected,
    isAllSelected,
    isIndeterminate,
    toggleRow,
    toggleAll,
    clearSelection,
    selectedCount,
    getSelectedRows,
  };
}
