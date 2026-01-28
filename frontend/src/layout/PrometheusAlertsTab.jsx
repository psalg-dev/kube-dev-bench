import { useEffect, useMemo, useState } from 'react';
import HolmesResponseRenderer from '../holmes/HolmesResponseRenderer.jsx';
import {
  GetPrometheusAlerts,
  InvestigatePrometheusAlert,
  GetAlertInvestigationHistory,
} from './monitorApi.js';
import './PrometheusAlertsTab.css';

export function PrometheusAlertsTab() {
  const [prometheusURL, setPrometheusURL] = useState(() => {
    try {
      return localStorage.getItem('monitor.prometheus.url') || '';
    } catch {
      return '';
    }
  });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysisByAlert, setAnalysisByAlert] = useState({});
  const [history, setHistory] = useState([]);
  const [investigating, setInvestigating] = useState({});

  useEffect(() => {
    GetAlertInvestigationHistory()
      .then((items) => setHistory(Array.isArray(items) ? items : []))
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('monitor.prometheus.url', prometheusURL);
    } catch {
      // ignore
    }
  }, [prometheusURL]);

  const handleFetch = async () => {
    if (!prometheusURL) {
      setError('Enter a Prometheus URL');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await GetPrometheusAlerts(prometheusURL);
      setAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleInvestigate = async (alert) => {
    setInvestigating((prev) => ({ ...prev, [alert.name || alert.Name]: true }));
    try {
      const resp = await InvestigatePrometheusAlert(alert);
      const analysis =
        resp?.response ||
        resp?.Response ||
        resp?.analysis ||
        resp?.Analysis ||
        '';
      setAnalysisByAlert((prev) => ({
        ...prev,
        [alert.name || alert.Name]: analysis,
      }));
      const latestHistory = await GetAlertInvestigationHistory();
      setHistory(Array.isArray(latestHistory) ? latestHistory : []);
    } catch (err) {
      setError(err?.message || 'Investigation failed');
    } finally {
      setInvestigating((prev) => ({
        ...prev,
        [alert.name || alert.Name]: false,
      }));
    }
  };

  const computedAlerts = useMemo(() => {
    return alerts.map((alert) => {
      const name =
        alert.name || alert.Name || alert.labels?.alertname || 'Alert';
      const activeAt = alert.activeAt || alert.ActiveAt;
      const activeAtDate = activeAt ? new Date(activeAt) : null;
      let activeFor = '';
      if (activeAtDate && !Number.isNaN(activeAtDate.getTime())) {
        const minutes = Math.max(
          1,
          Math.floor((Date.now() - activeAtDate.getTime()) / 60000),
        );
        activeFor = `${minutes}m`;
      }
      return {
        ...alert,
        name,
        activeFor,
      };
    });
  }, [alerts]);

  return (
    <div className="prometheus-tab">
      <div className="prometheus-header">
        <input
          type="text"
          placeholder="Prometheus URL (e.g. http://localhost:9090)"
          value={prometheusURL}
          onChange={(e) => setPrometheusURL(e.target.value)}
        />
        <button type="button" onClick={handleFetch} disabled={loading}>
          {loading ? 'Fetching…' : 'Fetch Alerts'}
        </button>
      </div>

      {error && <div className="prometheus-error">{error}</div>}

      <div className="prometheus-alerts">
        {computedAlerts.length === 0 && !loading ? (
          <div className="prometheus-empty">No alerts loaded</div>
        ) : (
          computedAlerts.map((alert) => (
            <div key={alert.name} className="prometheus-alert-card">
              <div className="prometheus-alert-top">
                <div className="prometheus-alert-title">{alert.name}</div>
                <span
                  className={`prometheus-alert-state ${alert.state || alert.State}`}
                >
                  {alert.state || alert.State}
                </span>
              </div>
              <div className="prometheus-alert-meta">
                {alert.value && <span>Value: {alert.value}</span>}
                {alert.activeFor && <span>Active: {alert.activeFor}</span>}
              </div>
              <div className="prometheus-alert-labels">
                {Object.entries(alert.labels || alert.Labels || {}).map(
                  ([key, value]) => (
                    <span key={key} className="prometheus-alert-chip">
                      {key}: {value}
                    </span>
                  ),
                )}
              </div>
              <div className="prometheus-alert-annotations">
                {Object.entries(
                  alert.annotations || alert.Annotations || {},
                ).map(([key, value]) => (
                  <div key={key}>
                    <strong>{key}:</strong> {value}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="prometheus-investigate"
                onClick={() => handleInvestigate(alert)}
                disabled={investigating[alert.name]}
              >
                {investigating[alert.name] ? 'Investigating…' : 'Investigate'}
              </button>
              {analysisByAlert[alert.name] && (
                <div className="prometheus-analysis">
                  <HolmesResponseRenderer
                    response={{ response: analysisByAlert[alert.name] }}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {history.length > 0 && (
        <div className="prometheus-history">
          <h4>Investigation history</h4>
          <ul>
            {history.map((item, idx) => (
              <li key={`${item.alertName}-${idx}`}>
                <span>{item.alertName}</span>
                <span>{new Date(item.timestamp).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default PrometheusAlertsTab;
