import { useEffect, useState } from 'react';
import { GetSwarmTasksByService } from '../../swarmApi.js';
import { EventsOn } from '../../../../wailsjs/runtime';
import './ServiceTasksTab.css';
import HealthStatusBadge from '../tasks/HealthStatusBadge.jsx';

export default function ServiceTasksTab({ serviceId, _serviceName }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadTasks = async () => {
      try {
        const data = await GetSwarmTasksByService(serviceId);
        if (active) {
          setTasks(data || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load tasks:', err);
        if (active) {
          setTasks([]);
          setLoading(false);
        }
      }
    };

    loadTasks();

    // Subscribe to task updates and filter for this service
    const off = EventsOn('swarm:tasks:update', (allTasks) => {
      if (active && Array.isArray(allTasks)) {
        const serviceTasks = allTasks.filter(t => t.serviceId === serviceId);
        setTasks(serviceTasks);
      }
    });

    return () => {
      active = false;
      if (typeof off === 'function') off();
    };
  }, [serviceId]);

  if (loading) {
    return <div className="tasks-loading">Loading tasks...</div>;
  }

  if (tasks.length === 0) {
    return <div className="tasks-empty">No tasks found for this service.</div>;
  }

  const getStateColor = (state) => {
    switch (state?.toLowerCase()) {
      case 'running':
        return '#3fb950';
      case 'pending':
      case 'assigned':
      case 'accepted':
      case 'preparing':
      case 'starting':
        return '#e6b800';
      case 'complete':
        return '#8b949e';
      case 'failed':
      case 'rejected':
        return '#f85149';
      default:
        return '#8b949e';
    }
  };

  return (
    <div className="service-tasks-tab">
      <table className="tasks-table">
        <thead>
          <tr>
            <th>Task ID</th>
            <th>Node</th>
            <th>Slot</th>
            <th>State</th>
            <th>Health</th>
            <th>Desired State</th>
            <th>Container ID</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td title={task.id}>{task.id?.substring(0, 12)}...</td>
              <td>{task.nodeName || task.nodeId?.substring(0, 12) || '-'}</td>
              <td>{task.slot || '-'}</td>
              <td>
                <span
                  className="task-state"
                  style={{ color: getStateColor(task.state) }}
                >
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
              <td className="task-error" title={task.error}>
                {task.error || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
