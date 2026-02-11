import { useState, useEffect, useCallback } from 'react';
import { getResourceGraph } from '../utils/graphApi';

export interface ResourceGraphHook {
  graph: any | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook to fetch and manage resource graph data
 * @param namespace - Resource namespace
 * @param kind - Resource kind
 * @param name - Resource name
 * @param depth - Graph traversal depth
 * @returns Graph data, loading state, error state, and refresh function
 */
export function useResourceGraph(
  namespace: string,
  kind: string,
  name: string,
  depth: number = 2
): ResourceGraphHook {
  const [graph, setGraph] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    if (!kind || !name) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const graphData = await getResourceGraph(namespace, kind, name, depth);
      setGraph(graphData);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch graph';
      setError(errorMsg);
      console.error('Error fetching resource graph:', err);
    } finally {
      setLoading(false);
    }
  }, [namespace, kind, name, depth]);

  // Fetch on mount and when params change
  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  return {
    graph,
    loading,
    error,
    refresh: fetchGraph
  };
}
