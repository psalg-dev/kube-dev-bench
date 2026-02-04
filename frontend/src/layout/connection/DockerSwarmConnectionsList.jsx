import { useState } from 'react';
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

const connectedCardStyle = {
  ...cardStyle,
  borderColor: '#2ea44f',
  background: 'rgba(46, 164, 79, 0.1)',
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

const statusBadgeStyle = {
  padding: '4px 8px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
};

function DockerSwarmConnectionsList({ onConnect, filterConnection }) {
  const {
    swarmConnections,
    swarmDetecting,
    pinnedConnections,
    hooks,
    actions,
  } = useConnectionsState();

  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testResults, setTestResults] = useState({});

  const displayConnections = filterConnection
    ? swarmConnections.filter((c) => c.id === filterConnection.id)
    : swarmConnections;

  const isPinned = (connection) => {
    return pinnedConnections.some(
      (c) => c.type === 'swarm' && c.id === connection.id
    );
  };

  const handleTogglePin = (e, connection) => {
    e.stopPropagation();
    actions.togglePin('swarm', connection.id, {
      name: connection.name,
      host: connection.host,
    });
  };

  const handleTestConnection = async (e, connection) => {
    e.stopPropagation();
    setTesting(connection.id);
    try {
      const result = await actions.testSwarmConnection({
        host: connection.host,
        tlsEnabled: connection.tlsEnabled,
        tlsCert: connection.tlsCert,
        tlsKey: connection.tlsKey,
        tlsCA: connection.tlsCA,
        tlsVerify: connection.tlsVerify,
      });
      setTestResults((prev) => ({ ...prev, [connection.id]: result }));
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [connection.id]: { connected: false, error: err.toString() } }));
    } finally {
      setTesting(null);
    }
  };

  const handleConnect = async (e, connection) => {
    e.stopPropagation();
    setTesting(connection.id); // Show loading state
    try {
      const result = await actions.connectSwarm({
        host: connection.host,
        tlsEnabled: connection.tlsEnabled || false,
        tlsCert: connection.tlsCert || '',
        tlsKey: connection.tlsKey || '',
        tlsCA: connection.tlsCA || '',
        tlsVerify: connection.tlsVerify !== false,
      });
      // Update test results to show connection status
      setTestResults((prev) => ({
        ...prev,
        [connection.id]: {
          connected: result?.connected || false,
          serverVersion: result?.serverVersion || '',
          error: result?.error || (result?.connected ? '' : 'Connection failed'),
        },
      }));
      if (result?.connected && onConnect) {
        onConnect();
      }
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [connection.id]: { connected: false, error: err.toString() },
      }));
    } finally {
      setTesting(null);
    }
  };

  const handleProxySettings = (e, connection) => {
    e.stopPropagation();
    actions.showProxySettings(true, { type: 'swarm', ...connection });
  };

  const handleHooksSettings = (e, connection) => {
    e.stopPropagation();
    actions.showHooksSettings(true, { type: 'swarm', id: connection.id, ...connection });
  };

  const hookCountFor = (connection) => {
    const id = connection.host || connection.id;
    const list = Array.isArray(hooks) ? hooks : [];
    return list.filter((h) => {
      const scope = h?.scope || 'global';
      if (scope === 'global') return true;
      return h?.scope === 'connection' && h?.connectionType === 'swarm' && h?.connectionId === id;
    }).length;
  };

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--gh-text, #fff)', fontSize: 24 }}>
            🐳 Docker Swarm Connections
          </h2>
          <p style={{ margin: '8px 0 0', color: 'var(--gh-text-secondary, #ccc)', fontSize: 14 }}>
            Connect to Docker hosts and manage Swarm clusters
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            id="refresh-swarm-btn"
            style={secondaryButtonStyle}
            onClick={() => actions.detectSwarmConnections()}
            disabled={swarmDetecting}
          >
            🔄 Refresh
          </button>
          <button
            id="add-swarm-btn"
            style={primaryButtonStyle}
            onClick={() => actions.showAddSwarmOverlay(true)}
          >
            ➕ Add Connection
          </button>
        </div>
      </div>

      {/* Loading state */}
      {swarmDetecting && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gh-text-secondary, #ccc)' }}>
          Detecting Docker connections...
        </div>
      )}

      {/* Empty state */}
      {!swarmDetecting && displayConnections.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gh-text-secondary, #ccc)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🐳</div>
          <h3 style={{ margin: '0 0 12px', color: 'var(--gh-text, #fff)' }}>
            No Docker Connections Found
          </h3>
          <p style={{ margin: '0 0 24px' }}>
            Add a Docker host connection to manage containers and Swarm services
          </p>
          <button
            style={primaryButtonStyle}
            onClick={() => actions.showAddSwarmOverlay(true)}
          >
            ➕ Add Connection
          </button>
        </div>
      )}

      {/* Connection list */}
      {!swarmDetecting && displayConnections.length > 0 && (
        <div className="connection-list">
          {displayConnections.map((connection, index) => {
            const isHovered = hoveredIndex === index;
            const pinned = isPinned(connection);
            const testResult = testResults[connection.id];
            const isConnected = connection.connected || testResult?.connected;

            return (
              <div
                key={connection.id}
                className="connection-item"
                style={isConnected ? connectedCardStyle : isHovered ? cardHoverStyle : cardStyle}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--gh-text, #fff)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {connection.name}
                      {pinned && <span style={{ fontSize: 12 }}>📌</span>}
                      {isConnected && (
                        <span
                          style={{
                            ...statusBadgeStyle,
                            background: 'rgba(46, 164, 79, 0.2)',
                            color: '#2ea44f',
                          }}
                        >
                          Connected
                        </span>
                      )}
                      {connection.swarmActive && (
                        <span
                          style={{
                            ...statusBadgeStyle,
                            background: 'rgba(56, 139, 253, 0.2)',
                            color: '#388bfd',
                          }}
                        >
                          Swarm
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #ccc)', fontFamily: 'monospace', marginBottom: 4 }}>
                      {connection.host}
                    </div>
                    {connection.serverVersion && (
                      <div style={{ fontSize: 12, color: 'var(--gh-text-tertiary, #999)' }}>
                        Docker {connection.serverVersion}
                      </div>
                    )}
                    {testResult && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: '8px 12px',
                          borderRadius: 4,
                          fontSize: 12,
                          background: testResult.connected
                            ? 'rgba(46, 164, 79, 0.1)'
                            : 'rgba(248, 81, 73, 0.1)',
                          color: testResult.connected ? '#2ea44f' : '#f85149',
                          border: `1px solid ${testResult.connected ? '#2ea44f' : '#f85149'}`,
                        }}
                      >
                        {testResult.connected
                          ? `✓ Connection successful${testResult.serverVersion ? ` (Docker ${testResult.serverVersion})` : ''}`
                          : `✗ ${testResult.error || 'Connection failed'}`}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={(e) => handleTogglePin(e, connection)}
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
                      onClick={(e) => handleProxySettings(e, connection)}
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
                      id={`swarm-hooks-btn-${String(connection.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`}
                      onClick={(e) => handleHooksSettings(e, connection)}
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
                      {hookCountFor(connection) > 0 && (
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
                          {hookCountFor(connection)}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={(e) => handleTestConnection(e, connection)}
                      disabled={testing === connection.id}
                      style={{
                        ...secondaryButtonStyle,
                        padding: '6px 12px',
                        fontSize: 12,
                        opacity: testing === connection.id ? 0.5 : 1,
                      }}
                    >
                      {testing === connection.id ? '...' : 'Test'}
                    </button>
                    <button
                      onClick={(e) => handleConnect(e, connection)}
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

export default DockerSwarmConnectionsList;
