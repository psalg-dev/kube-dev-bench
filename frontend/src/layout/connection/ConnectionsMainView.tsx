import { useConnectionsState, type PinnedConnection, type SwarmConnectionEntry } from './ConnectionsStateContext';
import KubernetesConnectionsList from './KubernetesConnectionsList';
import DockerSwarmConnectionsList from './DockerSwarmConnectionsList';
import AddKubeConfigOverlay from './AddKubeConfigOverlay';
import AddSwarmConnectionOverlay from './AddSwarmConnectionOverlay';
import ConnectionProxySettings from './ConnectionProxySettings';
import ConnectionHooksSettings from './ConnectionHooksSettings';

type ConnectionsMainViewProps = {
  onConnect?: () => void;
};


function ConnectionsMainView({ onConnect }: ConnectionsMainViewProps) {
  const {
    selectedSection,
    showAddKubeConfigOverlay,
    showAddSwarmOverlay,
    showProxySettings,
    showHooksSettings,
    pinnedConnections,
    actions,
  } = useConnectionsState();

  const renderContent = () => {
    if (selectedSection.startsWith('pinned-')) {
      const parts = selectedSection.split('-');
      const type = parts[1];
      const id = parts.slice(2).join('-');
      const pinned = (pinnedConnections as PinnedConnection[]).find((c) => c.type === type && c.id === id);

      if (pinned) {
        if (type === 'kubernetes') {
          return <KubernetesConnectionsList onConnect={onConnect} filterConfig={pinned} />;
        }
        return <DockerSwarmConnectionsList onConnect={onConnect} filterConnection={pinned} />;
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
          onSuccess={(connection: SwarmConnectionEntry) => {
            actions.showAddSwarmOverlay(false);
            actions.addSwarmConnection(connection);
          }}
        />
      )}

      {showProxySettings && <ConnectionProxySettings onClose={() => actions.showProxySettings(false)} />}

      {showHooksSettings && <ConnectionHooksSettings onClose={() => actions.showHooksSettings(false)} />}
    </div>
  );
}

export default ConnectionsMainView;

