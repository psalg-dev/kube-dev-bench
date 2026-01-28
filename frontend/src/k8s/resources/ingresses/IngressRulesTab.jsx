import { useMemo, useState, useEffect } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import './IngressRulesTab.css';
import {
  pickDefaultSortKey,
  sortRows,
  toggleSortState,
} from '../../../utils/tableSorting.js';

/**
 * Rules tab for Ingresses - shows routing rules and backends.
 *
 * @param {string} namespace - The namespace of the Ingress
 * @param {string} ingressName - The name of the Ingress
 * @param {string[]} hosts - Array of hosts from the ingress
 */
export default function IngressRulesTab({ namespace, ingressName, hosts }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        // Try to get ingress detail if API exists
        if (typeof AppAPI.GetIngressDetail === 'function') {
          const result = await AppAPI.GetIngressDetail(namespace, ingressName);
          setDetail(result);
        } else {
          // Fallback: use the hosts prop to build basic rules
          setDetail({
            rules:
              hosts?.map((host) => ({
                host,
                paths: [
                  {
                    path: '/',
                    pathType: 'Prefix',
                    backend: { serviceName: 'unknown', servicePort: 'unknown' },
                  },
                ],
              })) || [],
          });
        }
      } catch (err) {
        setError(err?.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [namespace, ingressName, hosts]);

  if (loading) {
    return (
      <div className="ingress-rules-tab">
        <div className="loading">Loading rules...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ingress-rules-tab">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  const rules = detail?.rules || [];
  const hasRules = rules.length > 0 || (hosts && hosts.length > 0);

  if (!hasRules) {
    return (
      <div className="ingress-rules-tab">
        <div className="no-rules">
          <div className="icon">🔀</div>
          <h3>No Rules Defined</h3>
          <p>This Ingress has no routing rules configured.</p>
        </div>
      </div>
    );
  }

  // If we have rules from the API, use them; otherwise build from hosts
  const displayRules =
    rules.length > 0
      ? rules
      : (hosts || []).map((host) => ({
          host,
          paths: [
            {
              path: '/*',
              pathType: 'Prefix',
              backend: { serviceName: '-', servicePort: '-' },
            },
          ],
        }));

  return (
    <div className="ingress-rules-tab">
      <div className="rules-header">
        <h3>Routing Rules</h3>
        <p>
          {displayRules.length} rule{displayRules.length !== 1 ? 's' : ''}{' '}
          configured
        </p>
      </div>

      <div className="rules-list">
        {displayRules.map((rule, ruleIdx) => (
          <div key={ruleIdx} className="rule-card">
            <div className="rule-header">
              <span className="host-badge">🌐 {rule.host || '*'}</span>
            </div>

            <RulePathsTable paths={rule.paths || []} />
          </div>
        ))}
      </div>

      {detail?.tls && detail.tls.length > 0 && (
        <div className="tls-section">
          <h4>🔒 TLS Configuration</h4>
          <div className="tls-list">
            {detail.tls.map((tlsConfig, idx) => (
              <div key={idx} className="tls-item">
                <span className="tls-label">Secret:</span>
                <span className="tls-value">{tlsConfig.secretName || '-'}</span>
                <span className="tls-label">Hosts:</span>
                <span className="tls-value">
                  {tlsConfig.hosts?.join(', ') || '*'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RulePathsTable({ paths }) {
  const columns = useMemo(
    () => [
      { key: 'path', label: 'Path' },
      { key: 'pathType', label: 'Path Type' },
      { key: 'backendService', label: 'Backend Service' },
      { key: 'backendPort', label: 'Port' },
    ],
    [],
  );
  const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
  const [sortState, setSortState] = useState(() => ({
    key: defaultSortKey,
    direction: 'asc',
  }));
  const normalizedPaths = useMemo(
    () =>
      (paths || []).map((path) => ({
        path: path.path || '/',
        pathType: path.pathType || 'Prefix',
        backendService:
          path.backend?.serviceName || path.backend?.service?.name || '-',
        backendPort:
          path.backend?.servicePort ||
          path.backend?.service?.port?.number ||
          path.backend?.service?.port?.name ||
          '-',
      })),
    [paths],
  );
  const sortedPaths = useMemo(
    () => sortRows(normalizedPaths, sortState.key, sortState.direction),
    [normalizedPaths, sortState],
  );

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
    <table className="paths-table">
      <thead>
        <tr>
          <th
            aria-sort={
              sortState.key === 'path'
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
                setSortState((cur) => toggleSortState(cur, 'path'))
              }
            >
              <span>Path</span>
              <span aria-hidden="true">
                {sortState.key === 'path'
                  ? sortState.direction === 'asc'
                    ? '▲'
                    : '▼'
                  : '↕'}
              </span>
            </button>
          </th>
          <th
            aria-sort={
              sortState.key === 'pathType'
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
                setSortState((cur) => toggleSortState(cur, 'pathType'))
              }
            >
              <span>Path Type</span>
              <span aria-hidden="true">
                {sortState.key === 'pathType'
                  ? sortState.direction === 'asc'
                    ? '▲'
                    : '▼'
                  : '↕'}
              </span>
            </button>
          </th>
          <th
            aria-sort={
              sortState.key === 'backendService'
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
                setSortState((cur) => toggleSortState(cur, 'backendService'))
              }
            >
              <span>Backend Service</span>
              <span aria-hidden="true">
                {sortState.key === 'backendService'
                  ? sortState.direction === 'asc'
                    ? '▲'
                    : '▼'
                  : '↕'}
              </span>
            </button>
          </th>
          <th
            aria-sort={
              sortState.key === 'backendPort'
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
                setSortState((cur) => toggleSortState(cur, 'backendPort'))
              }
            >
              <span>Port</span>
              <span aria-hidden="true">
                {sortState.key === 'backendPort'
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
        {sortedPaths.map((path, pathIdx) => (
          <tr key={pathIdx}>
            <td className="path-cell">
              <code>{path.path}</code>
            </td>
            <td>
              <span className="path-type-badge">{path.pathType}</span>
            </td>
            <td className="service-cell">{path.backendService}</td>
            <td className="port-cell">{path.backendPort}</td>
          </tr>
        ))}
        {sortedPaths.length === 0 && (
          <tr>
            <td colSpan="4" className="no-paths">
              No paths configured for this host
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
