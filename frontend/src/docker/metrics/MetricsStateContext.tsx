import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EventsOn } from '../../../wailsjs/runtime/runtime.js';
import { GetSwarmMetricsHistory } from '../swarmApi';

type MetricsState = {
  history: any[];
  latest: any | null;
  services: any[];
  nodes: any[];
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
};

const MetricsStateContext = createContext<MetricsState>({
  history: [],
  latest: null,
  services: [],
  nodes: [],
  loading: false,
  error: '',
  refetch: async () => {},
});

export function MetricsStateProvider({ children, maxPoints = 720 }: { children: ReactNode; maxPoints?: number }) {
  const [history, setHistory] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const maxRef = useRef(maxPoints);
  useEffect(() => {
    maxRef.current = maxPoints;
  }, [maxPoints]);

  const applyAppend = useCallback((p: any) => {
    if (!p) return;
    setHistory((prev) => {
      const next = [...(Array.isArray(prev) ? prev : []), p];
      const max = Number(maxRef.current) || 0;
      return max > 0 && next.length > max ? next.slice(next.length - max) : next;
    });
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const h = await GetSwarmMetricsHistory();
      setHistory(Array.isArray(h) ? h : []);
    } catch (err: any) {
      setError(err?.message || String(err || 'Failed to load metrics history'));
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    refetch();

    let offPoint: undefined | (() => void);
    let offBreakdown: undefined | (() => void);
    try {
      offPoint = EventsOn('swarm:metrics:update', (p: any) => {
        if (!active) return;
        applyAppend(p);
      });
      offBreakdown = EventsOn('swarm:metrics:breakdown', (b: any) => {
        if (!active || !b) return;
        setServices(Array.isArray(b?.services) ? b.services : []);
        setNodes(Array.isArray(b?.nodes) ? b.nodes : []);
      });
    } catch (_) {
      // Not running inside Wails.
    }

    return () => {
      active = false;
      if (typeof offPoint === 'function') offPoint();
      if (typeof offBreakdown === 'function') offBreakdown();
    };
  }, [applyAppend, refetch]);

  const latest = useMemo(() => {
    const arr = Array.isArray(history) ? history : [];
    return arr.length ? arr[arr.length - 1] : null;
  }, [history]);

  const value = useMemo(() => ({
    history,
    latest,
    services,
    nodes,
    loading,
    error,
    refetch,
  }), [history, latest, services, nodes, loading, error, refetch]);

  return (
    <MetricsStateContext.Provider value={value}>
      {children}
    </MetricsStateContext.Provider>
  );
}

export function useClusterMetrics() {
  return useContext(MetricsStateContext);
}

export function useServiceMetrics() {
  const { services } = useContext(MetricsStateContext);
  return Array.isArray(services) ? services : [];
}

export function useNodeMetrics() {
  const { nodes } = useContext(MetricsStateContext);
  return Array.isArray(nodes) ? nodes : [];
}

export default MetricsStateContext;
