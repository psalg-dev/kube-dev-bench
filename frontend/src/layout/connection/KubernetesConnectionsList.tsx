import { useState } from 'react';
import { useConnectionsState, type KubeConfigEntry, type PinnedConnection } from './ConnectionsStateContext';
import './ConnectionsList.css';

type KubernetesConnectionsListProps = {
  onConnect?: () => void;
  filterConfig?: PinnedConnection;
};

type HookEntry = {
  scope?: string;
  connectionType?: string;
  connectionId?: string;
};

function KubernetesConnectionsList({ onConnect, filterConfig }: KubernetesConnectionsListProps) {
  const { kubeConfigs, selectedKubeConfig, loading, error, pinnedConnections, hooks, actions } =
    useConnectionsState();

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const displayConfigs = filterConfig
    ? kubeConfigs.filter((c: KubeConfigEntry) => c.path === filterConfig.path)
    : kubeConfigs;

  const handleConnect = async (config: KubeConfigEntry) => {
    const success = await actions.connectKubeConfig(config);
    if (success && onConnect) {
      onConnect();
    }
  };

  const isPinned = (config: KubeConfigEntry) => {
    return pinnedConnections.some((c: PinnedConnection) => c.type === 'kubernetes' && c.id === config.path);
  };

  const handleTogglePin = (e: React.MouseEvent, config: KubeConfigEntry) => {
    e.stopPropagation();
    actions.togglePin('kubernetes', config.path, {
      name: config.name,
      path: config.path,
      contexts: config.contexts || [],
    });
  };

  const handleProxySettings = (e: React.MouseEvent, config: KubeConfigEntry) => {
    e.stopPropagation();
    actions.showProxySettings(true, { type: 'kubernetes', ...config });
  };

  const handleHooksSettings = (e: React.MouseEvent, config: KubeConfigEntry) => {
    e.stopPropagation();
    actions.showHooksSettings(true, { type: 'kubernetes', id: config.path, ...config });
  };

  const hookCountFor = (config: KubeConfigEntry) => {
    const id = config.path;
    const list = Array.isArray(hooks) ? (hooks as HookEntry[]) : [];
    return list.filter((h) => {
      const scope = h?.scope || 'global';
      if (scope === 'global') return true;
      return h?.scope === 'connection' && h?.connectionType === 'kubernetes' && h?.connectionId === id;
    }).length;
  };

  return (
    <div className="connections-list">
      <div className="connections-header">
        <div className="connections-header-text">
          <h2>☸️ Kubernetes Connections</h2>
          <p>Select a kubeconfig to connect to your cluster</p>
        </div>
        <div className="connections-header-actions">
          <button
            id="browse-kubeconfig-btn"
            className="connections-button secondary"
            onClick={() => actions.browseKubeConfigFile()}
          >
            📁 Browse
          </button>
          <button
            id="add-kubeconfig-btn"
            className="connections-button primary"
            onClick={() => actions.showAddKubeConfigOverlay(true)}
          >
            ➕ Add Config
          </button>
        </div>
      </div>

      {error && <div className="connections-alert">{error}</div>}

      {loading && <div className="connections-loading">Loading kubeconfig files...</div>}

      {!loading && displayConfigs.length === 0 && (
        <div className="connections-empty">
          <div className="connections-empty-icon">☸️</div>
          <h3 className="connections-empty-title">No Kubeconfig Files Found</h3>
          <p>Add a kubeconfig to connect to your Kubernetes clusters</p>
          <button className="connections-button primary" onClick={() => actions.showAddKubeConfigOverlay(true)}>
            ➕ Add Your First Kubeconfig
          </button>
        </div>
      )}

      {!loading && displayConfigs.length > 0 && (
        <div className="connections-card-list">
          {displayConfigs.map((config: KubeConfigEntry, index: number) => {
            const isSelected = selectedKubeConfig?.path === config.path;
            const isHovered = hoveredIndex === index;
            const pinned = isPinned(config);
            const cardClassName = [
              'connections-card',
              isSelected ? 'is-selected' : '',
              !isSelected && isHovered ? 'is-hovered' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div
                key={config.path}
                className={cardClassName}
                onClick={() => actions.selectKubeConfig(config)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="connections-card-row">
                  <div className="connections-card-main">
                    <div className="connections-card-title">
                      {config.name}
                      {pinned && <span>📌</span>}
                    </div>
                    <div className="connections-card-path">{config.path}</div>
                    <div className="connections-card-meta">
                      Contexts: {(config.contexts || []).join(', ') || 'None'}
                    </div>
                  </div>
                  <div className="connections-card-actions">
                    <button
                      onClick={(e) => handleTogglePin(e, config)}
                      className={`connections-icon-button${pinned ? ' pinned' : ''}`}
                      title={pinned ? 'Unpin' : 'Pin to sidebar'}
                    >
                      📌
                    </button>
                    <button
                      onClick={(e) => handleProxySettings(e, config)}
                      className="connections-icon-button"
                      title="Proxy settings"
                    >
                      🌐
                    </button>

                    <button
                      id={`kube-hooks-btn-${String(config.path).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`}
                      onClick={(e) => handleHooksSettings(e, config)}
                      className="connections-icon-button"
                      title="Hooks"
                    >
                      🪝
                      {hookCountFor(config) > 0 && (
                        <span className="connections-badge">{hookCountFor(config)}</span>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConnect(config);
                      }}
                      className="connections-button primary small"
                    >
                      Connect
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default KubernetesConnectionsList;
