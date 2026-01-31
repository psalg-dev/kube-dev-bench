import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

/**
 * Custom hook for managing table row selection with multi-select, shift-range, and keyboard support.
 * @param {Array} data - Array of row objects
 * @param {function} getRowKey - Function to get unique key from a row (row, index) => string
 * @returns {Object} Selection state and handlers
 */
export function useTableSelection(data, getRowKey) {
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const lastClickedIndex = useRef(null);
  const previousDataRef = useRef(data);

  const dataKeys = useMemo(() => {
    if (!Array.isArray(data)) return new Set();
    return new Set(data.map((row, idx) => getRowKey(row, idx)));
  }, [data, getRowKey]);

  // Reset selection when data array identity changes; otherwise prune missing keys.
  useEffect(() => {
    const dataChanged = previousDataRef.current !== data;
    previousDataRef.current = data;

    if (dataChanged) {
      if (selectedKeys.size > 0) {
        setSelectedKeys(new Set());
        lastClickedIndex.current = null;
      }
      return;
    }

    if (!Array.isArray(data) || data.length === 0) {
      if (selectedKeys.size > 0) {
        setSelectedKeys(new Set());
        lastClickedIndex.current = null;
      }
      return;
    }

    setSelectedKeys(prev => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set();
      prev.forEach(key => {
        if (dataKeys.has(key)) {
          next.add(key);
        } else {
          changed = true;
        }
      });
      if (!changed) return prev;
      if (next.size === 0) {
        lastClickedIndex.current = null;
      }
      return next;
    });
  }, [data, dataKeys, selectedKeys.size]);

  const isSelected = useCallback((row, idx) => {
    const key = getRowKey(row, idx);
    return selectedKeys.has(key);
  }, [selectedKeys, getRowKey]);

  const selectedCount = useMemo(() => {
    // Only count keys that still exist in data
    let count = 0;
    selectedKeys.forEach(key => {
      if (dataKeys.has(key)) count++;
    });
    return count;
  }, [selectedKeys, dataKeys]);

  const isAllSelected = useMemo(() => {
    if (!data || data.length === 0) return false;
    return data.every((row, idx) => selectedKeys.has(getRowKey(row, idx)));
  }, [data, selectedKeys, getRowKey]);

  const isPartiallySelected = useMemo(() => {
    if (!data || data.length === 0) return false;
    const someSelected = data.some((row, idx) => selectedKeys.has(getRowKey(row, idx)));
    return someSelected && !isAllSelected;
  }, [data, selectedKeys, isAllSelected, getRowKey]);

  const toggleRow = useCallback((row, idx, shiftKey = false) => {
    const key = getRowKey(row, idx);
    
    setSelectedKeys(prev => {
      const next = new Set(prev);
      
      // Handle shift+click for range selection
      if (shiftKey && lastClickedIndex.current !== null && data) {
        const start = Math.min(lastClickedIndex.current, idx);
        const end = Math.max(lastClickedIndex.current, idx);
        
        // Add all rows in range
        for (let i = start; i <= end; i++) {
          if (data[i]) {
            next.add(getRowKey(data[i], i));
          }
        }
      } else {
        // Simple toggle
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
      }
      
      return next;
    });
    
    lastClickedIndex.current = idx;
  }, [data, getRowKey]);

  const toggleAll = useCallback(() => {
    if (!data || data.length === 0) return;
    
    setSelectedKeys(prev => {
      // If all are selected, clear all
      if (isAllSelected) {
        return new Set();
      }
      
      // Otherwise, select all visible rows
      const next = new Set(prev);
      data.forEach((row, idx) => {
        next.add(getRowKey(row, idx));
      });
      return next;
    });
  }, [data, isAllSelected, getRowKey]);

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
    lastClickedIndex.current = null;
  }, []);

  const getSelectedRows = useCallback(() => {
    if (!data) return [];
    return data.filter((row, idx) => selectedKeys.has(getRowKey(row, idx)));
  }, [data, selectedKeys, getRowKey]);

  const selectRows = useCallback((rows) => {
    if (!Array.isArray(rows)) return;
    setSelectedKeys(prev => {
      const next = new Set(prev);
      rows.forEach((row, idx) => {
        const key = getRowKey(row, idx);
        next.add(key);
      });
      return next;
    });
  }, [getRowKey]);

  return {
    selectedKeys,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    toggleRow,
    toggleAll,
    clearSelection,
    selectedCount,
    getSelectedRows,
    selectRows,
  };
}

export default useTableSelection;
