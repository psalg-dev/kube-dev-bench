import React from 'react';
import { useConnectionsState } from './ConnectionsStateContext.jsx';

const cardStyle = {
  border: '2px solid var(--gh-border, #444)',
  borderRadius: 0,
  padding: '16px',
  marginBottom: '12px',
  cursor: 'pointer',
  transition: 'all 0.2s',
  background: 'var(--gh-input-bg, #2a2a2a)',
};

const cardHoverStyle = {
  ...cardStyle,
  borderColor: 'var(--gh-accent, #0969da)',
  background: 'var(--gh-input-bg-hover, #333)',
};

const selectedCardStyle = {
  ...cardStyle,
  borderColor: 'var(--gh-accent, #0969da)',
  background: 'rgba(9, 105, 218, 0.1)',
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '24px',
};

const buttonStyle = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: 0,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const primaryButtonStyle = {
  ...buttonStyle,
  background: 'var(--gh-accent, #0969da)',
  color: '#fff',
};

const secondaryButtonStyle = {
  ...buttonStyle,
  background: 'var(--gh-button-secondary-bg, #444)',
  color: 'var(--gh-text, #fff)',
  border: '1px solid var(--gh-border, #555)',
};

function KubernetesConnectionsList({ onConnect, filterConfig }) {
  const {
    kubeConfigs,
    selectedKubeConfig,
    loading,
    error,
    pinnedConnections,
    hooks,
    actions,
  } = useConnectionsState();

  const [hoveredIndex, setHoveredIndex] = React.useState(null);

  const displayConfigs = filterConfig
    ? kubeConfigs.filter((c) => c.path === filterConfig.path)
    : kubeConfigs;

  const handleConnect = async (config) => {
    const success = await actions.connectKubeConfig(config);
    if (success && onConnect) {
      onConnect();
    }
  };

  const isPinned = (config) => {
    return pinnedConnections.some(
      (c) => c.type === 'kubernetes' && c.id === config.path
    );
  };

  const handleTogglePin = (e, config) => {
    e.stopPropagation();
    actions.togglePin('kubernetes', config.path, {
      name: config.name,
      path: config.path,
      contexts: config.contexts,
    });
  };

  const handleProxySettings = (e, config) => {
    e.stopPropagation();
    actions.showProxySettings(true, { type: 'kubernetes', ...config });
  };

  const handleHooksSettings = (e, config) => {
    e.stopPropagation();
    actions.showHooksSettings(true, { type: 'kubernetes', id: config.path, ...config });
  };

  const hookCountFor = (config) => {
    const id = config.path;
    const list = Array.isArray(hooks) ? hooks : [];
    return list.filter((h) => {
      const scope = h?.scope || 'global';
      if (scope === 'global') return true;
      return h?.scope === 'connection' && h?.connectionType === 'kubernetes' && h?.connectionId === id;
    }).length;
  };

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--gh-text, #fff)', fontSize: 24 }}>
            ☸️ Kubernetes Connections
          </h2>
          <p style={{ margin: '8px 0 0', color: 'var(--gh-text-secondary, #ccc)', fontSize: 14 }}>
            Select a kubeconfig to connect to your cluster
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            id="browse-kubeconfig-btn"
            style={secondaryButtonStyle}
            onClick={() => actions.browseKubeConfigFile()}
          >
            📁 Browse
          </button>
          <button
            id="add-kubeconfig-btn"
            style={primaryButtonStyle}
            onClick={() => actions.showAddKubeConfigOverlay(true)}
          >
            ➕ Add Config
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            background: 'rgba(248, 81, 73, 0.1)',
            border: '1px solid #f85149',
            color: '#f85149',
            padding: '12px',
            marginBottom: '16px',
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gh-text-secondary, #ccc)' }}>
          Loading kubeconfig files...
        </div>
      )}

      {/* Empty state */}
      {!loading && displayConfigs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gh-text-secondary, #ccc)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>☸️</div>
          <h3 style={{ margin: '0 0 12px', color: 'var(--gh-text, #fff)' }}>
            No Kubeconfig Files Found
          </h3>
          <p style={{ margin: '0 0 24px' }}>
            Add a kubeconfig to connect to your Kubernetes clusters
          </p>
          <button
            style={primaryButtonStyle}
            onClick={() => actions.showAddKubeConfigOverlay(true)}
          >
            ➕ Add Your First Kubeconfig
          </button>
        </div>
      )}

      {/* Config list */}
      {!loading && displayConfigs.length > 0 && (
        <div className="config-list">
          {displayConfigs.map((config, index) => {
            const isSelected = selectedKubeConfig?.path === config.path;
            const isHovered = hoveredIndex === index;
            const pinned = isPinned(config);

            return (
              <div
                key={config.path}
                className={`config-item${isSelected ? ' selected' : ''}`}
                style={isSelected ? selectedCardStyle : isHovered ? cardHoverStyle : cardStyle}
                onClick={() => actions.selectKubeConfig(config)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--gh-text, #fff)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {config.name}
                      {pinned && <span style={{ fontSize: 12 }}>📌</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #ccc)', fontFamily: 'monospace', marginBottom: 4 }}>
                      {config.path}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gh-text-tertiary, #999)' }}>
                      Contexts: {(config.contexts || []).join(', ') || 'None'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={(e) => handleTogglePin(e, config)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--gh-border, #444)',
                        color: pinned ? '#f0c674' : 'var(--gh-text-secondary, #ccc)',
                        padding: '4px 8px',
                        borderRadius: 0,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                      title={pinned ? 'Unpin' : 'Pin to sidebar'}
                    >
                      📌
                    </button>
                    <button
                      onClick={(e) => handleProxySettings(e, config)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--gh-border, #444)',
                        color: 'var(--gh-text-secondary, #ccc)',
                        padding: '4px 8px',
                        borderRadius: 0,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                      title="Proxy settings"
                    >
                      🌐
                    </button>

                    <button
                      id={`kube-hooks-btn-${String(config.path).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`}
                      onClick={(e) => handleHooksSettings(e, config)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--gh-border, #444)',
                        color: 'var(--gh-text-secondary, #ccc)',
                        padding: '4px 8px',
                        borderRadius: 0,
                        cursor: 'pointer',
                        fontSize: 12,
                        position: 'relative',
                      }}
                      title="Hooks"
                    >
                      🪝
                      {hookCountFor(config) > 0 && (
                        <span
                          style={{
                            position: 'absolute',
                            top: -6,
                            right: -6,
                            background: 'var(--gh-accent, #0969da)',
                            color: '#fff',
                            fontSize: 10,
                            lineHeight: '14px',
                            minWidth: 14,
                            height: 14,
                            borderRadius: 0,
                            padding: '0 4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {hookCountFor(config)}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConnect(config);
                      }}
                      style={{
                        ...primaryButtonStyle,
                        padding: '6px 12px',
                        fontSize: 12,
                      }}
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
