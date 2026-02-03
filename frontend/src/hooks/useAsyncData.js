/**
 * Custom hook for async data fetching with automatic cleanup handling.
 * Consolidates duplicated "active flag" pattern from 20+ components.
 * 
 * This hook handles:
 * - Loading, error, and data state management
 * - Cleanup to prevent state updates after unmount
 * - Refetch capability
 * 
 * @example
 * const { data, loading, error, refetch } = useAsyncData(
 *   () => GetSwarmConfigInspectJSON(id).then(json => String(json || '')),
 *   [id]
 * );
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for async data fetching with automatic cleanup handling.
 * Prevents state updates after component unmount.
 * 
 * @param {Function} fetchFn - Async function that returns the data
 * @param {Array} deps - Dependency array for re-fetching (like useEffect deps)
 * @returns {Object} - { data, loading, error, refetch }
 */
export function useAsyncData(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const executeRequest = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      if (mountedRef.current) {
        setData(result);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e?.message || String(e));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchFn]);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchFn();
        if (active && mountedRef.current) {
          setData(result);
        }
      } catch (e) {
        if (active && mountedRef.current) {
          setError(e?.message || String(e));
        }
      } finally {
        if (active && mountedRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(() => {
    executeRequest();
  }, [executeRequest]);

  return { data, loading, error, refetch };
}

export default useAsyncData;
