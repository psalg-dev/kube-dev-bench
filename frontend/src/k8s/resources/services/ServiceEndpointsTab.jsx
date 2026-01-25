import React, { useState, useEffect } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import './ServiceEndpointsTab.css';

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
              <th>Status</th>
              <th>IP</th>
              <th>Port</th>
              <th>Protocol</th>
              <th>Pod</th>
              <th>Node</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((ep, idx) => (
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
