import { useCallback, useEffect, useMemo, useState } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';

type ResourceItemWithUID = {
  metadata?: {
    uid?: string;
  };
};

type ResourceWatchEvent<T> = {
  action?: 'add' | 'update' | 'delete' | 'resync';
  data?: T | T[];
  uid?: string;
};

type UseResourceWatchOptions<T> = {
  mergeStrategy?: 'replace' | 'incremental';
  filter?: (item: T) => boolean;
  refetchOnSignal?: boolean;
};

function getUID<T>(item: T): string | undefined {
  return (item as ResourceItemWithUID)?.metadata?.uid;
}

function dedupeByUID<T>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const uid = getUID(item);
    if (!uid) {
      out.push(item);
      continue;
    }
    if (seen.has(uid)) {
      continue;
    }
    seen.add(uid);
    out.push(item);
  }
  return out;
}

export function useResourceWatch<T>(
  eventName: string,
  initialFetch: () => Promise<T[]>,
  options?: UseResourceWatchOptions<T>
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const mergeStrategy = options?.mergeStrategy ?? 'replace';
  const filter = options?.filter;
  const refetchOnSignal = options?.refetchOnSignal ?? false;

  const applyFilter = useCallback((items: T[]): T[] => {
    const normalized = dedupeByUID(items);
    return filter ? normalized.filter(filter) : normalized;
  }, [filter]);

  useEffect(() => {
    let mounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const maxRetries = 5;
    const baseDelay = 3000;

    const load = () => {
      initialFetch()
        .then((items) => {
          if (!mounted) return;
          setData(applyFilter(Array.isArray(items) ? items : []));
          setError(null);
          retryCount = 0;
        })
        .catch((err) => {
          if (!mounted) return;
          setError(err instanceof Error ? err : new Error(String(err)));
          // Retry with exponential backoff when initial fetch fails
          if (retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount);
            retryCount++;
            retryTimer = setTimeout(() => {
              if (mounted) load();
            }, delay);
          }
        })
        .finally(() => {
          if (mounted) {
            setLoading(false);
          }
        });
    };

    load();

    const unsubscribe = EventsOn(eventName, (eventPayload: ResourceWatchEvent<T> | T[] | null | undefined) => {
      if (!mounted) return;
      // Clear error on any successful event from backend
      setError(null);
      retryCount = 0;

      if (Array.isArray(eventPayload)) {
        setData(applyFilter(eventPayload));
        return;
      }

      if (!eventPayload || typeof eventPayload !== 'object' || !('action' in eventPayload)) {
        if (refetchOnSignal) {
          load();
        }
        return;
      }

      const event = eventPayload as ResourceWatchEvent<T>;

      if (mergeStrategy === 'replace' && Array.isArray(event.data)) {
        setData(applyFilter(event.data));
        return;
      }

      switch (event.action) {
        case 'add': {
          if (!event.data || Array.isArray(event.data)) return;
          setData((prev) => applyFilter([...prev, event.data as T]));
          break;
        }
        case 'update': {
          if (!event.data || Array.isArray(event.data)) return;
          const incoming = event.data as T;
          const uid = getUID(incoming);
          if (!uid) {
            setData((prev) => applyFilter([...prev, incoming]));
            return;
          }
          setData((prev) => applyFilter(prev.map((item) => (getUID(item) === uid ? incoming : item))));
          break;
        }
        case 'delete': {
          if (!event.uid) return;
          setData((prev) => applyFilter(prev.filter((item) => getUID(item) !== event.uid)));
          break;
        }
        case 'resync': {
          setData(applyFilter(Array.isArray(event.data) ? event.data : []));
          break;
        }
        default:
          break;
      }
    });

    return () => {
      mounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      try { unsubscribe?.(); } catch {}
    };
  }, [eventName, initialFetch, mergeStrategy, applyFilter, refetchOnSignal]);

  return useMemo(() => ({ data, loading, error }), [data, loading, error]);
}
