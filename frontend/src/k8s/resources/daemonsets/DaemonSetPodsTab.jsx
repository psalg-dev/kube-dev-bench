import { useEffect, useMemo, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import StatusBadge from '../../../components/StatusBadge.jsx';
import {
  pickDefaultSortKey,
  sortRows,
  toggleSortState,
} from '../../../utils/tableSorting.js';

export default function DaemonSetPodsTab({ namespace, daemonSetName }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!namespace || !daemonSetName) return;

    setLoading(true);
    setError(null);

    AppAPI.GetDaemonSetDetail(namespace, daemonSetName)
      .then((data) => {
        setDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch daemonset details');
        setLoading(false);
      });
  }, [namespace, daemonSetName]);

  const pods = useMemo(() => detail?.pods || [], [detail]);
  const podsByNode = useMemo(() => {
    const grouped = {};
    pods.forEach((pod) => {
      const node = pod.node || 'Unknown';
      if (!grouped[node]) {
        grouped[node] = [];
      }
      grouped[node].push(pod);
    });
    return grouped;
  }, [pods]);

  const columns = useMemo(
    () => [
      { key: 'node', label: 'Node' },
      { key: 'name', label: 'Pod' },
      { key: 'status', label: 'Status' },
      { key: 'ready', label: 'Ready' },
      { key: 'restarts', label: 'Restarts' },
      { key: 'age', label: 'Age' },
      { key: 'ip', label: 'IP' },
    ],
    [],
  );
  const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
  const [sortState, setSortState] = useState(() => ({
    key: defaultSortKey,
    direction: 'asc',
  }));
  const sortedPods = useMemo(
    () => sortRows(pods, sortState.key, sortState.direction),
    [pods, sortState],
  );

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

  if (!pods.length) {
    return (
      <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>
        No pods found for this DaemonSet.
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
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ color: 'var(--gh-text, #c9d1d9)', fontWeight: 500 }}>
          Pods by Node
        </span>
        <span
          style={{
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 10,
            backgroundColor: '#238636',
            color: '#fff',
          }}
        >
          {pods.length} pods on {Object.keys(podsByNode).length} nodes
        </span>
      </div>

      <table className="panel-table">
        <thead>
          <tr>
            <th
              aria-sort={
                sortState.key === 'node'
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
                  setSortState((cur) => toggleSortState(cur, 'node'))
                }
              >
                <span>Node</span>
                <span aria-hidden="true">
                  {sortState.key === 'node'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
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
                <span>Pod</span>
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
                sortState.key === 'status'
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
                  setSortState((cur) => toggleSortState(cur, 'status'))
                }
              >
                <span>Status</span>
                <span aria-hidden="true">
                  {sortState.key === 'status'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                sortState.key === 'ready'
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
                  setSortState((cur) => toggleSortState(cur, 'ready'))
                }
              >
                <span>Ready</span>
                <span aria-hidden="true">
                  {sortState.key === 'ready'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                sortState.key === 'restarts'
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
                  setSortState((cur) => toggleSortState(cur, 'restarts'))
                }
              >
                <span>Restarts</span>
                <span aria-hidden="true">
                  {sortState.key === 'restarts'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                sortState.key === 'age'
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
                  setSortState((cur) => toggleSortState(cur, 'age'))
                }
              >
                <span>Age</span>
                <span aria-hidden="true">
                  {sortState.key === 'age'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                sortState.key === 'ip'
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
                  setSortState((cur) => toggleSortState(cur, 'ip'))
                }
              >
                <span>IP</span>
                <span aria-hidden="true">
                  {sortState.key === 'ip'
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
          {sortedPods.map((pod, idx) => (
            <tr key={pod.name || idx}>
              <td>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '2px 8px',
                    backgroundColor: '#21262d',
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: '#58a6ff' }}>🖥️</span>
                  <span>{pod.node || 'Unknown'}</span>
                </span>
              </td>
              <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                {pod.name}
              </td>
              <td>
                <StatusBadge
                  status={pod.status || '-'}
                  size="small"
                  showDot={false}
                />
              </td>
              <td>{pod.ready}</td>
              <td style={{ color: pod.restarts > 0 ? '#f85149' : undefined }}>
                {pod.restarts}
              </td>
              <td>{pod.age}</td>
              <td
                className="text-muted"
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              >
                {pod.ip || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
