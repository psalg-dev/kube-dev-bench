import { useEffect, useMemo, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import StatusBadge from '../../../components/StatusBadge.jsx';
import {
  pickDefaultSortKey,
  sortRows,
  toggleSortState,
} from '../../../utils/tableSorting.js';

export default function JobPodsTab({ namespace, jobName }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // All hooks must be called before any early returns to follow Rules of Hooks
  const podColumns = useMemo(
    () => [
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status' },
      { key: 'ready', label: 'Ready' },
      { key: 'restarts', label: 'Restarts' },
      { key: 'age', label: 'Age' },
      { key: 'node', label: 'Node' },
    ],
    [],
  );
  const defaultPodSortKey = useMemo(
    () => pickDefaultSortKey(podColumns),
    [podColumns],
  );
  const [podSortState, setPodSortState] = useState(() => ({
    key: defaultPodSortKey,
    direction: 'asc',
  }));
  const pods = useMemo(() => detail?.pods || [], [detail]);
  const sortedPods = useMemo(
    () => sortRows(pods, podSortState.key, podSortState.direction),
    [pods, podSortState],
  );

  const conditionColumns = useMemo(
    () => [
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'reason', label: 'Reason' },
      { key: 'message', label: 'Message' },
    ],
    [],
  );
  const defaultConditionSortKey = useMemo(
    () => pickDefaultSortKey(conditionColumns),
    [conditionColumns],
  );
  const [conditionSortState, setConditionSortState] = useState(() => ({
    key: defaultConditionSortKey,
    direction: 'asc',
  }));
  const conditions = useMemo(() => detail?.conditions || [], [detail]);
  const sortedConditions = useMemo(
    () =>
      sortRows(
        conditions,
        conditionSortState.key,
        conditionSortState.direction,
      ),
    [conditions, conditionSortState],
  );

  useEffect(() => {
    if (!namespace || !jobName) return;

    setLoading(true);
    setError(null);

    AppAPI.GetJobDetail(namespace, jobName)
      .then((data) => {
        setDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch job details');
        setLoading(false);
      });
  }, [namespace, jobName]);

  if (loading) {
    return (
      <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>
        Loading...
      </div>
    );
  }

  if (error) {
    return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
  }

  if (!detail || !detail.pods || detail.pods.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>
        No pods found for this job.
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
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <table className="panel-table">
        <thead>
          <tr>
            <th
              aria-sort={
                podSortState.key === 'name'
                  ? podSortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <button
                type="button"
                style={headerButtonStyle}
                onClick={() =>
                  setPodSortState((cur) => toggleSortState(cur, 'name'))
                }
              >
                <span>Name</span>
                <span aria-hidden="true">
                  {podSortState.key === 'name'
                    ? podSortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                podSortState.key === 'status'
                  ? podSortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <button
                type="button"
                style={headerButtonStyle}
                onClick={() =>
                  setPodSortState((cur) => toggleSortState(cur, 'status'))
                }
              >
                <span>Status</span>
                <span aria-hidden="true">
                  {podSortState.key === 'status'
                    ? podSortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                podSortState.key === 'ready'
                  ? podSortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <button
                type="button"
                style={headerButtonStyle}
                onClick={() =>
                  setPodSortState((cur) => toggleSortState(cur, 'ready'))
                }
              >
                <span>Ready</span>
                <span aria-hidden="true">
                  {podSortState.key === 'ready'
                    ? podSortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                podSortState.key === 'restarts'
                  ? podSortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <button
                type="button"
                style={headerButtonStyle}
                onClick={() =>
                  setPodSortState((cur) => toggleSortState(cur, 'restarts'))
                }
              >
                <span>Restarts</span>
                <span aria-hidden="true">
                  {podSortState.key === 'restarts'
                    ? podSortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                podSortState.key === 'age'
                  ? podSortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <button
                type="button"
                style={headerButtonStyle}
                onClick={() =>
                  setPodSortState((cur) => toggleSortState(cur, 'age'))
                }
              >
                <span>Age</span>
                <span aria-hidden="true">
                  {podSortState.key === 'age'
                    ? podSortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                podSortState.key === 'node'
                  ? podSortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <button
                type="button"
                style={headerButtonStyle}
                onClick={() =>
                  setPodSortState((cur) => toggleSortState(cur, 'node'))
                }
              >
                <span>Node</span>
                <span aria-hidden="true">
                  {podSortState.key === 'node'
                    ? podSortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedPods.map((pod, idx) => (
            <tr key={pod.name || idx}>
              <td>{pod.name}</td>
              <td>
                <StatusBadge
                  status={pod.status || '-'}
                  size="small"
                  showDot={false}
                />
              </td>
              <td>{pod.ready}</td>
              <td>{pod.restarts}</td>
              <td>{pod.age}</td>
              <td className="text-muted">{pod.node || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {detail.conditions && detail.conditions.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ color: 'var(--gh-text, #c9d1d9)', marginBottom: 8 }}>
            Conditions
          </h4>
          <table className="panel-table">
            <thead>
              <tr>
                <th
                  aria-sort={
                    conditionSortState.key === 'type'
                      ? conditionSortState.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    style={headerButtonStyle}
                    onClick={() =>
                      setConditionSortState((cur) =>
                        toggleSortState(cur, 'type'),
                      )
                    }
                  >
                    <span>Type</span>
                    <span aria-hidden="true">
                      {conditionSortState.key === 'type'
                        ? conditionSortState.direction === 'asc'
                          ? '▲'
                          : '▼'
                        : '↕'}
                    </span>
                  </button>
                </th>
                <th
                  aria-sort={
                    conditionSortState.key === 'status'
                      ? conditionSortState.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    style={headerButtonStyle}
                    onClick={() =>
                      setConditionSortState((cur) =>
                        toggleSortState(cur, 'status'),
                      )
                    }
                  >
                    <span>Status</span>
                    <span aria-hidden="true">
                      {conditionSortState.key === 'status'
                        ? conditionSortState.direction === 'asc'
                          ? '▲'
                          : '▼'
                        : '↕'}
                    </span>
                  </button>
                </th>
                <th
                  aria-sort={
                    conditionSortState.key === 'reason'
                      ? conditionSortState.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    style={headerButtonStyle}
                    onClick={() =>
                      setConditionSortState((cur) =>
                        toggleSortState(cur, 'reason'),
                      )
                    }
                  >
                    <span>Reason</span>
                    <span aria-hidden="true">
                      {conditionSortState.key === 'reason'
                        ? conditionSortState.direction === 'asc'
                          ? '▲'
                          : '▼'
                        : '↕'}
                    </span>
                  </button>
                </th>
                <th
                  aria-sort={
                    conditionSortState.key === 'message'
                      ? conditionSortState.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    style={headerButtonStyle}
                    onClick={() =>
                      setConditionSortState((cur) =>
                        toggleSortState(cur, 'message'),
                      )
                    }
                  >
                    <span>Message</span>
                    <span aria-hidden="true">
                      {conditionSortState.key === 'message'
                        ? conditionSortState.direction === 'asc'
                          ? '▲'
                          : '▼'
                        : '↕'}
                    </span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedConditions.map((cond, idx) => (
                <tr key={idx}>
                  <td>{cond.type}</td>
                  <td>
                    <span
                      style={{
                        color: cond.status === 'True' ? '#2ea44f' : '#8b949e',
                        fontWeight: 500,
                      }}
                    >
                      {cond.status}
                    </span>
                  </td>
                  <td className="text-muted">{cond.reason || '-'}</td>
                  <td
                    className="text-muted"
                    style={{
                      maxWidth: 300,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {cond.message || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
