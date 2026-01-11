import React, { useEffect, useState } from 'react';
import { GetSwarmNodeTasks } from '../../swarmApi.js';
import HealthStatusBadge from '../tasks/HealthStatusBadge.jsx';

export default function NodeTasksTab({ nodeId, nodeName }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadTasks = async () => {
      try {
        const data = await GetSwarmNodeTasks(nodeId);
        if (active) {
          setTasks(data || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load node tasks:', err);
        if (active) {
          setTasks([]);
          setLoading(false);
        }
      }
    };

    loadTasks();

    return () => {
      active = false;
    };
  }, [nodeId]);

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>Loading tasks...</div>;
  }

  if (tasks.length === 0) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>No tasks running on this node.</div>;
  }

  const getStateColor = (state) => {
    switch (state?.toLowerCase()) {
      case 'running': return '#3fb950';
      case 'pending':
      case 'preparing':
      case 'starting': return '#e6b800';
      case 'complete': return '#8b949e';
      case 'failed':
      case 'rejected': return '#f85149';
      default: return '#8b949e';
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: 16 }}>
      <table className="gh-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Task ID</th>
            <th>Service</th>
            <th>State</th>
            <th>Health</th>
            <th>Desired</th>
            <th>Container</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td title={task.id}>{task.id?.substring(0, 12)}...</td>
              <td>{task.serviceName || task.serviceId?.substring(0, 12) || '-'}</td>
              <td>
                <span style={{ color: getStateColor(task.state), fontWeight: 500 }}>
                  {task.state}
                </span>
              </td>
              <td>
                <HealthStatusBadge status={task.healthStatus} />
              </td>
              <td>{task.desiredState}</td>
              <td title={task.containerId}>
                {task.containerId ? `${task.containerId.substring(0, 12)}...` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
