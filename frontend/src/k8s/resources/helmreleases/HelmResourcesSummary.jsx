import { useEffect, useMemo, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

function splitYamlDocuments(yamlText) {
  if (!yamlText || typeof yamlText !== 'string') return [];
  return yamlText
    .split(/^---\s*$/m)
    .map((doc) => doc.trim())
    .filter(Boolean);
}

function parseResourceFromManifestDoc(docText) {
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
    }

    if (kind && name && apiVersion) {
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

function isLikelyClusterScopedKind(kind) {
  if (!kind) return false;
  if (kind.startsWith('Cluster')) return true;

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

function getHealthColor(health) {
  const h = String(health || '').toLowerCase();

  const success = 'var(--gh-success-fg, #2ea44f)';
  const danger = 'var(--gh-danger-fg, #d73a49)';
  const attention = 'var(--gh-attention-fg, #e6b800)';
  const muted = 'var(--gh-text-muted, #8b949e)';

  if (!h || h === '…' || h === '...') return muted;
  if (h.startsWith('healthy') || h === 'ok') return success;
  if (h.startsWith('progressing') || h === 'suspended' || h === 'pending')
    return attention;
  if (h === 'unhealthy' || h === 'failed' || h === 'error') return danger;
  if (h === 'missing' || h === 'unknown') return muted;

  return muted;
}

export default function HelmResourcesSummary({ namespace, releaseName }) {
  const [manifest, setManifest] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [healthByKey, setHealthByKey] = useState({});

  useEffect(() => {
    setLoading(true);
    setError(null);

    AppAPI.GetHelmReleaseManifest(namespace, releaseName)
      .then((data) => setManifest(data || ''))
      .catch((err) => {
        setError(err?.message || 'Failed to load release manifest');
        setManifest('');
      })
      .finally(() => setLoading(false));
  }, [namespace, releaseName]);

  const resources = useMemo(() => {
    const docs = splitYamlDocuments(manifest);
    const parsed = docs
      .map(parseResourceFromManifestDoc)
      .filter(Boolean)
      .map((r) => {
        if (
          (r.namespace === '-' || !r.namespace) &&
          !isLikelyClusterScopedKind(r.kind)
        ) {
          return { ...r, namespace: namespace || '-' };
        }
        return r;
      });

    parsed.sort((a, b) => {
      const kindCmp = String(a.kind).localeCompare(String(b.kind));
      if (kindCmp !== 0) return kindCmp;
      return String(a.name).localeCompare(String(b.name));
    });

    return parsed;
  }, [manifest, namespace]);

  useEffect(() => {
    let cancelled = false;

    const resourceKey = (r) => `${r.kind}/${r.namespace}/${r.name}`;
    const normalizeName = (obj) => obj?.name ?? obj?.Name;

    const computeWorkloadHealth = ({ ready, desired }) => {
      const d = Number(desired ?? 0);
      const rdy = Number(ready ?? 0);
      if (d <= 0) return 'Healthy';
      if (rdy >= d) return 'Healthy';
      return `Progressing (${rdy}/${d})`;
    };

    const fetchForNamespace = async (ns) => {
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

      const byName = (arr) => {
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

    const computeHealth = (r, nsDataByNamespace) => {
      const ns = r.namespace && r.namespace !== '-' ? r.namespace : namespace;
      const nsData = ns ? nsDataByNamespace.get(ns) : null;
      const name = r.name;

      if (!nsData && !isLikelyClusterScopedKind(r.kind)) return 'Unknown';

      switch (r.kind) {
        case 'Deployment': {
          const d = nsData?.deployments?.get(name);
          if (!d) return 'Missing';
          return computeWorkloadHealth({
            ready: d.ready ?? d.Ready,
            desired: d.replicas ?? d.Replicas,
          });
        }
        case 'StatefulSet': {
          const s = nsData?.statefulSets?.get(name);
          if (!s) return 'Missing';
          return computeWorkloadHealth({
            ready: s.ready ?? s.Ready,
            desired: s.replicas ?? s.Replicas,
          });
        }
        case 'DaemonSet': {
          const ds = nsData?.daemonSets?.get(name);
          if (!ds) return 'Missing';
          return computeWorkloadHealth({
            ready: ds.current ?? ds.Current,
            desired: ds.desired ?? ds.Desired,
          });
        }
        case 'ReplicaSet': {
          const rs = nsData?.replicaSets?.get(name);
          if (!rs) return 'Missing';
          return computeWorkloadHealth({
            ready: rs.ready ?? rs.Ready,
            desired: rs.replicas ?? rs.Replicas,
          });
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
            .map((r) =>
              r.namespace && r.namespace !== '-' ? r.namespace : namespace,
            )
            .filter(Boolean),
        ),
      );

      const nsDataByNamespace = new Map();
      await Promise.all(
        namespacesNeeded.map(async (ns) => {
          const nsData = await fetchForNamespace(ns);
          nsDataByNamespace.set(ns, nsData);
        }),
      );

      const next = {};
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

  const effectiveNamespace = (r) => {
    if (!r) return namespace;
    if (r.namespace && r.namespace !== '-' && r.namespace !== '')
      return r.namespace;
    return namespace;
  };

  const navigateToResource = (r) => {
    const event = new CustomEvent('navigate-to-resource', {
      detail: {
        resource: r.kind,
        name: r.name,
        namespace: isLikelyClusterScopedKind(r.kind)
          ? ''
          : effectiveNamespace(r) || '',
      },
    });
    window.dispatchEvent(event);
  };

  if (loading) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: 44,
            padding: '0 12px',
            borderBottom: '1px solid var(--gh-border, #30363d)',
            display: 'flex',
            alignItems: 'center',
            fontWeight: 600,
          }}
        >
          Resources
        </div>
        <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>
          Loading resources...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: 44,
            padding: '0 12px',
            borderBottom: '1px solid var(--gh-border, #30363d)',
            display: 'flex',
            alignItems: 'center',
            fontWeight: 600,
          }}
        >
          Resources
        </div>
        <div style={{ padding: 16, color: '#d73a49' }}>Error: {error}</div>
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: 44,
            padding: '0 12px',
            borderBottom: '1px solid var(--gh-border, #30363d)',
            display: 'flex',
            alignItems: 'center',
            fontWeight: 600,
          }}
        >
          Resources
        </div>
        <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>
          No resources found
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 44,
          padding: '0 12px',
          borderBottom: '1px solid var(--gh-border, #30363d)',
          display: 'flex',
          alignItems: 'center',
          fontWeight: 600,
        }}
      >
        Resources ({resources.length})
      </div>
      <style>{`
        .helm-resources-summary-table tbody tr {
          transition: background-color 0.15s ease;
        }
        .helm-resources-summary-table tbody tr:hover td {
          background-color: var(--gh-hover-bg, rgba(177, 186, 196, 0.12));
        }
        .helm-resources-summary-table th {
          background: var(--gh-canvas-default, #181818);
          color: var(--gh-text-muted, #858585);
          font-weight: 600;
          position: sticky;
          top: 0;
          z-index: 1;
        }
      `}</style>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <table
          className="helm-resources-summary-table panel-table"
          style={{ fontSize: 13, width: '100%', borderCollapse: 'collapse' }}
        >
          <thead>
            <tr>
              <th
                style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--gh-border, #3c3c3c)',
                }}
              >
                Health
              </th>
              <th
                style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--gh-border, #3c3c3c)',
                }}
              >
                Kind
              </th>
              <th
                style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--gh-border, #3c3c3c)',
                }}
              >
                Name
              </th>
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
                <td
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--gh-border, #3c3c3c)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      color: getHealthColor(
                        healthByKey[`${r.kind}/${r.namespace}/${r.name}`],
                      ),
                      fontWeight: 600,
                    }}
                  >
                    {healthByKey[`${r.kind}/${r.namespace}/${r.name}`] || '…'}
                  </span>
                </td>
                <td
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--gh-border, #3c3c3c)',
                    fontWeight: 500,
                  }}
                >
                  {r.kind}
                </td>
                <td
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--gh-border, #3c3c3c)',
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--gh-text-muted, #858585)',
                  }}
                  title={r.name}
                >
                  {r.name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
