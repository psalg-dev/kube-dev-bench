import React from 'react';
import { useConnectionsState } from './ConnectionsStateContext.jsx';
import KubernetesConnectionsList from './KubernetesConnectionsList.jsx';
import DockerSwarmConnectionsList from './DockerSwarmConnectionsList.jsx';
import AddKubeConfigOverlay from './AddKubeConfigOverlay.jsx';
import AddSwarmConnectionOverlay from './AddSwarmConnectionOverlay.jsx';
import ConnectionProxySettings from './ConnectionProxySettings.jsx';

function ConnectionsMainView({ onConnect }) {
  const {
    selectedSection,
    showAddKubeConfigOverlay,
    showAddSwarmOverlay,
    showProxySettings,
    pinnedConnections,
    actions,
  } = useConnectionsState();

  const renderContent = () => {
    // Handle pinned connection detail view
    if (selectedSection.startsWith('pinned-')) {
      const parts = selectedSection.split('-');
      const type = parts[1];
      const id = parts.slice(2).join('-');
      const pinned = pinnedConnections.find((c) => c.type === type && c.id === id);

      if (pinned) {
        if (type === 'kubernetes') {
          return (
            <KubernetesConnectionsList
              onConnect={onConnect}
              filterConfig={pinned}
            />
          );
        } else {
          return (
            <DockerSwarmConnectionsList
              onConnect={onConnect}
              filterConnection={pinned}
            />
          );
        }
      }
    }

    switch (selectedSection) {
      case 'kubernetes':
        return <KubernetesConnectionsList onConnect={onConnect} />;
      case 'docker-swarm':
        return <DockerSwarmConnectionsList onConnect={onConnect} />;
      default:
        return <KubernetesConnectionsList onConnect={onConnect} />;
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {renderContent()}

      {/* Overlays */}
      {showAddKubeConfigOverlay && (
        <AddKubeConfigOverlay
          onClose={() => actions.showAddKubeConfigOverlay(false)}
          onSuccess={() => {
            actions.showAddKubeConfigOverlay(false);
            actions.loadKubeConfigs();
          }}
        />
      )}

      {showAddSwarmOverlay && (
        <AddSwarmConnectionOverlay
          onClose={() => actions.showAddSwarmOverlay(false)}
          onSuccess={(connection) => {
            actions.showAddSwarmOverlay(false);
            actions.addSwarmConnection(connection);
          }}
        />
      )}

      {showProxySettings && (
        <ConnectionProxySettings
          onClose={() => actions.showProxySettings(false)}
        />
      )}
    </div>
  );
}

export default ConnectionsMainView;
