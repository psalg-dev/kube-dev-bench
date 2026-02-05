import { useEffect, useRef, useState } from 'react';
import * as AppAPI from '../../wailsjs/go/main/App';
import EmptyTabContent from './EmptyTabContent';
import { getEmptyTabMessage } from '../constants/emptyTabMessages';
import './ResourcePodsTab.css';
import StatusBadge from './StatusBadge';

type PodSummary = {
  name?: string;
  namespace?: string;
  status?: string;
  ready?: string;
  restarts?: number;
  age?: string;
  node?: string;
  ip?: string;
};

type ResourcePodsTabProps = {
  namespace?: string;
  resourceKind?: string;
  resourceName?: string;
  onPodClick?: (name: string, namespace: string) => void;
  refreshInterval?: number;
};

/**
 * Reusable pods tab component for workload resources.
 * Shows pods owned by Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs.
 */
export default function ResourcePodsTab({
  namespace,
  resourceKind,
  resourceName,
  onPodClick,
  refreshInterval = 5000,
}: ResourcePodsTabProps) {
  const [pods, setPods] = useState<PodSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPods = async (isInitial = false) => {
    if (!resourceName || !resourceKind || !namespace) return;

    if (isInitial) setLoading(true);
    setError(null);

    try {
      let result: { pods?: PodSummary[] } | null = null;

      // Call the appropriate detail API based on resource kind
      switch (resourceKind.toLowerCase()) {
        case 'deployment':
          result = await AppAPI.GetDeploymentDetail(namespace, resourceName);
          break;
        case 'statefulset':
          result = await AppAPI.GetStatefulSetDetail(namespace, resourceName);
          break;
        case 'daemonset':
          result = await AppAPI.GetDaemonSetDetail(namespace, resourceName);
          break;
        case 'replicaset':
          result = await AppAPI.GetReplicaSetDetail(namespace, resourceName);
          break;
        case 'job':
          result = await AppAPI.GetJobDetail(namespace, resourceName);
          break;
        default:
          throw new Error(`Unsupported resource kind: ${resourceKind}`);
      }

      setPods(result?.pods || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      if (isInitial) setPods([]);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPods(true);
    intervalRef.current = setInterval(() => fetchPods(false), refreshInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, resourceKind, resourceName, refreshInterval]);

  const handlePodClick = (pod: PodSummary) => {
    if (onPodClick && pod.name && pod.namespace) {
      onPodClick(pod.name, pod.namespace);
    }
  };

  if (loading) {
    return (
      <div className="resource-pods-tab">
        <div className="pods-loading">Loading pods...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="resource-pods-tab">
        <div className="pods-error">Error: {error}</div>
      </div>
    );
  }

  if (pods.length === 0) {
    const emptyMsg = getEmptyTabMessage('pods');
    return (
      <div className="resource-pods-tab">
        <EmptyTabContent
          icon={emptyMsg.icon}
          title={emptyMsg.title}
          description={emptyMsg.description}
          tip={emptyMsg.tip}
        />
      </div>
    );
  }

  return (
    <div className="resource-pods-tab">
      <div className="pods-header">
        <span className="pods-count">
          {pods.length} pod{pods.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="pods-list">
        <table className="pods-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Ready</th>
              <th>Restarts</th>
              <th>Age</th>
              <th>Node</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {pods.map((pod, idx) => {
              return (
                <tr
                  key={idx}
                  className={`pod-row ${onPodClick ? 'clickable' : ''}`}
                  onClick={() => handlePodClick(pod)}
                >
                  <td className="pod-name">{pod.name || '-'}</td>
                  <td>
                    <StatusBadge status={pod.status || 'Unknown'} size="small" showDot={false} />
                  </td>
                  <td className="pod-ready">{pod.ready || '-'}</td>
                  <td className="pod-restarts">{pod.restarts ?? 0}</td>
                  <td className="pod-age">{pod.age || '-'}</td>
                  <td className="pod-node">{pod.node || '-'}</td>
                  <td className="pod-ip">{pod.ip || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
