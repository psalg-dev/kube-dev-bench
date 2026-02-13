import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useResourceCounts } from '../state/ResourceCountsContext';
import './SidebarSections.css';

type ResourceSection = {
  key: string;
  label: string;
  podCounts?: boolean;
  hideCount?: boolean;
  group?: boolean;
  children?: Array<ResourceSection>;
};

type PodStatus = {
  running?: number;
  pending?: number;
  failed?: number;
  succeeded?: number;
  unknown?: number;
  total?: number;
};

// Resource sections list with id suffix & label
const resourceSections: ResourceSection[] = [
  {
    key: 'cluster',
    label: 'Cluster',
    hideCount: true,
  },
  {
    key: 'topology',
    label: 'Topology',
    group: true,
    children: [
      { key: 'namespace-topology', label: 'Namespace Graph', hideCount: true },
      { key: 'storage-graph', label: 'Storage', hideCount: true },
      { key: 'network-graph', label: 'Network Policy', hideCount: true },
      { key: 'rbac-graph', label: 'RBAC', hideCount: true },
    ],
  },
  {
    key: 'workloads',
    label: 'Workloads',
    group: true,
    children: [
      { key: 'pods', label: 'Pods', podCounts: true },
      { key: 'nodes', label: 'Nodes' },
      { key: 'deployments', label: 'Deployments' },
      { key: 'daemonsets', label: 'Daemon Sets' },
      { key: 'statefulsets', label: 'Stateful Sets' },
      { key: 'replicasets', label: 'Replica Sets' },
      { key: 'hpa', label: 'Horizontal Pod Autoscalers' },
      { key: 'jobs', label: 'Jobs' },
      { key: 'cronjobs', label: 'Cron Jobs' },
    ],
  },
  {
    key: 'networking',
    label: 'Networking',
    group: true,
    children: [
      { key: 'services', label: 'Services' },
      { key: 'ingresses', label: 'Ingresses' },
    ],
  },
  {
    key: 'config',
    label: 'Config',
    group: true,
    children: [
      { key: 'configmaps', label: 'Config Maps' },
      { key: 'secrets', label: 'Secrets' },
    ],
  },
  {
    key: 'storage',
    label: 'Storage',
    group: true,
    children: [
      { key: 'persistentvolumeclaims', label: 'Persistent Volume Claims' },
      { key: 'persistentvolumes', label: 'Persistent Volumes' },
    ],
  },
  {
    key: 'packaging',
    label: 'Packaging',
    group: true,
    children: [
      { key: 'helmreleases', label: 'Helm Releases' },
    ],
  },
  {
    key: 'rbac',
    label: 'RBAC',
    group: true,
    children: [
      { key: 'roles', label: 'Roles' },
      { key: 'clusterroles', label: 'Cluster Roles' },
      { key: 'rolebindings', label: 'Role Bindings' },
      { key: 'clusterrolebindings', label: 'Cluster Role Bindings' },
    ],
  },
];

const groupSections = resourceSections.filter((sec) => sec.group);
const groupByChildKey = new Map<string, string>();
groupSections.forEach((sec) => {
  sec.children?.forEach((child) => {
    groupByChildKey.set(child.key, sec.key);
  });
});

function getPodTotal(counts?: Record<string, unknown> | null) {
  const podStatus = counts?.podStatus || counts?.PodStatus;
  const total = podStatus?.total ?? podStatus?.Total;
  return typeof total === 'number' ? total : undefined;
}

function getSectionCount(section: ResourceSection, counts?: Record<string, unknown> | null) {
  if (!counts) return undefined;
  if (section.podCounts) return getPodTotal(counts);
  const value = counts?.[section.key];
  return typeof value === 'number' ? value : undefined;
}

function PodCountsDisplay({ podStatus }: { podStatus?: PodStatus }) {
  const parts = useMemo<ReactNode[]>(() => {
    if (!podStatus) return [];
    const { running = 0, pending = 0, failed = 0, succeeded = 0, unknown = 0, total = 0 } = podStatus;
    if (total === 0) return [<span key="zero" className="sidebar-pod-count sidebar-pod-count--muted">0</span>];
    const segs: ReactNode[] = [];
    const push = (val: number, className: string, title: string, k: string) => {
      if (val) segs.push(<span key={k} title={title} className={className}>{val}</span>);
    };
    push(running, 'sidebar-pod-count sidebar-pod-count--running', 'Running', 'r');
    push(pending, 'sidebar-pod-count sidebar-pod-count--pending', 'Pending/Creating', 'p');
    push(failed, 'sidebar-pod-count sidebar-pod-count--failed', 'Failed', 'f');
    push(succeeded, 'sidebar-pod-count sidebar-pod-count--muted', 'Succeeded', 's');
    push(unknown, 'sidebar-pod-count sidebar-pod-count--muted', 'Unknown', 'u');
    if (segs.length === 0) {
      return [
        <span key="running" className="sidebar-pod-count sidebar-pod-count--running">
          {running || 0}
        </span>,
      ];
    }
    const withSeps: ReactNode[] = [];
    segs.forEach((el, i) => {
      withSeps.push(el);
      if (i < segs.length - 1) {
        withSeps.push(
          <span key={`sep${i}`} className="sidebar-pod-count-sep">
            /
          </span>
        );
      }
    });
    return withSeps;
  }, [podStatus]);
  return (
    <span className="sidebar-pod-counts">
      {parts}
    </span>
  );
}
type SidebarSectionsProps = {
  selected: string;
  onSelect: (_section: string) => void;
};

export function SidebarSections({ selected, onSelect }: SidebarSectionsProps) {
  const { counts } = useResourceCounts() as {
    counts: (Record<string, number> & { podStatus?: PodStatus; PodStatus?: PodStatus }) | null;
  };
  const safeCounts = counts || undefined;
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groupSections.map((sec) => [sec.key, true]))
  );
  const selectedGroup = groupByChildKey.get(selected);

  useEffect(() => {
    if (selectedGroup) {
      const timerId = window.setTimeout(() => {
        setCollapsedGroups((prev) => (prev[selectedGroup] ? { ...prev, [selectedGroup]: false } : prev));
      }, 0);
      return () => {
        window.clearTimeout(timerId);
      };
    }
  }, [selectedGroup]);
  return (
    <div>
      {resourceSections.map((sec) => {
        if (sec.group) {
          const isExpanded = !collapsedGroups[sec.key];
          const isGroupSelected = selectedGroup === sec.key;
          const agg = sec.children?.reduce((sum, child) => {
            const childValue = getSectionCount(child, safeCounts);
            return sum + (childValue ?? 0);
          }, 0) ?? 0;
          const hasAggregate = agg > 0;
          return (
            <div key={sec.key} className="sidebar-group">
              <div
                id={`section-${sec.key}`}
                className={`sidebar-section sidebar-group-header${isExpanded || isGroupSelected ? ' selected' : ''}`}
                role="button"
                aria-expanded={isExpanded}
                aria-controls={`section-${sec.key}-children`}
                aria-label={`${sec.label} section`}
                tabIndex={0}
                data-testid={`${sec.key}-group-header`}
                onClick={(event) => {
                  event.stopPropagation();
                  setCollapsedGroups((prev) => ({ ...prev, [sec.key]: !prev[sec.key] }));
                }}
                onKeyDown={(event) => {
                  const isToggleKey =
                    event.key === 'Enter' ||
                    event.key === ' ' ||
                    event.key === 'Space' ||
                    event.key === 'Spacebar' ||
                    event.code === 'Space';
                  if (isToggleKey) {
                    event.preventDefault();
                    event.stopPropagation();
                    setCollapsedGroups((prev) => ({ ...prev, [sec.key]: !prev[sec.key] }));
                  }
                }}
              >
                <span className="sidebar-section-label">
                  <span>{sec.label}</span>
                  <span className="chevron" aria-hidden>{isExpanded ? '⌄' : '›'}</span>
                </span>
                <span
                  className={`sidebar-section-count${hasAggregate ? ' is-active' : ''}`}
                  aria-label={`${sec.label} total count ${agg}`}
                >
                  {agg}
                </span>
              </div>
              <div
                id={`section-${sec.key}-children`}
                className={`sidebar-group-children${!isExpanded ? ' collapsed' : ''}`}
                aria-hidden={!isExpanded}
                aria-label={`${sec.label} resources`}
                aria-labelledby={`section-${sec.key}`}
                data-testid={`${sec.key}-group-children`}
              >
                {sec.children?.map((child) => {
                  const isSel = selected === child.key;
                  const numericValue = getSectionCount(child, safeCounts);
                  const countLabel = numericValue ?? 'unknown';
                  return (
                    <Link
                      key={child.key}
                      to={`/${child.key}`}
                      id={`section-${child.key}`}
                      className={`sidebar-section sidebar-section-link${isSel ? ' selected' : ''}`}
                      data-testid={`${sec.key}-child-${child.key}`}
                      aria-current={isSel ? 'page' : undefined}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(child.key);
                      }}
                    >
                      <span className="sidebar-section-label">
                        <span>{child.label}</span>
                      </span>
                      {child.podCounts ? (
                        <PodCountsDisplay podStatus={counts?.podStatus || counts?.PodStatus} />
                      ) : (
                        <span
                          className={`sidebar-section-count${numericValue !== undefined && numericValue > 0 ? ' is-active' : ''}`}
                          aria-label={`${child.label} count ${countLabel}`}
                        >
                          {numericValue ?? '-'}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        }
        const leaf = sec as ResourceSection;
        const isSel = selected === leaf.key;
        const value = getSectionCount(leaf, safeCounts);
        const isNumber = typeof value === 'number';
        const countLabel = isNumber ? value : 'unknown';
        return (
          <Link
            key={leaf.key}
            to={`/${leaf.key}`}
            id={`section-${leaf.key}`}
            className={`sidebar-section sidebar-section-link${isSel ? ' selected' : ''}`}
            aria-current={isSel ? 'page' : undefined}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(leaf.key);
            }}
          >
            <span className="sidebar-section-label">
              <span>{leaf.label}</span>
            </span>
            {leaf.hideCount ? (
              <span style={{ minWidth: '2em' }} />
            ) : leaf.podCounts ? (
              <PodCountsDisplay podStatus={counts?.podStatus || counts?.PodStatus} />
            ) : (
              <span
                className={`sidebar-section-count${isNumber && (value as number) > 0 ? ' is-active' : ''}`}
                aria-label={`${leaf.label} count ${countLabel}`}
              >
                {isNumber ? value : '-'}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export default SidebarSections;
