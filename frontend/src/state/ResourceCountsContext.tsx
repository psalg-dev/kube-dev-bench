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
  const [lastUpdated, setLastUpdated] = useState(0);
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
        // Pod status
        ps.running || ps.Running || 0,
        ps.pending || ps.Pending || 0,
        ps.failed || ps.Failed || 0,
        ps.succeeded || ps.Succeeded || 0,
        ps.unknown || ps.Unknown || 0,
        ps.total || ps.Total || 0,
        // Core resources
        c.services || c.Services || 0,
        c.deployments || c.Deployments || 0,
        c.jobs || c.Jobs || 0,
        c.cronjobs || c.CronJobs || 0,
        c.daemonsets || c.DaemonSets || 0,
        c.statefulsets || c.StatefulSets || 0,
        c.replicasets || c.ReplicaSets || 0,
        c.configmaps || c.ConfigMaps || 0,
        c.secrets || c.Secrets || 0,
        c.ingresses || c.Ingresses || 0,
        c.persistentvolumeclaims || c.PersistentVolumeClaims || 0,
        c.persistentvolumes || c.PersistentVolumes || 0,
        c.helmreleases || c.HelmReleases || 0,
        // RBAC resources
        c.roles || c.Roles || 0,
        c.clusterroles || c.ClusterRoles || 0,
        c.rolebindings || c.RoleBindings || 0,
        c.clusterrolebindings || c.ClusterRoleBindings || 0,
      ].join('-');
    };
    const normalize = (raw: any) => {
      if (!raw) return raw;
      // Ensure camelCase keys (keep original too in case UI references uppercase elsewhere)
      if (raw.PodStatus && !raw.podStatus) raw.podStatus = raw.PodStatus;
      if (raw.Services && !raw.services) raw.services = raw.Services;
      // RBAC camelCase normalization
      if (raw.Roles && !raw.roles) raw.roles = raw.Roles;
      if (raw.ClusterRoles && !raw.clusterroles) raw.clusterroles = raw.ClusterRoles;
      if (raw.RoleBindings && !raw.rolebindings) raw.rolebindings = raw.RoleBindings;
      if (raw.ClusterRoleBindings && !raw.clusterrolebindings) raw.clusterrolebindings = raw.ClusterRoleBindings;
      return raw;
    };
    const applyCounts = (data: any) => {
      const norm = normalize(data);
      const sig = computeSig(norm);
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig;
        if (active) setCounts(norm);
        if (active) setLastUpdated(Date.now());
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
    <ResourceCountsContext.Provider value={{ counts, lastUpdated }}>
      {children}
    </ResourceCountsContext.Provider>
  );
}

export function useResourceCounts() {
  return useContext(ResourceCountsContext);
}
