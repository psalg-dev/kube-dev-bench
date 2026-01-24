import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { EventsOn } from '../../../wailsjs/runtime/runtime.js';
import { GetSwarmMetricsHistory } from '../swarmApi.js';

const MetricsStateContext = createContext({
  history: [],
  latest: null,
  services: [],
  nodes: [],
  loading: false,
  error: '',
  refetch: async () => {},
});

export function MetricsStateProvider({ children, maxPoints = 720 }) {
  const [history, setHistory] = useState([]);
  const [services, setServices] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const maxRef = useRef(maxPoints);
  useEffect(() => {
    maxRef.current = maxPoints;
  }, [maxPoints]);

  const applyAppend = useCallback((p) => {
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
    } catch (err) {
      setError(err?.message || String(err || 'Failed to load metrics history'));
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    refetch();

    let offPoint;
    let offBreakdown;
    try {
      offPoint = EventsOn('swarm:metrics:update', (p) => {
        if (!active) return;
        applyAppend(p);
      });
      offBreakdown = EventsOn('swarm:metrics:breakdown', (b) => {
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
