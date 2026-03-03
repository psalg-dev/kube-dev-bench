import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export default function useTableSelection(data, getRowKey, visibleData) {
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const lastClickedIndex = useRef(null);
  const lastClickedKey = useRef(null);

  const keySource = Array.isArray(visibleData) ? visibleData : data;

  const baseKeys = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((row, idx) => getRowKey(row, idx));
  }, [data, getRowKey]);

  const keys = useMemo(() => {
    if (!Array.isArray(keySource)) return [];
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
        const next = new Set();
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

  const isSelected = useCallback((key) => selectedKeys.has(key), [selectedKeys]);

  const toggleRow = useCallback((key, index, rangeSelect = false) => {
    const resolvedIndex = Number.isFinite(index) && index >= 0 ? index : keys.indexOf(key);

    setSelectedKeys((prev) => {
      const next = new Set(prev);
      const hasKey = next.has(key);

      if (rangeSelect && resolvedIndex >= 0) {
        let anchor = lastClickedIndex.current;
        if (lastClickedKey.current) {
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

  const getSelectedRows = useCallback((rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return [];
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
