/**
 * Custom hook for async data fetching with automatic cleanup handling.
 * Consolidates duplicated "active flag" pattern from 20+ components.
 *
 * This hook handles:
 * - Loading, error, and data state management
 * - Cleanup to prevent state updates after unmount
 * - Refetch capability
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DependencyList } from 'react';

type FetchFn<T> = () => Promise<T> | T;

export interface AsyncDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for async data fetching with automatic cleanup handling.
 * Prevents state updates after component unmount.
 */
export function useAsyncData<T>(fetchFn: FetchFn<T>, deps: DependencyList = []): AsyncDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track if component is mounted to prevent state updates after unmount.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchFn();
        if (active && mountedRef.current) {
          setData(result as T);
        }
      } catch (err) {
        if (active && mountedRef.current) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
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

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      if (mountedRef.current) {
        setData(result as T);
      }
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchFn]);

  return { data, loading, error, refetch };
}

export default useAsyncData;
