import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { GetResourceCounts } from '../k8s/resources/kubeApi.js';
import { EventsOn } from '../../wailsjs/runtime';

const ResourceCountsContext = createContext({ counts: null, lastUpdated: 0 });

export function ResourceCountsProvider({ children }) {
  const [counts, setCounts] = useState(null);
  const lastSigRef = useRef(null);

  useEffect(() => {
    let active = true;
    const computeSig = (c) => {
      if (!c) return 'none';
      const ps = c.podStatus || c.PodStatus || {}; // pod status signature prominent
      return [
        ps.running||ps.Running||0,
        ps.pending||ps.Pending||0,
        ps.failed||ps.Failed||0,
        ps.succeeded||ps.Succeeded||0,
        ps.unknown||ps.Unknown||0,
        ps.total||ps.Total||0,
        c.services || c.Services || 0,
        c.deployments, c.jobs, c.cronjobs, c.daemonsets, c.statefulsets, c.replicasets,
        c.configmaps, c.secrets, c.ingresses, c.persistentvolumeclaims, c.persistentvolumes
      ].join('-');
    };
    const normalize = (raw) => {
      if (!raw) return raw;
      // Ensure camelCase keys (keep original too in case UI references uppercase elsewhere)
      if (raw.PodStatus && !raw.podStatus) raw.podStatus = raw.PodStatus;
      if (raw.Services && !raw.services) raw.services = raw.Services;
      return raw;
    };
    const applyCounts = (data) => {
      const norm = normalize(data);
      const sig = computeSig(norm);
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig;
        if (active) setCounts(norm);
      }
    };
    GetResourceCounts().then(applyCounts).catch(()=>{});
    const off = EventsOn('resourcecounts:update', (data) => { try { applyCounts(data); } catch(_) {} });
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
