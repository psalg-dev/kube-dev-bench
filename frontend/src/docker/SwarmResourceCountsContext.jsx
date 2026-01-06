import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { GetSwarmResourceCounts } from './swarmApi.js';
import { EventsOn } from '../../wailsjs/runtime';
import SwarmStateContext from './SwarmStateContext.jsx';

const SwarmResourceCountsContext = createContext({ counts: null, lastUpdated: 0, refetch: () => {} });

export function SwarmResourceCountsProvider({ children }) {
  const [counts, setCounts] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(0);
  const lastSigRef = useRef(null);

  const swarmContext = useContext(SwarmStateContext);
  const connected = !!swarmContext?.connected;

  const computeSig = useCallback((c) => {
    if (!c) return 'none';
    // Handle both camelCase and PascalCase property names (Go serializes with capital letters)
    return [
      c.services ?? c.Services ?? 0,
      c.tasks ?? c.Tasks ?? 0,
      c.nodes ?? c.Nodes ?? 0,
      c.networks ?? c.Networks ?? 0,
      c.configs ?? c.Configs ?? 0,
      c.secrets ?? c.Secrets ?? 0,
      c.stacks ?? c.Stacks ?? 0,
      c.volumes ?? c.Volumes ?? 0,
    ].join('-');
  }, []);

  // Normalize property names to lowercase for consistent access
  const normalize = useCallback((raw) => {
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

  const applyCounts = useCallback((data) => {
    const norm = normalize(data);
    const sig = computeSig(norm);
    if (sig !== lastSigRef.current) {
      lastSigRef.current = sig;
      setCounts(norm);
      setLastUpdated(Date.now());
    }
  }, [computeSig, normalize]);

  const refetch = useCallback(() => {
    GetSwarmResourceCounts()
      .then((data) => {
        applyCounts(data);
      })
      .catch(() => {
        // Docker might not be connected - that's OK
      });
  }, [applyCounts]);

  useEffect(() => {
    let active = true;

    // Best-effort event listeners (works in Wails; harmless in tests/mocks)
    let offCounts;
    let offConnected;
    try {
      offCounts = EventsOn('swarm:resourcecounts:update', (data) => {
        if (!active) return;
        try {
          applyCounts(data);
        } catch (_) {}
      });
      offConnected = EventsOn('docker:connected', () => {
        if (!active) return;
        setTimeout(refetch, 500);
      });
    } catch (_) {
      // When not running inside Wails, window.runtime is not available.
    }

    // Always try an initial fetch. If Docker isn't connected yet, it will fail silently.
    refetch();

    // Primary update mechanism: poll when connected.
    // This avoids any event timing issues and matches backend's 2s polling cadence.
    let intervalId;
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
    <SwarmResourceCountsContext.Provider value={{ counts, lastUpdated, refetch }}>
      {children}
    </SwarmResourceCountsContext.Provider>
  );
}

export function useSwarmResourceCounts() {
  return useContext(SwarmResourceCountsContext);
}

export default SwarmResourceCountsContext;
