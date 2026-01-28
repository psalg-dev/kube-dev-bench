import { useEffect, useMemo, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';
import {
  pickDefaultSortKey,
  sortRows,
  toggleSortState,
} from '../../../utils/tableSorting.js';

export default function CronJobNextRunsTab({
  namespace,
  cronJobName,
  suspend,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // All hooks must be called before any early returns to follow Rules of Hooks
  const columns = useMemo(
    () => [
      { key: 'index', label: '#' },
      { key: 'time', label: 'Scheduled Time' },
    ],
    [],
  );
  const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
  const [sortState, setSortState] = useState(() => ({
    key: defaultSortKey,
    direction: 'asc',
  }));

  const runs = useMemo(() => {
    if (Array.isArray(detail?.nextRuns)) return detail.nextRuns;
    if (Array.isArray(detail?.NextRuns)) return detail.NextRuns;
    return [];
  }, [detail]);
  const rows = useMemo(
    () => runs.map((t, idx) => ({ index: idx + 1, time: t })),
    [runs],
  );
  const sortedRows = useMemo(
    () =>
      sortRows(
        rows,
        sortState.key,
        sortState.direction,
        (row, key) => row?.[key],
      ),
    [rows, sortState],
  );

  useEffect(() => {
    if (!namespace || !cronJobName) return;

    setLoading(true);
    setError(null);

    AppAPI.GetCronJobDetail(namespace, cronJobName)
      .then((data) => {
        setDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to fetch cronjob details');
        setLoading(false);
      });
  }, [namespace, cronJobName]);

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

  if (suspend) {
    return (
      <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>
        CronJob is suspended.
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>
        No upcoming runs available.
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
      <h4 style={{ color: 'var(--gh-text, #c9d1d9)', marginBottom: 12 }}>
        Next Runs (Next 5)
      </h4>
      <table className="panel-table">
        <thead>
          <tr>
            <th
              style={{ width: 60 }}
              aria-sort={
                sortState.key === 'index'
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
                  setSortState((cur) => toggleSortState(cur, 'index'))
                }
              >
                <span>#</span>
                <span aria-hidden="true">
                  {sortState.key === 'index'
                    ? sortState.direction === 'asc'
                      ? '▲'
                      : '▼'
                    : '↕'}
                </span>
              </button>
            </th>
            <th
              aria-sort={
                sortState.key === 'time'
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
                  setSortState((cur) => toggleSortState(cur, 'time'))
                }
              >
                <span>Scheduled Time</span>
                <span aria-hidden="true">
                  {sortState.key === 'time'
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
          {sortedRows.map((row) => (
            <tr key={`${row.time}|${row.index}`}>
              <td className="text-muted">{row.index}</td>
              <td>{formatTimestampDMYHMS(row.time)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
