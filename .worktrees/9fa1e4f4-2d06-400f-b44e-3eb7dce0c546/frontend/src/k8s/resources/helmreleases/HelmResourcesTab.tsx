/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

type HelmResourcesTabProps = {
  namespace?: string;
  releaseName?: string;
};

type HelmResourceRef = {
  apiVersion: string;
  kind: string;
  name: string;
  namespace: string;
};

type NamespaceData = {
  deployments: Map<string, Record<string, any>>;
  statefulSets: Map<string, Record<string, any>>;
  daemonSets: Map<string, Record<string, any>>;
  replicaSets: Map<string, Record<string, any>>;
  jobs: Map<string, Record<string, any>>;
  cronJobs: Map<string, Record<string, any>>;
  configMaps: Map<string, Record<string, any>>;
  secrets: Map<string, Record<string, any>>;
  pvcs: Map<string, Record<string, any>>;
  ingresses: Map<string, Record<string, any>>;
  runningPods: Map<string, Record<string, any>>;
};

function splitYamlDocuments(yamlText: string) {
  if (!yamlText || typeof yamlText !== 'string') return [];
  return yamlText
    .split(/^---\s*$/m)
    .map((doc) => doc.trim())
    .filter(Boolean);
}

function parseResourceFromManifestDoc(docText: string): HelmResourceRef | null {
  const lines = (docText || '').split(/\r?\n/);

  let apiVersion = '';
  let kind = '';
  let name = '';
  let namespace = '';

  let inMetadata = false;
  let metadataIndent = -1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (!inMetadata) {
      if (!apiVersion && trimmed.startsWith('apiVersion:')) {
        apiVersion = trimmed.slice('apiVersion:'.length).trim();
        continue;
      }
      if (!kind && trimmed.startsWith('kind:')) {
        kind = trimmed.slice('kind:'.length).trim();
        continue;
      }
      if (trimmed === 'metadata:' || trimmed.startsWith('metadata:')) {
        inMetadata = true;
        metadataIndent = line.search(/\S/);
        continue;
      }
    } else {
      const indent = line.search(/\S/);
      if (indent <= metadataIndent) {
        inMetadata = false;
        metadataIndent = -1;
        // fall through to allow detecting other top-level keys on the same line in later iterations
        continue;
      }

      if (!name && trimmed.startsWith('name:')) {
        name = trimmed.slice('name:'.length).trim();
        continue;
      }
      if (!namespace && trimmed.startsWith('namespace:')) {
        namespace = trimmed.slice('namespace:'.length).trim();
        continue;
      }

      if (name && namespace) {
        // Keep scanning only if we still miss kind/apiVersion.
      }
    }

    if (kind && name && apiVersion) {
      // Enough information gathered; namespace may be empty for cluster-scoped resources.
      // We still let the loop continue only if we're inside metadata and could find namespace.
      if (!inMetadata || namespace) break;
    }
  }

  if (!kind || !name) return null;
  return {
    apiVersion: apiVersion || '-',
    kind,
    name,
    namespace: namespace || '-',
  };
}

function isLikelyClusterScopedKind(kind: string) {
  if (!kind) return false;
  if (kind.startsWith('Cluster')) return true;

  // A minimal heuristic list for common cluster-scoped resources.
  return [
    'Namespace',
    'Node',
    'PersistentVolume',
    'CustomResourceDefinition',
    'StorageClass',
    'MutatingWebhookConfiguration',
    'ValidatingWebhookConfiguration',
    'APIService',
    'PodSecurityPolicy',
  ].includes(kind);
}

function getHealthColor(health?: string) {
  const h = String(health || '').toLowerCase();

  // Match existing palette used in Helm tabs.
  const success = 'var(--gh-success-fg, #2ea44f)';
  const danger = 'var(--gh-danger-fg, #d73a49)';
  const attention = 'var(--gh-attention-fg, #e6b800)';
  const muted = 'var(--gh-text-muted, #8b949e)';

  if (!h || h === '…' || h === '...') return muted;
  if (h.startsWith('healthy') || h === 'ok') return success;
  if (h.startsWith('progressing') || h === 'suspended' || h === 'pending') return attention;
  if (h === 'unhealthy' || h === 'failed' || h === 'error') return danger;
  if (h === 'missing' || h === 'unknown') return muted;

  return muted;
}

export default function HelmResourcesTab({ namespace, releaseName }: HelmResourcesTabProps) {
  const [manifest, setManifest] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthByKey, setHealthByKey] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!namespace || !releaseName) {
      setManifest('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    AppAPI.GetHelmReleaseManifest(namespace, releaseName)
      .then((data) => setManifest(data || ''))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load release manifest');
        setManifest('');
      })
      .finally(() => setLoading(false));
  }, [namespace, releaseName]);

  const resources = useMemo(() => {
    const docs = splitYamlDocuments(manifest);
    const parsed = docs
      .map(parseResourceFromManifestDoc)
      .filter((r): r is HelmResourceRef => Boolean(r))
      .map((r) => {
        // Helm templates often omit metadata.namespace for namespaced objects.
        // Default to the release namespace for display purposes.
        if ((r.namespace === '-' || !r.namespace) && !isLikelyClusterScopedKind(r.kind)) {
          return { ...r, namespace: namespace || '-' };
        }
        return r;
      });

    // Stable sort for nicer scanning.
    parsed.sort((a, b) => {
      const kindCmp = String(a.kind).localeCompare(String(b.kind));
      if (kindCmp !== 0) return kindCmp;
      return String(a.name).localeCompare(String(b.name));
    });

    return parsed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest]);

  useEffect(() => {
    let cancelled = false;

    const resourceKey = (r: HelmResourceRef) => `${r.kind}/${r.namespace}/${r.name}`;
    const normalizeName = (obj: Record<string, any>) => obj?.name ?? obj?.Name;

    const computeWorkloadHealth = ({ ready, desired }: { ready?: number | string; desired?: number | string }) => {
      const d = Number(desired ?? 0);
      const rdy = Number(ready ?? 0);
      if (d <= 0) return 'Healthy';
      if (rdy >= d) return 'Healthy';
      return `Progressing (${rdy}/${d})`;
    };

    const fetchForNamespace = async (ns: string) => {
      const [
        deployments,
        statefulSets,
        daemonSets,
        replicaSets,
        jobs,
        cronJobs,
        configMaps,
        secrets,
        pvcs,
        ingresses,
        runningPods,
      ] = await Promise.all([
        AppAPI.GetDeployments(ns).catch(() => []),
        AppAPI.GetStatefulSets(ns).catch(() => []),
        AppAPI.GetDaemonSets(ns).catch(() => []),
        AppAPI.GetReplicaSets(ns).catch(() => []),
        AppAPI.GetJobs(ns).catch(() => []),
        AppAPI.GetCronJobs(ns).catch(() => []),
        AppAPI.GetConfigMaps(ns).catch(() => []),
        AppAPI.GetSecrets(ns).catch(() => []),
        AppAPI.GetPersistentVolumeClaims(ns).catch(() => []),
        AppAPI.GetIngresses(ns).catch(() => []),
        AppAPI.GetRunningPods(ns).catch(() => []),
      ]);

      const byName = (arr: Record<string, any>[]) => {
        const m = new Map();
        (arr || []).forEach((obj) => {
          const n = normalizeName(obj);
          if (n) m.set(n, obj);
        });
        return m;
      };

      return {
        deployments: byName(deployments),
        statefulSets: byName(statefulSets),
        daemonSets: byName(daemonSets),
        replicaSets: byName(replicaSets),
        jobs: byName(jobs),
        cronJobs: byName(cronJobs),
        configMaps: byName(configMaps),
        secrets: byName(secrets),
        pvcs: byName(pvcs),
        ingresses: byName(ingresses),
        runningPods: byName(runningPods),
      };
    };

    const computeHealth = (r: HelmResourceRef, nsDataByNamespace: Map<string, NamespaceData>) => {
      const ns = r.namespace && r.namespace !== '-' ? r.namespace : namespace;
      const nsData = ns ? nsDataByNamespace.get(ns) : null;
      const name = r.name;

      if (!nsData && !isLikelyClusterScopedKind(r.kind)) return 'Unknown';

      switch (r.kind) {
        case 'Deployment': {
          const d = nsData?.deployments?.get(name);
          if (!d) return 'Missing';
          return computeWorkloadHealth({ ready: d.ready ?? d.Ready, desired: d.replicas ?? d.Replicas });
        }
        case 'StatefulSet': {
          const s = nsData?.statefulSets?.get(name);
          if (!s) return 'Missing';
          return computeWorkloadHealth({ ready: s.ready ?? s.Ready, desired: s.replicas ?? s.Replicas });
        }
        case 'DaemonSet': {
          const ds = nsData?.daemonSets?.get(name);
          if (!ds) return 'Missing';
          return computeWorkloadHealth({ ready: ds.current ?? ds.Current, desired: ds.desired ?? ds.Desired });
        }
        case 'ReplicaSet': {
          const rs = nsData?.replicaSets?.get(name);
          if (!rs) return 'Missing';
          return computeWorkloadHealth({ ready: rs.ready ?? rs.Ready, desired: rs.replicas ?? rs.Replicas });
        }
        case 'Job': {
          const j = nsData?.jobs?.get(name);
          if (!j) return 'Missing';
          const failed = Number(j.failed ?? j.Failed ?? 0);
          const succeeded = Number(j.succeeded ?? j.Succeeded ?? 0);
          const active = Number(j.active ?? j.Active ?? 0);
          const completions = Number(j.completions ?? j.Completions ?? 1);
          if (failed > 0) return 'Unhealthy';
          if (succeeded >= completions) return 'Healthy';
          if (active > 0) return 'Progressing';
          return 'Unknown';
        }
        case 'CronJob': {
          const cj = nsData?.cronJobs?.get(name);
          if (!cj) return 'Missing';
          const suspended = Boolean(cj.suspend ?? cj.Suspend);
          return suspended ? 'Suspended' : 'OK';
        }
        case 'Pod': {
          // We only have running pods list (best-effort).
          const p = nsData?.runningPods?.get(name);
          return p ? 'Healthy' : 'Unknown';
        }
        case 'ConfigMap':
          return nsData?.configMaps?.has(name) ? 'OK' : 'Missing';
        case 'Secret':
          return nsData?.secrets?.has(name) ? 'OK' : 'Missing';
        case 'PersistentVolumeClaim': {
          const pvc = nsData?.pvcs?.get(name);
          if (!pvc) return 'Missing';
          const status = String(pvc.status ?? pvc.Status ?? '').toLowerCase();
          if (status === 'bound') return 'Healthy';
          if (status) return status;
          return 'Unknown';
        }
        case 'Ingress':
          return nsData?.ingresses?.has(name) ? 'OK' : 'Missing';
        default:
          return 'Unknown';
      }
    };

    const run = async () => {
      if (!resources || resources.length === 0) {
        setHealthByKey({});
        return;
      }

      const namespacesNeeded = Array.from(
        new Set(
          resources
            .filter((r) => !isLikelyClusterScopedKind(r.kind))
            .map((r) => (r.namespace && r.namespace !== '-' ? r.namespace : namespace))
            .filter((value): value is string => Boolean(value))
        )
      );

      const nsDataByNamespace = new Map<string, NamespaceData>();
      await Promise.all(
        namespacesNeeded.map(async (ns) => {
          const nsData = await fetchForNamespace(ns);
          nsDataByNamespace.set(ns, nsData);
        })
      );

      const next: Record<string, string> = {};
      for (const r of resources) {
        next[resourceKey(r)] = computeHealth(r, nsDataByNamespace);
      }

      if (!cancelled) setHealthByKey(next);
    };

    run().catch(() => {
      if (!cancelled) setHealthByKey({});
    });

    return () => {
      cancelled = true;
    };
  }, [resources, namespace]);

  const effectiveNamespace = (r: HelmResourceRef) => {
    if (!r) return namespace;
    if (r.namespace && r.namespace !== '-' && r.namespace !== '') return r.namespace;
    return namespace;
  };

  const navigateToResource = (r: HelmResourceRef) => {
    const event = new CustomEvent('navigate-to-resource', {
      detail: {
        resource: r.kind,
        name: r.name,
        namespace: isLikelyClusterScopedKind(r.kind) ? '' : (effectiveNamespace(r) || ''),
      },
    });
    window.dispatchEvent(event);
  };

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading resources...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: '#d73a49' }}>Error: {error}</div>;
  }

  if (resources.length === 0) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>No resources found</div>;
  }

  return (
    <div style={{ position: 'absolute', inset: 0, padding: 12, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <style>{`
        .helm-resources-table tbody tr {
          transition: background-color 0.15s ease;
        }
        .helm-resources-table tbody tr:hover td {
          background-color: var(--gh-hover-bg, rgba(177, 186, 196, 0.12));
        }
      `}</style>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <table className="helm-resources-table panel-table">
          <thead>
            <tr>
              <th>Health</th>
              <th>Kind</th>
              <th>Name</th>
              <th>Namespace</th>
              <th>API Version</th>
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => (
              <tr
                key={`${r.kind}/${r.namespace}/${r.name}`}
                onClick={() => navigateToResource(r)}
                style={{ cursor: 'pointer' }}
                title={`Open ${r.kind} ${r.name}`}
              >
                <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                  <span style={{ color: getHealthColor(healthByKey[`${r.kind}/${r.namespace}/${r.name}`]), fontWeight: 600 }}>
                    {healthByKey[`${r.kind}/${r.namespace}/${r.name}`] || '…'}
                  </span>
                </td>
                <td>{r.kind}</td>
                <td>{r.name}</td>
                <td className="text-muted">{r.namespace}</td>
                <td className="text-muted">{r.apiVersion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}