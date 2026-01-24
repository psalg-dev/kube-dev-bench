import { useEffect, useState, useRef } from 'react';
import * as AppAPI from '../../wailsjs/go/main/App';
import './ResourcePodsTab.css';

/**
 * Reusable pods tab component for workload resources.
 * Shows pods owned by Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs.
 *
 * @param {string} namespace - The namespace of the resource
 * @param {string} resourceKind - The parent resource kind (e.g., "Deployment")
 * @param {string} resourceName - The name of the parent resource
 * @param {function} onPodClick - Optional callback when a pod is clicked (name, namespace)
 * @param {number} refreshInterval - Refresh interval in ms (default: 5000)
 */
export default function ResourcePodsTab({
  namespace,
  resourceKind,
  resourceName,
  onPodClick,
  refreshInterval = 5000
}) {
  const [pods, setPods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchPods = async (isInitial = false) => {
    if (!resourceName || !resourceKind || !namespace) return;

    if (isInitial) setLoading(true);
    setError(null);

    try {
      let result = null;

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
      setError(err?.message || String(err));
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

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'running') return { bg: 'rgba(46,160,67,0.15)', fg: '#3fb950' };
    if (s === 'pending' || s === 'containercreating') return { bg: 'rgba(187,128,9,0.15)', fg: '#d29922' };
    if (s === 'failed' || s === 'error' || s === 'crashloopbackoff') return { bg: 'rgba(248,81,73,0.15)', fg: '#f85149' };
    if (s === 'succeeded' || s === 'completed') return { bg: 'rgba(56,139,253,0.15)', fg: '#58a6ff' };
    return { bg: 'rgba(110,118,129,0.12)', fg: '#8b949e' };
  };

  const handlePodClick = (pod) => {
    if (onPodClick) {
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
    return (
      <div className="resource-pods-tab">
        <div className="pods-empty">No pods found for this {resourceKind.toLowerCase()}.</div>
      </div>
    );
  }

  return (
    <div className="resource-pods-tab">
      <div className="pods-header">
        <span className="pods-count">{pods.length} pod{pods.length !== 1 ? 's' : ''}</span>
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
              const statusColor = getStatusColor(pod.status);
              return (
                <tr
                  key={idx}
                  className={`pod-row ${onPodClick ? 'clickable' : ''}`}
                  onClick={() => handlePodClick(pod)}
                >
                  <td className="pod-name">{pod.name || '-'}</td>
                  <td>
                    <span
                      className="pod-status-badge"
                      style={{ background: statusColor.bg, color: statusColor.fg }}
                    >
                      {pod.status || 'Unknown'}
                    </span>
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
