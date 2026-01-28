import { useEffect, useMemo, useState } from 'react';
import { GetSwarmTasksByService } from '../../swarmApi.js';
import { EventsOn } from '../../../../wailsjs/runtime';
import './ServiceTasksTab.css';
import HealthStatusBadge from '../tasks/HealthStatusBadge.jsx';
import { navigateToResource } from '../../../utils/resourceNavigation';
import StatusBadge from '../../../components/StatusBadge.jsx';
import {
  pickDefaultSortKey,
  sortRows,
  toggleSortState,
} from '../../../utils/tableSorting.js';

export default function ServiceTasksTab({ serviceId, _serviceName }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredRow, setHoveredRow] = useState(null);

  const handleRowClick = (task) => {
    if (task.id) {
      navigateToResource({ resource: 'SwarmTask', name: task.id });
    }
  };

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
        const serviceTasks = allTasks.filter((t) => t.serviceId === serviceId);
        setTasks(serviceTasks);
      }
    });

    return () => {
      active = false;
      if (typeof off === 'function') off();
    };
  }, [serviceId]);

  const columns = useMemo(
    () => [
      { key: 'id', label: 'Task ID' },
      { key: 'nodeName', label: 'Node' },
      { key: 'slot', label: 'Slot' },
      { key: 'state', label: 'State' },
      { key: 'healthStatus', label: 'Health' },
      { key: 'desiredState', label: 'Desired State' },
      { key: 'containerId', label: 'Container ID' },
      { key: 'error', label: 'Error' },
    ],
    [],
  );
  const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
  const [sortState, setSortState] = useState(() => ({
    key: defaultSortKey,
    direction: 'asc',
  }));
  const sortedTasks = useMemo(
    () => sortRows(tasks, sortState.key, sortState.direction),
    [tasks, sortState],
  );

  if (loading) {
    return <div className="tasks-loading">Loading tasks...</div>;
  }

  if (tasks.length === 0) {
    return <div className="tasks-empty">No tasks found for this service.</div>;
  }

  const headerButtonStyle = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    font: 'inherit',
    padding: 0,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    textAlign: 'left',
  };

  return (
    <div className="service-tasks-tab">
      <table className="tasks-table">
        <thead>
          <tr>
            <th
              aria-sort={
                sortState.key === 'id'
                  ? sortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <button
                type="button"
                style={headerButtonStyle}
                onClick={() =>
                  setSortState((cur) => toggleSortState(cur, 'id'))
                }
              >
                <span>Task ID</span>
                <span aria-hidden="true">
                  {sortState.key === 'id'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                sortState.key === 'nodeName'
                  ? sortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <button
                type="button"
                style={headerButtonStyle}
                onClick={() =>
                  setSortState((cur) => toggleSortState(cur, 'nodeName'))
                }
              >
                <span>Node</span>
                <span aria-hidden="true">
                  {sortState.key === 'nodeName'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                sortState.key === 'slot'
                  ? sortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <button
                type="button"
                style={headerButtonStyle}
                onClick={() =>
                  setSortState((cur) => toggleSortState(cur, 'slot'))
                }
              >
                <span>Slot</span>
                <span aria-hidden="true">
                  {sortState.key === 'slot'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                sortState.key === 'state'
                  ? sortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <button
                type="button"
                style={headerButtonStyle}
                onClick={() =>
                  setSortState((cur) => toggleSortState(cur, 'state'))
                }
              >
                <span>State</span>
                <span aria-hidden="true">
                  {sortState.key === 'state'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                sortState.key === 'healthStatus'
                  ? sortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <button
                type="button"
                style={headerButtonStyle}
                onClick={() =>
                  setSortState((cur) => toggleSortState(cur, 'healthStatus'))
                }
              >
                <span>Health</span>
                <span aria-hidden="true">
                  {sortState.key === 'healthStatus'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                sortState.key === 'desiredState'
                  ? sortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <button
                type="button"
                style={headerButtonStyle}
                onClick={() =>
                  setSortState((cur) => toggleSortState(cur, 'desiredState'))
                }
              >
                <span>Desired State</span>
                <span aria-hidden="true">
                  {sortState.key === 'desiredState'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                sortState.key === 'containerId'
                  ? sortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <button
                type="button"
                style={headerButtonStyle}
                onClick={() =>
                  setSortState((cur) => toggleSortState(cur, 'containerId'))
                }
              >
                <span>Container ID</span>
                <span aria-hidden="true">
                  {sortState.key === 'containerId'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                sortState.key === 'error'
                  ? sortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <button
                type="button"
                style={headerButtonStyle}
                onClick={() =>
                  setSortState((cur) => toggleSortState(cur, 'error'))
                }
              >
                <span>Error</span>
                <span aria-hidden="true">
                  {sortState.key === 'error'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedTasks.map((task) => {
            const isHovered = hoveredRow === task.id;
            return (
              <tr
                key={task.id}
                onClick={() => handleRowClick(task)}
                onMouseEnter={() => setHoveredRow(task.id)}
                onMouseLeave={() => setHoveredRow(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleRowClick(task);
                }}
                tabIndex={0}
                title={`Open task: ${task.id}`}
                style={{
                  cursor: 'pointer',
                  background: isHovered
                    ? 'var(--gh-row-hover, rgba(88, 166, 255, 0.1))'
                    : undefined,
                }}
              >
                <td
                  title={task.id}
                  style={{
                    color: isHovered ? 'var(--gh-link, #58a6ff)' : undefined,
                  }}
                >
                  {task.id?.substring(0, 12)}...
                </td>
                <td>{task.nodeName || task.nodeId?.substring(0, 12) || '-'}</td>
                <td>{task.slot || '-'}</td>
                <td>
                  <StatusBadge
                    status={task.state || '-'}
                    size="small"
                    className="task-state"
                  />
                </td>
                <td>
                  <HealthStatusBadge status={task.healthStatus} />
                </td>
                <td>
                  <StatusBadge status={task.desiredState || '-'} size="small" />
                </td>
                <td title={task.containerId}>
                  {task.containerId
                    ? `${task.containerId.substring(0, 12)}...`
                    : '-'}
                </td>
                <td className="task-error" title={task.error}>
                  {task.error || '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
