import { useEffect, useMemo, useState } from 'react';
import { GetSwarmNodeTasks } from '../../swarmApi.js';
import HealthStatusBadge from '../tasks/HealthStatusBadge.jsx';
import { navigateToResource } from '../../../utils/resourceNavigation';
import StatusBadge from '../../../components/StatusBadge.jsx';
import {
  pickDefaultSortKey,
  sortRows,
  toggleSortState,
} from '../../../utils/tableSorting.js';

export default function NodeTasksTab({ nodeId, _nodeName }) {
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

  const columns = useMemo(
    () => [
      { key: 'id', label: 'Task ID' },
      { key: 'serviceName', label: 'Service' },
      { key: 'state', label: 'State' },
      { key: 'healthStatus', label: 'Health' },
      { key: 'desiredState', label: 'Desired' },
      { key: 'containerId', label: 'Container' },
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
    return (
      <div
        style={{
          padding: 32,
          textAlign: 'center',
          color: 'var(--gh-text-secondary)',
        }}
      >
        Loading tasks...
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: 'center',
          color: 'var(--gh-text-secondary)',
        }}
      >
        No tasks running on this node.
      </div>
    );
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
    <div
      style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: 16 }}
    >
      <table className="gh-table" style={{ width: '100%' }}>
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
                sortState.key === 'serviceName'
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
                  setSortState((cur) => toggleSortState(cur, 'serviceName'))
                }
              >
                <span>Service</span>
                <span aria-hidden="true">
                  {sortState.key === 'serviceName'
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
                <span>Desired</span>
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
                <span>Container</span>
                <span aria-hidden="true">
                  {sortState.key === 'containerId'
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
                <td>
                  {task.serviceName || task.serviceId?.substring(0, 12) || '-'}
                </td>
                <td>
                  <StatusBadge status={task.state || '-'} size="small" />
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
