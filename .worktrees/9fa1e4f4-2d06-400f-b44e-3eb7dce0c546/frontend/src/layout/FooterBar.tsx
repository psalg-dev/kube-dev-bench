import { useEffect, useState } from 'react';
import { useClusterState } from '../state/ClusterStateContext';
import { EventsOn } from '../../wailsjs/runtime/runtime.js';
import MonitorPanel from './MonitorPanel';
import './FooterBar.css';

type MonitorIssue = {
  holmesAnalyzed?: boolean;
  holmesAnalysis?: string;
};

type MonitorInfo = {
  warningCount: number;
  errorCount: number;
  warnings: MonitorIssue[];
  errors: MonitorIssue[];
};

export function FooterBar() {
  const { selectedContext, selectedNamespaces, clusterConnected, connectionStatus } = useClusterState();
  const [monitorInfo, setMonitorInfo] = useState<MonitorInfo>({
    warningCount: 0,
    errorCount: 0,
    warnings: [],
    errors: [],
  });
  const [showPanel, setShowPanel] = useState(false);
  const hasHolmesAnalysis = [...(monitorInfo.errors || []), ...(monitorInfo.warnings || [])].some(
    (issue) => issue.holmesAnalyzed || (issue.holmesAnalysis && issue.holmesAnalysis.length > 0)
  );

  useEffect(() => {
    const unsubscribe = EventsOn('monitor:update', (data: MonitorInfo) => {
      setMonitorInfo(data);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const nsText = selectedNamespaces.join(', ');
  const isProxyEnabled = connectionStatus && connectionStatus.proxyEnabled;
  const proxyURL = connectionStatus && connectionStatus.proxyURL;
  const title = !clusterConnected
    ? 'Not connected to cluster'
    : connectionStatus && connectionStatus.isInsecure
      ? 'Insecure connection: TLS certificate validation disabled'
      : 'Connected';
  const info = selectedContext && nsText ? `${selectedContext} / ${nsText}` : '';

  return (
    <>
      {/* Monitor badges on the left */}
      <div className="footer-bar__monitor-badges">
        {monitorInfo.errorCount > 0 && (
          <button
            id="monitor-error-badge"
            onClick={() => setShowPanel(true)}
            className="footer-bar__badge footer-bar__badge--error"
            title={`${monitorInfo.errorCount} error${monitorInfo.errorCount > 1 ? 's' : ''} detected${
              hasHolmesAnalysis ? ' (Holmes analysis available)' : ''
            }`}
          >
            <span>⚠</span>
            <span>Errors: {monitorInfo.errorCount}</span>
            {hasHolmesAnalysis && <span title="Holmes analysis available">🧠</span>}
          </button>
        )}
        {monitorInfo.warningCount > 0 && (
          <button
            id="monitor-warning-badge"
            onClick={() => setShowPanel(true)}
            className="footer-bar__badge footer-bar__badge--warning"
            title={`${monitorInfo.warningCount} warning${monitorInfo.warningCount > 1 ? 's' : ''} detected${
              hasHolmesAnalysis ? ' (Holmes analysis available)' : ''
            }`}
          >
            <span>⚡</span>
            <span>Warnings: {monitorInfo.warningCount}</span>
            {hasHolmesAnalysis && <span title="Holmes analysis available">🧠</span>}
          </button>
        )}
      </div>

      {/* Proxy indicator */}
      {isProxyEnabled && (
        <span
          id="proxy-indicator"
          className="footer-bar__proxy-indicator"
          title={`Proxy: ${proxyURL || 'System proxy'}`}
        >
          <span>🌐</span>
          <span>Proxy</span>
        </span>
      )}

      {/* Connection status on the right */}
      <span id="footer-dot" title={title}>
        !
      </span>
      <span id="footer-info">{info}</span>

      {/* Monitor panel */}
      <MonitorPanel monitorInfo={monitorInfo} open={showPanel} onClose={() => setShowPanel(false)} />
    </>
  );
}
export default FooterBar;
