/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useClusterState } from './ClusterStateContext';
import { GetResourceCounts } from '../k8s/resources/kubeApi';
import { EventsOn } from '../../wailsjs/runtime';

type ResourceCounts = Record<string, any> | null;

type ResourceCountsContextValue = {
  counts: ResourceCounts;
  lastUpdated: number;
};

const ResourceCountsContext = createContext<ResourceCountsContextValue>({ counts: null, lastUpdated: 0 });
export { ResourceCountsContext };

export function ResourceCountsProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<ResourceCounts>(null);
  const [lastUpdated, setLastUpdated] = useState(0);
  const lastSigRef = useRef<string | null>(null);
  const { selectedNamespaces } = useClusterState() as { selectedNamespaces?: string[] };
  const namespaceSig = Array.isArray(selectedNamespaces) ? selectedNamespaces.join('|') : '';

  useEffect(() => {
    let active = true;
    let off: (() => void) | undefined;
    queueMicrotask(() => {
      if (!active) return;
      setCounts(null);
      setLastUpdated(0);
      lastSigRef.current = null;
    });
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
      const podStatus = c.podStatus ?? c.PodStatus ?? {}; // pod status signature prominent
      const getCount = (lower: any, upper: any) => {
        if (typeof lower === 'number') return lower;
        if (typeof upper === 'number') return upper;
        return 0;
      };
      return [
        namespaceSig,
        // Pod status
        getCount(podStatus.running, podStatus.Running),
        getCount(podStatus.pending, podStatus.Pending),
        getCount(podStatus.failed, podStatus.Failed),
        getCount(podStatus.succeeded, podStatus.Succeeded),
        getCount(podStatus.unknown, podStatus.Unknown),
        getCount(podStatus.total, podStatus.Total),
        // Core resources
        getCount(c.services, c.Services),
        getCount(c.deployments, c.Deployments),
        getCount(c.jobs, c.Jobs),
        getCount(c.cronjobs, c.CronJobs),
        getCount(c.daemonsets, c.DaemonSets),
        getCount(c.statefulsets, c.StatefulSets),
        getCount(c.replicasets, c.ReplicaSets),
        getCount(c.configmaps, c.ConfigMaps),
        getCount(c.secrets, c.Secrets),
        getCount(c.ingresses, c.Ingresses),
        getCount(c.persistentvolumeclaims, c.PersistentVolumeClaims),
        getCount(c.persistentvolumes, c.PersistentVolumes),
        getCount(c.helmreleases, c.HelmReleases),
        // RBAC resources
        getCount(c.roles, c.Roles),
        getCount(c.clusterroles, c.ClusterRoles),
        getCount(c.rolebindings, c.RoleBindings),
        getCount(c.clusterrolebindings, c.ClusterRoleBindings),
      ].join('-');
    };
    const normalize = (raw: any) => {
      if (!raw) return raw;
      // Ensure camelCase keys (keep original too in case UI references uppercase elsewhere)
      // Use explicit undefined checks (not truthiness) so zero values are preserved
      if (raw.PodStatus !== undefined && raw.podStatus === undefined) raw.podStatus = raw.PodStatus;
      if (raw.Services !== undefined && raw.services === undefined) raw.services = raw.Services;
      // RBAC counts normalization ensures camelCase keys for UI and signature tracking
      if (raw.Roles !== undefined && raw.roles === undefined) raw.roles = raw.Roles;
      if (raw.ClusterRoles !== undefined && raw.clusterroles === undefined) raw.clusterroles = raw.ClusterRoles;
      if (raw.RoleBindings !== undefined && raw.rolebindings === undefined) raw.rolebindings = raw.RoleBindings;
      if (raw.ClusterRoleBindings !== undefined && raw.clusterrolebindings === undefined) raw.clusterrolebindings = raw.ClusterRoleBindings;
      return raw;
    };
    const applyCounts = (data: any) => {
      const norm = normalize(data);
      const sig = computeSig(norm);
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig;
        if (active) {
          setCounts(norm);
          setLastUpdated(Date.now());
        }
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
        } catch {}
      });
    })();
    return () => {
      active = false;
      if (typeof off === 'function') off();
    };
  }, [namespaceSig]);

  return (
    <ResourceCountsContext.Provider value={{ counts, lastUpdated }}>
      {children}
    </ResourceCountsContext.Provider>
  );
}

export function useResourceCounts() {
  return useContext(ResourceCountsContext);
}
