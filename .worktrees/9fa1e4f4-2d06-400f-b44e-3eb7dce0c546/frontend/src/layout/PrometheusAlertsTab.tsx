import { useEffect, useMemo, useState } from 'react';
import HolmesResponseRenderer from '../holmes/HolmesResponseRenderer';
import {
  GetPrometheusAlerts,
  InvestigatePrometheusAlert,
  GetAlertInvestigationHistory,
} from './monitorApi';
import './PrometheusAlertsTab.css';

type PrometheusAlert = {
  name?: string;
  Name?: string;
  labels?: Record<string, string>;
  Labels?: Record<string, string>;
  annotations?: Record<string, string>;
  Annotations?: Record<string, string>;
  state?: string;
  State?: string;
  value?: string | number;
  activeAt?: string;
  ActiveAt?: string;
  activeFor?: string;
};

type InvestigationHistoryItem = {
  alertName: string;
  timestamp: string;
};

export function PrometheusAlertsTab() {
  const [prometheusURL, setPrometheusURL] = useState(() => {
    try {
      return localStorage.getItem('monitor.prometheus.url') || '';
    } catch {
      return '';
    }
  });
  const [alerts, setAlerts] = useState<PrometheusAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysisByAlert, setAnalysisByAlert] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<InvestigationHistoryItem[]>([]);
  const [investigating, setInvestigating] = useState<Record<string, boolean>>({});

  useEffect(() => {
    GetAlertInvestigationHistory()
      .then((items) => setHistory(Array.isArray(items) ? (items as InvestigationHistoryItem[]) : []))
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
      setAlerts(Array.isArray(data) ? (data as PrometheusAlert[]) : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch alerts';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleInvestigate = async (alert: PrometheusAlert) => {
    const key = alert.name || alert.Name || 'Alert';
    setInvestigating((prev) => ({ ...prev, [key]: true }));
    try {
      const resp = await InvestigatePrometheusAlert(alert);
      const analysis = resp?.response || resp?.analysis || '';
      setAnalysisByAlert((prev) => ({ ...prev, [key]: analysis }));
      const latestHistory = await GetAlertInvestigationHistory();
      setHistory(Array.isArray(latestHistory) ? (latestHistory as InvestigationHistoryItem[]) : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Investigation failed';
      setError(message);
    } finally {
      setInvestigating((prev) => ({ ...prev, [key]: false }));
    }
  };

  const computedAlerts = useMemo(() => {
    return alerts.map((alert) => {
      const name = alert.name || alert.Name || alert.labels?.alertname || 'Alert';
      const activeAt = alert.activeAt || alert.ActiveAt;
      const activeAtDate = activeAt ? new Date(activeAt) : null;
      let activeFor = '';
      if (activeAtDate && !Number.isNaN(activeAtDate.getTime())) {
        const minutes = Math.max(1, Math.floor((Date.now() - activeAtDate.getTime()) / 60000));
        activeFor = `${minutes}m`;
      }
      return {
        ...alert,
        name,
        activeFor,
      } as PrometheusAlert;
    });
  }, [alerts]);

  return (
    <div className="prometheus-tab">
      <div className="prometheus-header">
        <input
          type="text"
          placeholder="Prometheus URL (e.g. http://localhost:9090)"
          value={prometheusURL}
          onChange={(event) => setPrometheusURL(event.target.value)}
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
          computedAlerts.map((alert, idx) => (
            <div key={`${alert.name || 'alert'}-${idx}`} className="prometheus-alert-card">
              <div className="prometheus-alert-top">
                <div className="prometheus-alert-title">{alert.name}</div>
                <span className={`prometheus-alert-state ${alert.state || alert.State}`}>
                  {alert.state || alert.State}
                </span>
              </div>
              <div className="prometheus-alert-meta">
                {alert.value && <span>Value: {alert.value}</span>}
                {alert.activeFor && <span>Active: {alert.activeFor}</span>}
              </div>
              <div className="prometheus-alert-labels">
                {Object.entries(alert.labels || alert.Labels || {}).map(([key, value]) => (
                  <span key={key} className="prometheus-alert-chip">
                    {key}: {value}
                  </span>
                ))}
              </div>
              <div className="prometheus-alert-annotations">
                {Object.entries(alert.annotations || alert.Annotations || {}).map(([key, value]) => (
                  <div key={key}>
                    <strong>{key}:</strong> {value}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="prometheus-investigate"
                onClick={() => handleInvestigate(alert)}
                disabled={Boolean(alert.name && investigating[alert.name])}
              >
                {alert.name && investigating[alert.name] ? 'Investigating…' : 'Investigate'}
              </button>
              {alert.name && analysisByAlert[alert.name] && (
                <div className="prometheus-analysis">
                  <HolmesResponseRenderer response={{ response: analysisByAlert[alert.name] }} />
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

