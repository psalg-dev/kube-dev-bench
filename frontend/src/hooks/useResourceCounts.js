import { useEffect, useRef } from 'react';
import {
  GetPodStatusCounts,
  GetRunningPods,
  GetDeployments,
  GetJobs,
  GetCronJobs,
  GetDaemonSets,
  GetStatefulSets,
  GetReplicaSets,
  GetConfigMaps,
  GetSecrets,
  GetIngresses,
  GetPersistentVolumeClaims,
  GetPersistentVolumes,
} from '../services/kubeApi';
import { aggregatePodStatusCounts, podAggSignature, flattenLength } from '../utils/aggregateCounts';

/**
 * Polls cluster for pod + resource counts and updates existing sidebar DOM nodes (legacy approach).
 * Future refactor: return counts object for declarative rendering.
 */
export function useResourceCounts(namespaces) {
  const timerRef = useRef(null);
  const lastPodSigRef = useRef(null);
  const lastCountsRef = useRef({});

  useEffect(() => {
    if (!namespaces || namespaces.length === 0) return;
    const elId = 'sidebar-pod-counts';

    const update = async () => {
      const el = document.getElementById(elId);
      try {
        const countsList = await Promise.all((namespaces||[]).map(ns => GetPodStatusCounts(ns).catch(() => null)));
        const agg = aggregatePodStatusCounts(countsList);
        const sig = podAggSignature(agg);
        if (sig !== lastPodSigRef.current && el) {
          lastPodSigRef.current = sig;
          const parts = [];
          const pushPart = (value, color, title) => { if (!value) return; parts.push(`<span title="${title}" style="color:${color}; font-weight:700;">${value}</span>`); };
          pushPart(agg.running, '#2ea44f', 'Running');
            pushPart(agg.pending, '#e6b800', 'Pending/Creating');
            pushPart(agg.failed, '#d73a49', 'Failed');
            pushPart(agg.succeeded, '#9aa0a6', 'Succeeded');
            pushPart(agg.unknown, '#9aa0a6', 'Unknown');
          if (agg.total === 0) {
            el.innerHTML = '<span style="color:#9aa0a6; font-weight:700;">0</span>';
          } else if (parts.length > 0) {
            el.innerHTML = parts.join('<span style="color:#666;">/</span>');
          } else {
            el.innerHTML = `<span style="color:#2ea44f; font-weight:700;">${agg.running || 0}</span>`;
          }
        }
      } catch(err) {
        try {
          const lists = await Promise.all((namespaces||[]).map(ns => GetRunningPods(ns).catch(()=>[])));
          const count = lists.reduce((n,a)=> n + (Array.isArray(a)?a.length:0), 0);
          const fallbackSig = 'r-' + count;
          if (fallbackSig !== lastPodSigRef.current && el) {
            lastPodSigRef.current = fallbackSig;
            el.innerHTML = `<span title="Running" style="color:#2ea44f; font-weight:700;">${count}</span>`;
          }
        } catch(_) {
          if (el) el.innerHTML = '<span style="color:#9aa0a6; font-weight:700;">0</span>';
        }
      }

      // other resources
      try {
        const nsArr = namespaces || [];
        const [depLists, jobLists, cjLists, dsLists, ssLists, rsLists, cmLists, secLists, ingLists, pvcLists, pvs] = await Promise.all([
          Promise.all(nsArr.map(ns => GetDeployments(ns).catch(() => []))),
          Promise.all(nsArr.map(ns => GetJobs(ns).catch(() => []))),
          Promise.all(nsArr.map(ns => GetCronJobs(ns).catch(() => []))),
          Promise.all(nsArr.map(ns => GetDaemonSets(ns).catch(() => []))),
          Promise.all(nsArr.map(ns => GetStatefulSets(ns).catch(() => []))),
          Promise.all(nsArr.map(ns => GetReplicaSets(ns).catch(() => []))),
          Promise.all(nsArr.map(ns => GetConfigMaps(ns).catch(() => []))),
          Promise.all(nsArr.map(ns => GetSecrets(ns).catch(() => []))),
          Promise.all(nsArr.map(ns => GetIngresses(ns).catch(() => []))),
          Promise.all(nsArr.map(ns => GetPersistentVolumeClaims(ns).catch(() => []))),
          GetPersistentVolumes().catch(() => []),
        ]);
        const lastCounts = lastCountsRef.current;
        const setCount = (id, key, value) => {
          const el = document.getElementById(id);
          if (!el) return;
          const next = typeof value === 'number' ? value : (Array.isArray(value) ? value.length : 0);
          if (lastCounts[key] !== next) {
            lastCounts[key] = next;
            el.textContent = String(next);
            el.style.color = next > 0 ? '#8ecfff' : '#9aa0a6';
          }
        };
        setCount('sidebar-deployments-count', 'deployments', flattenLength(depLists));
        setCount('sidebar-jobs-count', 'jobs', flattenLength(jobLists));
        setCount('sidebar-cronjobs-count', 'cronjobs', flattenLength(cjLists));
        setCount('sidebar-daemonsets-count', 'daemonsets', flattenLength(dsLists));
        setCount('sidebar-statefulsets-count', 'statefulsets', flattenLength(ssLists));
        setCount('sidebar-replicasets-count', 'replicasets', flattenLength(rsLists));
        setCount('sidebar-configmaps-count', 'configmaps', flattenLength(cmLists));
        setCount('sidebar-secrets-count', 'secrets', flattenLength(secLists));
        setCount('sidebar-ingresses-count', 'ingresses', flattenLength(ingLists));
        setCount('sidebar-persistentvolumeclaims-count', 'persistentvolumeclaims', flattenLength(pvcLists));
        setCount('sidebar-persistentvolumes-count', 'persistentvolumes', pvs);
      } catch(_) {}
    };
    update();
    timerRef.current = setInterval(update, 4000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [JSON.stringify(namespaces)]);
}

