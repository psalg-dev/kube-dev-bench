import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { EventsOn } from '../../wailsjs/runtime';
import { GetRegistries, GetSwarmResourceCounts } from './swarmApi';
import SwarmStateContext from './SwarmStateContext';

interface SwarmResourceCounts {
  services: number;
  tasks: number;
  nodes: number;
  networks: number;
  configs: number;
  secrets: number;
  stacks: number;
  volumes: number;
}

type SwarmResourceCountsPayload = Partial<SwarmResourceCounts> & {
  Services?: number;
  Tasks?: number;
  Nodes?: number;
  Networks?: number;
  Configs?: number;
  Secrets?: number;
  Stacks?: number;
  Volumes?: number;
};

export interface SwarmResourceCountsContextValue {
  counts: SwarmResourceCounts | null;
  registriesCount: number | null;
  lastUpdated: number;
  refetch: (_opts?: { forceRegistries?: boolean }) => void;
}
const SwarmResourceCountsContext = createContext<SwarmResourceCountsContextValue>({
  counts: null,
  registriesCount: null,
  lastUpdated: 0,
  refetch: () => {},
});

export function SwarmResourceCountsProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<SwarmResourceCounts | null>(null);
  const [registriesCount, setRegistriesCount] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState(0);
  const lastSigRef = useRef<string | null>(null);
  const lastRegistriesFetchRef = useRef(0);

  const swarmContext = useContext(SwarmStateContext);
  const connected = !!swarmContext?.connected;

  const computeSig = useCallback((c: SwarmResourceCounts | null) => {
    if (!c) return 'none';
    return [
      c.services ?? 0,
      c.tasks ?? 0,
      c.nodes ?? 0,
      c.networks ?? 0,
      c.configs ?? 0,
      c.secrets ?? 0,
      c.stacks ?? 0,
      c.volumes ?? 0,
    ].join('-');
  }, []);

  const normalize = useCallback((raw: SwarmResourceCountsPayload | null): SwarmResourceCounts | null => {
    if (!raw) return raw;
    return {
      services: raw.services ?? raw.Services ?? 0,
      tasks: raw.tasks ?? raw.Tasks ?? 0,
      nodes: raw.nodes ?? raw.Nodes ?? 0,
      networks: raw.networks ?? raw.Networks ?? 0,
      configs: raw.configs ?? raw.Configs ?? 0,
      secrets: raw.secrets ?? raw.Secrets ?? 0,
      stacks: raw.stacks ?? raw.Stacks ?? 0,
      volumes: raw.volumes ?? raw.Volumes ?? 0,
    };
  }, []);

  const applyCounts = useCallback((data: SwarmResourceCountsPayload | null) => {
    const norm = normalize(data);
    const sig = computeSig(norm);
    if (sig !== lastSigRef.current) {
      lastSigRef.current = sig;
      setCounts(norm);
      setLastUpdated(Date.now());
    }
  }, [computeSig, normalize]);

  const refetch = useCallback((opts?: { forceRegistries?: boolean }) => {
    const forceRegistries = !!opts?.forceRegistries;

    GetSwarmResourceCounts()
      .then((data) => {
        applyCounts(data);
      })
      .catch(() => {
        // Docker might not be connected - that's OK
      });

    const now = Date.now();
    const stale = now - lastRegistriesFetchRef.current > 10_000;
    if (forceRegistries || stale || registriesCount === null) {
      lastRegistriesFetchRef.current = now;
      GetRegistries()
        .then((items) => {
          const next = Array.isArray(items) ? items.length : 0;
          setRegistriesCount(next);
        })
        .catch(() => {
          // Best effort; keep last known value
        });
    }
  }, [applyCounts, registriesCount]);

  useEffect(() => {
    let active = true;

    let offCounts: (() => void) | undefined;
    let offConnected: (() => void) | undefined;
    try {
      offCounts = EventsOn('swarm:resourcecounts:update', (data: SwarmResourceCountsPayload) => {
        if (!active) return;
        try {
          applyCounts(data);
        } catch {}
      });
      offConnected = EventsOn('docker:connected', () => {
        if (!active) return;
        setTimeout(() => refetch({ forceRegistries: true }), 500);
      });
    } catch {
      // When not running inside Wails, window.runtime is not available.
    }

    refetch({ forceRegistries: true });

    let intervalId: ReturnType<typeof setInterval> | undefined;
    if (connected) {
      intervalId = setInterval(() => {
        if (active) refetch();
      }, 2000);
    }

    return () => {
      active = false;
      if (intervalId) clearInterval(intervalId);
      if (typeof offCounts === 'function') offCounts();
      if (typeof offConnected === 'function') offConnected();
    };
  }, [refetch, applyCounts, connected]);

  return (
    <SwarmResourceCountsContext.Provider value={{ counts, registriesCount, lastUpdated, refetch }}>
      {children}
    </SwarmResourceCountsContext.Provider>
  );
}

export function useSwarmResourceCounts() {
  return useContext(SwarmResourceCountsContext);
}

export default SwarmResourceCountsContext;
