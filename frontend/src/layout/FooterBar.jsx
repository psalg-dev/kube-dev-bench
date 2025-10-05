import React from 'react';
import { useClusterState } from '../state/ClusterStateContext.jsx';

export function FooterBar() {
  const { selectedContext, selectedNamespaces, clusterConnected, connectionStatus } = useClusterState();
  const nsText = selectedNamespaces.join(', ');
  const title = !clusterConnected
    ? 'Not connected to cluster'
    : (connectionStatus && connectionStatus.isInsecure
        ? 'Insecure connection: TLS certificate validation disabled'
        : 'Connected');
  const info = (selectedContext && nsText) ? `${selectedContext} / ${nsText}` : '';
  return (
    <>
      <span id="footer-dot" title={title}>!</span>
      <span id="footer-info">{info}</span>
    </>
  );
}
export default FooterBar;
