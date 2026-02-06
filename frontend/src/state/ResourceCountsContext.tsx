import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { GetResourceCounts } from '../k8s/resources/kubeApi';
import { EventsOn } from '../../wailsjs/runtime';

type ResourceCounts = Record<string, any> | null;

type ResourceCountsContextValue = {
  counts: ResourceCounts;
  lastUpdated: number;
};

const ResourceCountsContext = createContext<ResourceCountsContextValue>({ counts: null, lastUpdated: 0 });

export function ResourceCountsProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<ResourceCounts>(null);
  const lastSigRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let off: (() => void) | undefined;
    const hasWailsBinding = () => {
      const win = window as Window & {
        go?: { main?: { App?: { GetResourceCounts?: () => Promise<any> } } };
      };
      return typeof win.go?.main?.App?.GetResourceCounts === 'function';
    };
    const waitForWailsBinding = async () => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (!active) return false;
        if (hasWailsBinding()) return true;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return hasWailsBinding();
    };
    const computeSig = (c: any) => {
      if (!c) return 'none';
      const ps = c.podStatus || c.PodStatus || {}; // pod status signature prominent
      return [
        ps.running || ps.Running || 0,
        ps.pending || ps.Pending || 0,
        ps.failed || ps.Failed || 0,
        ps.succeeded || ps.Succeeded || 0,
        ps.unknown || ps.Unknown || 0,
        ps.total || ps.Total || 0,
        c.services || c.Services || 0,
        c.deployments, c.jobs, c.cronjobs, c.daemonsets, c.statefulsets, c.replicasets,
        c.configmaps, c.secrets, c.ingresses, c.persistentvolumeclaims, c.persistentvolumes,
      ].join('-');
    };
    const normalize = (raw: any) => {
      if (!raw) return raw;
      // Ensure camelCase keys (keep original too in case UI references uppercase elsewhere)
      if (raw.PodStatus && !raw.podStatus) raw.podStatus = raw.PodStatus;
      if (raw.Services && !raw.services) raw.services = raw.Services;
      return raw;
    };
    const applyCounts = (data: any) => {
      const norm = normalize(data);
      const sig = computeSig(norm);
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig;
        if (active) setCounts(norm);
      }
    };
    (async () => {
      if (!(await waitForWailsBinding())) return;
      try {
        await GetResourceCounts().then(applyCounts).catch(() => {});
      } catch {
        return;
      }
      off = EventsOn('resourcecounts:update', (data: any) => {
        try {
          applyCounts(data);
        } catch (_) {}
      });
    })();
    return () => { active = false; if (typeof off === 'function') off(); };
  }, []);

  return (
    <ResourceCountsContext.Provider value={{ counts, lastUpdated: Date.now() }}>
      {children}
    </ResourceCountsContext.Provider>
  );
}

export function useResourceCounts() {
  return useContext(ResourceCountsContext);
}