import { useEffect, useMemo, useState } from 'react';
import { GetSwarmNetworkContainers } from '../../swarmApi.js';
import EmptyTabContent from '../../../components/EmptyTabContent';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';
import { navigateToResource } from '../../../utils/resourceNavigation';
import {
  pickDefaultSortKey,
  sortRows,
  toggleSortState,
} from '../../../utils/tableSorting.js';

/**
 * Displays connected containers (tasks) for a network in a proper datatable format.
 * @param {Object} props
 * @param {string} props.networkId - The network ID to fetch containers for
 * @param {boolean} [props.compact] - If true, renders a compact version for the summary tab
 */
export default function NetworkConnectedContainersTable({
  networkId,
  compact = false,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tasks, setTasks] = useState([]);
  const [hoveredRow, setHoveredRow] = useState(null);

  // Define columns for sorting - must be before any early returns (Rules of Hooks)
  const columns = useMemo(() => {
    const cols = [
      { key: 'serviceName', label: 'Service' },
      !compact ? { key: 'slot', label: 'Slot' } : null,
      { key: 'id', label: 'Task ID' },
      { key: 'state', label: 'State' },
      !compact ? { key: 'desiredState', label: 'Desired' } : null,
      { key: 'nodeName', label: 'Node' },
      !compact ? { key: 'containerId', label: 'Container ID' } : null,
      !compact ? { key: 'error', label: 'Error' } : null,
    ].filter(Boolean);
    return cols;
  }, [compact]);
  const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
  const [sortState, setSortState] = useState(() => ({
    key: defaultSortKey,
    direction: 'asc',
  }));
  const sortedTasks = useMemo(() => {
    return sortRows(tasks, sortState.key, sortState.direction, (row, key) => {
      if (key === 'serviceName') return row?.serviceName || row?.serviceId;
      if (key === 'nodeName') return row?.nodeName || row?.nodeId;
      return row?.[key];
    });
  }, [tasks, sortState]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const data = await GetSwarmNetworkContainers(networkId);
        if (!active) return;
        setTasks(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!active) return;
        setTasks([]);
        setError(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [networkId]);

  const emptyMsg = getEmptyTabMessage('swarm-containers');

  const containerStyle = {
    padding: 16,
    overflow: 'auto',
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  };

  const headerStyle = {
    fontWeight: 600,
    color: 'var(--gh-text, #c9d1d9)',
    marginBottom: 8,
    fontSize: compact ? 13 : 14,
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>Containers (Tasks)</div>
        <div style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>
          Loading…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>Containers (Tasks)</div>
        <div style={{ color: '#f85149' }}>
          Failed to load containers: {error}
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>Containers (Tasks)</div>
        <EmptyTabContent
          icon={emptyMsg.icon}
          title={emptyMsg.title}
          description={emptyMsg.description}
          tip={emptyMsg.tip}
        />
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

  /**
   * Returns a status badge style based on the task state.
   */
  const getStateStyle = (state) => {
    const baseStyle = {
      padding: '2px 6px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 500,
      display: 'inline-block',
    };

    switch (state?.toLowerCase()) {
      case 'running':
        return {
          ...baseStyle,
          background: 'rgba(63, 185, 80, 0.2)',
          color: '#3fb950',
        };
      case 'complete':
      case 'shutdown':
        return {
          ...baseStyle,
          background: 'rgba(139, 148, 158, 0.2)',
          color: '#8b949e',
        };
      case 'failed':
      case 'rejected':
        return {
          ...baseStyle,
          background: 'rgba(248, 81, 73, 0.2)',
          color: '#f85149',
        };
      case 'pending':
      case 'assigned':
      case 'accepted':
      case 'preparing':
      case 'ready':
      case 'starting':
        return {
          ...baseStyle,
          background: 'rgba(187, 128, 9, 0.2)',
          color: '#bb8009',
        };
      default:
        return {
          ...baseStyle,
          background: 'rgba(139, 148, 158, 0.15)',
          color: '#8b949e',
        };
    }
  };

  /**
   * Handle row click - navigate to the service for this task
   */
  const handleRowClick = (task) => {
    const serviceName = task.serviceName || task.serviceId;
    if (serviceName) {
      navigateToResource({ resource: 'SwarmService', name: serviceName });
    }
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>Containers (Tasks) ({tasks.length})</div>
      <div
        style={{
          color: 'var(--gh-text-secondary, #8b949e)',
          fontSize: 12,
          marginBottom: 10,
        }}
      >
        Swarm attaches tasks (containers) to networks.
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="panel-table" style={{ width: '100%' }}>
          <thead>
            <tr>
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
              {!compact && (
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
              )}
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
              {!compact && (
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
                      setSortState((cur) =>
                        toggleSortState(cur, 'desiredState'),
                      )
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
              )}
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
              {!compact && (
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
              )}
              {!compact && (
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
              )}
            </tr>
          </thead>
          <tbody>
            {sortedTasks.map((t) => {
              const hasService = !!(t.serviceName || t.serviceId);
              const isHovered = hoveredRow === t.id;
              return (
                <tr
                  key={t.id}
                  onClick={() => handleRowClick(t)}
                  onMouseEnter={() => setHoveredRow(t.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleRowClick(t);
                  }}
                  role="button"
                  tabIndex={hasService ? 0 : -1}
                  title={
                    hasService
                      ? `Open service: ${t.serviceName || t.serviceId}`
                      : undefined
                  }
                  style={{
                    cursor: hasService ? 'pointer' : 'default',
                    background:
                      isHovered && hasService
                        ? 'var(--gh-row-hover, rgba(88, 166, 255, 0.1))'
                        : undefined,
                  }}
                >
                  <td
                    style={{
                      fontWeight: 500,
                      color:
                        hasService && isHovered
                          ? 'var(--gh-link, #58a6ff)'
                          : undefined,
                    }}
                  >
                    {t.serviceName || t.serviceId || '-'}
                  </td>
                  {!compact && (
                    <td style={{ textAlign: 'center' }}>
                      {t.slot ? `#${t.slot}` : '-'}
                    </td>
                  )}
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    <span title={t.id}>
                      {t.id
                        ? compact
                          ? t.id.slice(0, 12)
                          : t.id.slice(0, 12)
                        : '-'}
                    </span>
                  </td>
                  <td>
                    <span style={getStateStyle(t.state)}>{t.state || '-'}</span>
                  </td>
                  {!compact && (
                    <td style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>
                      {t.desiredState || '-'}
                    </td>
                  )}
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    {t.nodeName || (t.nodeId ? t.nodeId.slice(0, 12) : '-')}
                  </td>
                  {!compact && (
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                      {t.containerId ? (
                        <span title={t.containerId}>
                          {t.containerId.slice(0, 12)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  )}
                  {!compact && (
                    <td
                      style={{ color: '#f85149', maxWidth: 200 }}
                      className="wrap-text"
                    >
                      {t.error || '-'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
