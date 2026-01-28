import { useCallback, useEffect, useMemo, useState } from 'react';
import { GetSwarmStackServices } from '../../swarmApi.js';
import { formatAge } from '../../../utils/timeUtils.js';
import EmptyTabContent from '../../../components/EmptyTabContent';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';
import { navigateToResource } from '../../../utils/resourceNavigation';
import './StackServicesTab.css';
import {
  pickDefaultSortKey,
  sortRows,
  toggleSortState,
} from '../../../utils/tableSorting.js';

export default function StackServicesTab({ stackName }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);

  const handleRowClick = (svc) => {
    if (svc.name) {
      navigateToResource({ resource: 'SwarmService', name: svc.name });
    }
  };

  const getDisplayName = useCallback(
    (name) => {
      if (!name) return name;
      const prefix = `${stackName}_`;
      return name.startsWith(prefix) ? name.slice(prefix.length) : name;
    },
    [stackName],
  );

  useEffect(() => {
    let active = true;

    const loadServices = async () => {
      try {
        const result = await GetSwarmStackServices(stackName);
        if (active) {
          setServices(result || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load stack services:', err);
        if (active) {
          setError(err.toString());
          setLoading(false);
        }
      }
    };

    loadServices();
    const interval = setInterval(loadServices, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [stackName]);

  const columns = useMemo(
    () => [
      { key: 'name', label: 'Name' },
      { key: 'image', label: 'Image' },
      { key: 'mode', label: 'Mode' },
      { key: 'replicas', label: 'Replicas' },
      { key: 'createdAt', label: 'Created' },
    ],
    [],
  );
  const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
  const [sortState, setSortState] = useState(() => ({
    key: defaultSortKey,
    direction: 'asc',
  }));
  const sortedServices = useMemo(() => {
    return sortRows(
      services,
      sortState.key,
      sortState.direction,
      (row, key) => {
        if (key === 'name') return getDisplayName(row?.name || '');
        if (key === 'replicas') return Number(row?.replicas || 0);
        if (key === 'createdAt') return row?.createdAt || row?.created || '';
        return row?.[key];
      },
    );
  }, [services, sortState, getDisplayName]);

  if (loading) {
    return <div className="stack-services-loading">Loading services...</div>;
  }

  if (error) {
    return (
      <div className="stack-services-error">
        Failed to load services: {error}
      </div>
    );
  }

  if (!services || services.length === 0) {
    const emptyMsg = getEmptyTabMessage('swarm-stack-services');
    return (
      <EmptyTabContent
        icon={emptyMsg.icon}
        title={emptyMsg.title}
        description={emptyMsg.description}
        tip={emptyMsg.tip}
      />
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
    <div className="stack-services-container">
      <table className="stack-services-table">
        <thead>
          <tr>
            <th
              aria-sort={
                sortState.key === 'name'
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
                  setSortState((cur) => toggleSortState(cur, 'name'))
                }
              >
                <span>Name</span>
                <span aria-hidden="true">
                  {sortState.key === 'name'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                sortState.key === 'image'
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
                  setSortState((cur) => toggleSortState(cur, 'image'))
                }
              >
                <span>Image</span>
                <span aria-hidden="true">
                  {sortState.key === 'image'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                sortState.key === 'mode'
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
                  setSortState((cur) => toggleSortState(cur, 'mode'))
                }
              >
                <span>Mode</span>
                <span aria-hidden="true">
                  {sortState.key === 'mode'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                sortState.key === 'replicas'
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
                  setSortState((cur) => toggleSortState(cur, 'replicas'))
                }
              >
                <span>Replicas</span>
                <span aria-hidden="true">
                  {sortState.key === 'replicas'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                sortState.key === 'createdAt'
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
                  setSortState((cur) => toggleSortState(cur, 'createdAt'))
                }
              >
                <span>Created</span>
                <span aria-hidden="true">
                  {sortState.key === 'createdAt'
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
          {sortedServices.map((svc) => {
            const isHovered = hoveredRow === svc.id;
            return (
              <tr
                key={svc.id}
                onClick={() => handleRowClick(svc)}
                onMouseEnter={() => setHoveredRow(svc.id)}
                onMouseLeave={() => setHoveredRow(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleRowClick(svc);
                }}
                role="button"
                tabIndex={0}
                title={`Open service: ${svc.name}`}
                style={{
                  cursor: 'pointer',
                  background: isHovered
                    ? 'var(--gh-row-hover, rgba(88, 166, 255, 0.1))'
                    : undefined,
                }}
              >
                <td
                  style={{
                    color: isHovered ? 'var(--gh-link, #58a6ff)' : undefined,
                  }}
                >
                  {getDisplayName(svc.name)}
                </td>
                <td className="mono">{svc.image}</td>
                <td>{svc.mode}</td>
                <td>
                  <span
                    className={
                      Number(svc.runningTasks) === Number(svc.replicas)
                        ? 'replica-ok'
                        : 'replica-warn'
                    }
                  >
                    {svc.runningTasks}/{svc.replicas}
                  </span>
                </td>
                <td>{formatAge(svc.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
