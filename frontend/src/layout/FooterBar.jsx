import React, { useState, useEffect } from 'react';
import { useClusterState } from '../state/ClusterStateContext.jsx';
import { EventsOn } from '../../wailsjs/runtime/runtime.js';
import MonitorPanel from './MonitorPanel.jsx';

export function FooterBar() {
  const { selectedContext, selectedNamespaces, clusterConnected, connectionStatus } = useClusterState();
  const [monitorInfo, setMonitorInfo] = useState({ warningCount: 0, errorCount: 0, warnings: [], errors: [] });
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    const unsubscribe = EventsOn('monitor:update', (data) => {
      setMonitorInfo(data);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const nsText = selectedNamespaces.join(', ');
  const title = !clusterConnected
    ? 'Not connected to cluster'
    : (connectionStatus && connectionStatus.isInsecure
        ? 'Insecure connection: TLS certificate validation disabled'
        : 'Connected');
  const info = (selectedContext && nsText) ? `${selectedContext} / ${nsText}` : '';

  return (
    <>
      {/* Monitor badges on the left */}
      <div style={{ display: 'flex', gap: '8px', marginRight: 'auto' }}>
        {(monitorInfo.errorCount > 0) && (
          <button
            id="monitor-error-badge"
            onClick={() => setShowPanel(true)}
            style={{
              background: '#d73a49',
              color: '#fff',
              border: 'none',
              borderRadius: 0,
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title={`${monitorInfo.errorCount} error${monitorInfo.errorCount > 1 ? 's' : ''} detected`}
          >
            <span>⚠</span>
            <span>Errors: {monitorInfo.errorCount}</span>
          </button>
        )}
        {monitorInfo.warningCount > 0 && (
          <button
            id="monitor-warning-badge"
            onClick={() => setShowPanel(true)}
            style={{
              background: '#dbab09',
              color: '#fff',
              border: 'none',
              borderRadius: 0,
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title={`${monitorInfo.warningCount} warning${monitorInfo.warningCount > 1 ? 's' : ''} detected`}
          >
            <span>⚡</span>
            <span>Warnings: {monitorInfo.warningCount}</span>
          </button>
        )}
      </div>

      {/* Connection status on the right */}
      <span id="footer-dot" title={title}>!</span>
      <span id="footer-info">{info}</span>

      {/* Monitor panel */}
      <MonitorPanel
        monitorInfo={monitorInfo}
        open={showPanel}
        onClose={() => setShowPanel(false)}
      />
    </>
  );
}
export default FooterBar;
