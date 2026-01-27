import React, { useMemo, useState, useEffect } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import './ServiceEndpointsTab.css';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../../utils/tableSorting.js';

export default function ServiceEndpointsTab({ namespace, serviceName }) {
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!namespace || !serviceName) {
      setEndpoints([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchEndpoints = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await AppAPI.GetServiceEndpoints(namespace, serviceName);
        if (!cancelled) {
          setEndpoints(data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load endpoints');
          setEndpoints([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchEndpoints();

    return () => {
      cancelled = true;
    };
  }, [namespace, serviceName]);

  if (loading) {
    return (
      <div className="service-endpoints-loading">
        <span className="spinner" /> Loading endpoints...
      </div>
    );
  }

  if (error) {
    return (
      <div className="service-endpoints-error">
        <span className="error-icon">⚠</span>
        <span>{error}</span>
      </div>
    );
  }

  if (!endpoints || endpoints.length === 0) {
    return (
      <div className="service-endpoints-empty">
        <div className="empty-icon">🔌</div>
        <div className="empty-title">No Endpoints</div>
        <div className="empty-hint">
          This service has no backing pods or the pods are not ready.
        </div>
      </div>
    );
  }

  const readyEndpoints = endpoints.filter(ep => ep.ready);
  const notReadyEndpoints = endpoints.filter(ep => !ep.ready);
  const columns = useMemo(() => ([
    { key: 'status', label: 'Status' },
    { key: 'ip', label: 'IP' },
    { key: 'port', label: 'Port' },
    { key: 'protocol', label: 'Protocol' },
    { key: 'podName', label: 'Pod' },
    { key: 'nodeName', label: 'Node' },
  ]), []);
  const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
  const [sortState, setSortState] = useState(() => ({ key: defaultSortKey, direction: 'asc' }));
  const sortedEndpoints = useMemo(() => {
    return sortRows(endpoints, sortState.key, sortState.direction, (row, key) => {
      if (key === 'status') return row?.ready ? 'Ready' : 'Not Ready';
      return row?.[key];
    });
  }, [endpoints, sortState]);

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
    <div className="service-endpoints-tab">
      <div className="endpoints-header">
        <span className="endpoints-count">
          <span className="ready-count">{readyEndpoints.length} ready</span>
          {notReadyEndpoints.length > 0 && (
            <span className="not-ready-count">, {notReadyEndpoints.length} not ready</span>
          )}
        </span>
      </div>
      <div className="endpoints-table-container">
        <table className="endpoints-table">
          <thead>
            <tr>
              <th aria-sort={sortState.key === 'status' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'status'))}>
                  <span>Status</span>
                  <span aria-hidden="true">{sortState.key === 'status' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
              <th aria-sort={sortState.key === 'ip' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'ip'))}>
                  <span>IP</span>
                  <span aria-hidden="true">{sortState.key === 'ip' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
              <th aria-sort={sortState.key === 'port' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'port'))}>
                  <span>Port</span>
                  <span aria-hidden="true">{sortState.key === 'port' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
              <th aria-sort={sortState.key === 'protocol' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'protocol'))}>
                  <span>Protocol</span>
                  <span aria-hidden="true">{sortState.key === 'protocol' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
              <th aria-sort={sortState.key === 'podName' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'podName'))}>
                  <span>Pod</span>
                  <span aria-hidden="true">{sortState.key === 'podName' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
              <th aria-sort={sortState.key === 'nodeName' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'nodeName'))}>
                  <span>Node</span>
                  <span aria-hidden="true">{sortState.key === 'nodeName' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedEndpoints.map((ep, idx) => (
              <tr key={`${ep.ip}-${ep.port}-${idx}`} className={ep.ready ? 'ready' : 'not-ready'}>
                <td>
                  <span className={`status-dot ${ep.ready ? 'ready' : 'not-ready'}`} />
                  {ep.ready ? 'Ready' : 'Not Ready'}
                </td>
                <td className="mono">{ep.ip}</td>
                <td className="mono">{ep.port}</td>
                <td>{ep.protocol || 'TCP'}</td>
                <td>{ep.podName || '-'}</td>
                <td>{ep.nodeName || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
