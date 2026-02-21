/**
 * Custom hook for resource data fetching and live event subscriptions.
 * Consolidates duplicated data loading logic from ~20 OverviewTable components.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { EventsOff, EventsOn } from '../../wailsjs/runtime';

type FetchFn<TItem> = (..._args: unknown[]) => Promise<TItem[]>;
export interface UseResourceDataOptions<TItem, TNormalized> {
  fetchFn: FetchFn<TItem>;
  eventName: string;
  namespaces?: string[];
  namespace?: string;
  normalize?: (_item: TItem) => TNormalized;
  clusterScoped?: boolean;
  enabled?: boolean;
}
export interface UseResourceDataResult<TNormalized> {
  data: TNormalized[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useResourceData<TItem = unknown, TNormalized = TItem>({
  fetchFn,
  eventName,
  namespaces,
  namespace,
  normalize,
  clusterScoped = false,
  enabled = true,
}: UseResourceDataOptions<TItem, TNormalized>): UseResourceDataResult<TNormalized> {
  const [data, setData] = useState<TNormalized[]>([]);
  const [loading, setLoading] = useState(true);

  const normalizeRef = useRef<typeof normalize>(normalize);
  normalizeRef.current = normalize;

  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  const loadingRef = useRef(false);

  const namespacesKey = Array.isArray(namespaces) ? namespaces.join(',') : '';

  const applyNormalize = useCallback((arr?: TItem[]) => {
    const items = (arr || []).filter(Boolean) as TItem[];
    if (normalizeRef.current) {
      return items.map(normalizeRef.current);
    }
    return items as unknown as TNormalized[];
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setData([]);
      setLoading(false);
      loadingRef.current = false;
      return;
    }

    if (loadingRef.current) {
      return;
    }

    if (clusterScoped) {
      try {
        loadingRef.current = true;
        setLoading(true);
        const result = await fetchFn().catch(() => [] as TItem[]);
        setData(applyNormalize(result));
      } catch {
        setData([]);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
      return;
    }

    const nsArr = namespacesKey
      ? namespacesKey.split(',')
      : (namespace ? [namespace] : []);

    if (nsArr.length === 0) {
      setLoading(false);
      loadingRef.current = false;
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);
      const lists = await Promise.all(
        nsArr.map((ns) => fetchFn(ns).catch(() => [] as TItem[]))
      );
      const flat = lists.flat();
      setData(applyNormalize(flat));
    } catch {
      setData([]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [fetchFn, namespacesKey, namespace, clusterScoped, applyNormalize, enabled]);

  refreshRef.current = refresh;

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!eventName || !enabled) return;

    const onUpdate = (list: unknown) => {
      try {
        if (Array.isArray(list)) {
          setData(applyNormalize(list as TItem[]));
          setLoading(false);
        } else {
          refreshRef.current?.();
        }
      } catch {
        setData([]);
        setLoading(false);
      }
    };

    EventsOn(eventName, onUpdate);
    return () => {
      try { EventsOff(eventName); } catch { /* ignore cleanup errors */ }
    };
  }, [eventName, applyNormalize, enabled]);

  return { data, loading, refresh };
}

export function createNormalizer<TDefaults extends Record<string, unknown>>(fieldDefaults: TDefaults) {
  return (item: Record<string, unknown> | null | undefined): TDefaults | null => {
    if (!item) return null;
    const result: Record<string, unknown> = {};
    for (const [key, defaultValue] of Object.entries(fieldDefaults)) {
      const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
      result[key] = (item as Record<string, unknown>)[key] ?? (item as Record<string, unknown>)[pascalKey] ?? defaultValue;
    }
    return result as TDefaults;
  };
}

export default useResourceData;
