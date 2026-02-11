import { useMemo, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useResourceCounts } from '../state/ResourceCountsContext';
import './SidebarSections.css';

type ResourceSection = {
  key: string;
  label: string;
  podCounts?: boolean;
  group?: boolean;
  children?: Array<{ key: string; label: string }>;
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
  { key: 'pods', label: 'Pods', podCounts: true },
  { key: 'deployments', label: 'Deployments' },
  { key: 'services', label: 'Services' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'cronjobs', label: 'Cron Jobs' },
  { key: 'daemonsets', label: 'Daemon Sets' },
  { key: 'statefulsets', label: 'Stateful Sets' },
  { key: 'replicasets', label: 'Replica Sets' },
  { key: 'configmaps', label: 'Config Maps' },
  { key: 'secrets', label: 'Secrets' },
  { key: 'ingresses', label: 'Ingresses' },
  { key: 'persistentvolumeclaims', label: 'Persistent Volume Claims' },
  { key: 'persistentvolumes', label: 'Persistent Volumes' },
  { key: 'helmreleases', label: 'Helm Releases' },
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

const rbacChildKeys = ['roles', 'clusterroles', 'rolebindings', 'clusterrolebindings'] as const;

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
  onSelect: (section: string) => void;
};

export function SidebarSections({ selected, onSelect }: SidebarSectionsProps) {
  const { counts } = useResourceCounts() as {
    counts: (Record<string, number> & { podStatus?: PodStatus; PodStatus?: PodStatus }) | null;
  };
  const safeCounts = counts || undefined;
  const [rbacCollapsed, setRbacCollapsed] = useState(true);
  const isRbacChildSelected = rbacChildKeys.includes(selected);

  useEffect(() => {
    if (isRbacChildSelected) {
      setRbacCollapsed(false);
    }
  }, [isRbacChildSelected]);
  return (
    <div>
      {resourceSections.map((sec) => {
        if (sec.group) {
          const isExpanded = !rbacCollapsed;
          const agg = (safeCounts?.roles ?? 0)
            + (safeCounts?.clusterroles ?? 0)
            + (safeCounts?.rolebindings ?? 0)
            + (safeCounts?.clusterrolebindings ?? 0);
          const hasAggregate = agg > 0;
          return (
            <div key={sec.key} className="sidebar-group">
              <div
                id={`section-${sec.key}`}
                className={`sidebar-section sidebar-group-header${isExpanded ? ' selected' : ''}`}
                role="button"
                aria-expanded={isExpanded}
                aria-controls={`section-${sec.key}-children`}
                aria-label={`${sec.label} section`}
                tabIndex={0}
                data-testid="rbac-group-header"
                onClick={(event) => {
                  event.stopPropagation();
                  setRbacCollapsed((v) => !v);
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
                    setRbacCollapsed((v) => !v);
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
                className={`sidebar-group-children${rbacCollapsed ? ' collapsed' : ''}`}
                aria-hidden={rbacCollapsed}
                aria-label={`${sec.label} resources`}
                aria-labelledby={`section-${sec.key}`}
                data-testid="rbac-group-children"
              >
                {sec.children?.map((child) => {
                  const isSel = selected === child.key;
                  const value = safeCounts?.[child.key];
                  const isNumber = typeof value === 'number';
                  const countLabel = isNumber ? value : 'unknown';
                  return (
                    <Link
                      key={child.key}
                      to={`/${child.key}`}
                      id={`section-${child.key}`}
                      className={`sidebar-section sidebar-section-link${isSel ? ' selected' : ''}`}
                      data-testid={`rbac-child-${child.key}`}
                      aria-current={isSel ? 'page' : undefined}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(child.key);
                      }}
                    >
                      <span className="sidebar-section-label">
                        <span>{child.label}</span>
                      </span>
                      <span
                        className={`sidebar-section-count${isNumber && (value as number) > 0 ? ' is-active' : ''}`}
                        aria-label={`${child.label} count ${countLabel}`}
                      >
                        {isNumber ? value : '-'}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        }
        const leaf = sec as ResourceSection;
        const isSel = selected === leaf.key;
        const value = safeCounts?.[leaf.key];
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
            {leaf.podCounts ? (
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
