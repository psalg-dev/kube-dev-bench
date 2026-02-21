import { useMemo, useState } from 'react';
import { useClusterState } from '../../state/ClusterStateContext';
import { useResourceCounts } from '../../state/ResourceCountsContext';
import { ResourceGraphTab } from '../graph/ResourceGraphTab';
import './ClusterOverview.css';

const TAB_STATS = 'stats';
const TAB_RELATIONSHIPS = 'relationships';

type ClusterOverviewProps = {
  initialTab?: string;
};

type CountItem = {
  key: string;
  label: string;
  value: number;
  sub?: string;
};

function formatTime(ts: number) {
  if (!ts) return 'Waiting for first update...';
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return 'Waiting for first update...';
  }
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export default function ClusterOverview({ initialTab = TAB_STATS }: ClusterOverviewProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const { selectedContext, selectedNamespaces } = useClusterState() as unknown;
  const { counts, lastUpdated } = useResourceCounts() as unknown;

  const namespaces = Array.isArray(selectedNamespaces) ? selectedNamespaces : [];
  const primaryNamespace = namespaces[0] || '';

  const podStatus = useMemo(
    () => counts?.podStatus || counts?.PodStatus || {},
    [counts?.podStatus, counts?.PodStatus]
  );
  const countsByKey = useMemo(() => {
    if (!counts) return {} as Record<string, number>;
    return {
      pods: toNumber(podStatus.total ?? podStatus.Total),
      deployments: toNumber(counts.deployments ?? counts.Deployments),
      statefulsets: toNumber(counts.statefulsets ?? counts.StatefulSets),
      daemonsets: toNumber(counts.daemonsets ?? counts.DaemonSets),
      replicasets: toNumber(counts.replicasets ?? counts.ReplicaSets),
      jobs: toNumber(counts.jobs ?? counts.Jobs),
      cronjobs: toNumber(counts.cronjobs ?? counts.CronJobs),
      services: toNumber(counts.services ?? counts.Services),
      ingresses: toNumber(counts.ingresses ?? counts.Ingresses),
      configmaps: toNumber(counts.configmaps ?? counts.ConfigMaps),
      secrets: toNumber(counts.secrets ?? counts.Secrets),
      pvcs: toNumber(counts.persistentvolumeclaims ?? counts.PersistentVolumeClaims),
      pvs: toNumber(counts.persistentvolumes ?? counts.PersistentVolumes),
      helmreleases: toNumber(counts.helmreleases ?? counts.HelmReleases),
      roles: toNumber(counts.roles ?? counts.Roles),
      rolebindings: toNumber(counts.rolebindings ?? counts.RoleBindings),
      clusterroles: toNumber(counts.clusterroles ?? counts.ClusterRoles),
      clusterrolebindings: toNumber(counts.clusterrolebindings ?? counts.ClusterRoleBindings),
    };
  }, [counts, podStatus]);

  const podSummary = useMemo(() => {
    const running = toNumber(podStatus.running ?? podStatus.Running);
    const pending = toNumber(podStatus.pending ?? podStatus.Pending);
    const failed = toNumber(podStatus.failed ?? podStatus.Failed);
    const succeeded = toNumber(podStatus.succeeded ?? podStatus.Succeeded);
    const unknown = toNumber(podStatus.unknown ?? podStatus.Unknown);
    return `Running ${running} | Pending ${pending} | Failed ${failed} | Succeeded ${succeeded} | Unknown ${unknown}`;
  }, [podStatus]);

  const sections: Array<{ title: string; items: CountItem[] }> = [
    {
      title: 'Workloads',
      items: [
        { key: 'pods', label: 'Pods', value: countsByKey.pods, sub: podSummary },
        { key: 'deployments', label: 'Deployments', value: countsByKey.deployments },
        { key: 'statefulsets', label: 'Stateful Sets', value: countsByKey.statefulsets },
        { key: 'daemonsets', label: 'Daemon Sets', value: countsByKey.daemonsets },
        { key: 'replicasets', label: 'Replica Sets', value: countsByKey.replicasets },
        { key: 'jobs', label: 'Jobs', value: countsByKey.jobs },
        { key: 'cronjobs', label: 'Cron Jobs', value: countsByKey.cronjobs },
      ],
    },
    {
      title: 'Networking',
      items: [
        { key: 'services', label: 'Services', value: countsByKey.services },
        { key: 'ingresses', label: 'Ingresses', value: countsByKey.ingresses },
      ],
    },
    {
      title: 'Config',
      items: [
        { key: 'configmaps', label: 'Config Maps', value: countsByKey.configmaps },
        { key: 'secrets', label: 'Secrets', value: countsByKey.secrets },
      ],
    },
    {
      title: 'Storage',
      items: [
        { key: 'pvcs', label: 'PVCs', value: countsByKey.pvcs },
        { key: 'pvs', label: 'PVs', value: countsByKey.pvs },
      ],
    },
    {
      title: 'RBAC',
      items: [
        { key: 'roles', label: 'Roles', value: countsByKey.roles },
        { key: 'rolebindings', label: 'Role Bindings', value: countsByKey.rolebindings },
        { key: 'clusterroles', label: 'Cluster Roles', value: countsByKey.clusterroles },
        { key: 'clusterrolebindings', label: 'Cluster Role Bindings', value: countsByKey.clusterrolebindings },
      ],
    },
    {
      title: 'Packaging',
      items: [
        { key: 'helmreleases', label: 'Helm Releases', value: countsByKey.helmreleases },
      ],
    },
  ];

  return (
    <div className="clusterOverviewRoot" data-testid="cluster-overview">
      <div className="clusterOverviewHeader">
        <div>
          <div className="clusterOverviewTitle">Cluster</div>
          <div className="clusterOverviewMeta">
            <span>{selectedContext || 'No context selected'}</span>
            {namespaces.length > 0 ? (
              <span>- {namespaces.join(', ')}</span>
            ) : (
              <span>- No namespaces selected</span>
            )}
          </div>
        </div>
        <div className="clusterOverviewMeta">
          Last update: {formatTime(lastUpdated)}
        </div>
      </div>

      <div className="clusterOverviewTabs" role="tablist" aria-label="Cluster Overview Tabs">
        <button
          id="cluster-overview-tab-stats"
          type="button"
          role="tab"
          aria-selected={activeTab === TAB_STATS}
          className={`clusterOverviewTabBtn${activeTab === TAB_STATS ? ' active' : ''}`}
          onClick={() => setActiveTab(TAB_STATS)}
        >
          Stats
        </button>
        <button
          id="cluster-overview-tab-relationships"
          type="button"
          role="tab"
          aria-selected={activeTab === TAB_RELATIONSHIPS}
          className={`clusterOverviewTabBtn${activeTab === TAB_RELATIONSHIPS ? ' active' : ''}`}
          onClick={() => setActiveTab(TAB_RELATIONSHIPS)}
        >
          Relationships
        </button>
      </div>

      <div className="clusterOverviewContent">
        {activeTab === TAB_STATS ? (
          <div className="clusterOverviewStats">
            {counts ? (
              sections.map((section) => (
                <div className="clusterOverviewSection" key={section.title}>
                  <div className="clusterOverviewSectionTitle">{section.title}</div>
                  <div className="clusterOverviewGrid">
                    {section.items.map((item) => (
                      <div className="clusterOverviewCard" key={item.key}>
                        <div className="clusterOverviewCardLabel">{item.label}</div>
                        <div className="clusterOverviewCardValue">{item.value}</div>
                        {item.sub ? <div className="clusterOverviewCardSub">{item.sub}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="clusterOverviewEmpty">Waiting for cluster stats...</div>
            )}
          </div>
        ) : null}

        {activeTab === TAB_RELATIONSHIPS ? (
          <div className="clusterOverviewRelationships">
            {primaryNamespace ? (
              <>
                {namespaces.length > 1 && (
                  <div className="clusterOverviewHint">
                    Showing relationships for {primaryNamespace} (first selected namespace).
                  </div>
                )}
                <ResourceGraphTab
                  namespace={primaryNamespace}
                  kind="Namespace"
                  name={primaryNamespace}
                />
              </>
            ) : (
              <div className="clusterOverviewEmpty">Select a namespace to view relationships.</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
