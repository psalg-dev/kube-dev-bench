import { useState } from 'react';
import { useConnectionsState, type PinnedConnection, type SwarmConnectionEntry } from './ConnectionsStateContext';
import type { docker } from '../../../wailsjs/go/models';
import './ConnectionsList.css';

type TestResult = docker.DockerConnectionStatus;

type HookEntry = {
  scope?: string;
  connectionType?: string;
  connectionId?: string;
};

type DockerSwarmConnectionsListProps = {
  onConnect?: () => void;
  filterConnection?: { id: string };
};

function DockerSwarmConnectionsList({ onConnect, filterConnection }: DockerSwarmConnectionsListProps) {
  const { swarmConnections, swarmDetecting, pinnedConnections, hooks, actions } = useConnectionsState();

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const displayConnections = filterConnection
    ? (swarmConnections as SwarmConnectionEntry[]).filter((c) => c.id === filterConnection.id)
    : (swarmConnections as SwarmConnectionEntry[]);

  const isPinned = (connection: SwarmConnectionEntry) => {
    return pinnedConnections.some((c: PinnedConnection) => c.type === 'swarm' && c.id === connection.id);
  };

  const handleTogglePin = (e: React.MouseEvent, connection: SwarmConnectionEntry) => {
    e.stopPropagation();
    actions.togglePin('swarm', connection.id, {
      name: connection.name,
      host: connection.host,
    });
  };

  const handleTestConnection = async (e: React.MouseEvent, connection: SwarmConnectionEntry) => {
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
    } catch (err: unknown) {
      setTestResults((prev) => ({
        ...prev,
        [connection.id]: {
          connected: false,
          swarmActive: false,
          nodeId: '',
          isManager: false,
          serverVersion: '',
          error: err?.toString?.() || String(err),
        },
      }));
    } finally {
      setTesting(null);
    }
  };

  const handleConnect = async (e: React.MouseEvent, connection: SwarmConnectionEntry) => {
    e.stopPropagation();
    setTesting(connection.id);
    try {
      const result = await actions.connectSwarm({
        host: connection.host,
        tlsEnabled: connection.tlsEnabled || false,
        tlsCert: connection.tlsCert || '',
        tlsKey: connection.tlsKey || '',
        tlsCA: connection.tlsCA || '',
        tlsVerify: connection.tlsVerify !== false,
      });
      setTestResults((prev) => ({
        ...prev,
        [connection.id]: {
          connected: result?.connected || false,
          swarmActive: result?.swarmActive || false,
          nodeId: result?.nodeId || '',
          isManager: result?.isManager || false,
          serverVersion: result?.serverVersion || '',
          error: result?.error || (result?.connected ? '' : 'Connection failed'),
        },
      }));
      if (result?.connected && onConnect) {
        onConnect();
      }
    } catch (err: unknown) {
      setTestResults((prev) => ({
        ...prev,
        [connection.id]: {
          connected: false,
          swarmActive: false,
          nodeId: '',
          isManager: false,
          serverVersion: '',
          error: err?.toString?.() || String(err),
        },
      }));
    } finally {
      setTesting(null);
    }
  };

  const handleProxySettings = (e: React.MouseEvent, connection: SwarmConnectionEntry) => {
    e.stopPropagation();
    actions.showProxySettings(true, { type: 'swarm', ...connection });
  };

  const handleHooksSettings = (e: React.MouseEvent, connection: SwarmConnectionEntry) => {
    e.stopPropagation();
    actions.showHooksSettings(true, { type: 'swarm', ...connection });
  };

  const hookCountFor = (connection: SwarmConnectionEntry) => {
    const id = connection.host || connection.id;
    const list = Array.isArray(hooks) ? (hooks as HookEntry[]) : [];
    return list.filter((h) => {
      const scope = h?.scope || 'global';
      if (scope === 'global') return true;
      return h?.scope === 'connection' && h?.connectionType === 'swarm' && h?.connectionId === id;
    }).length;
  };

  return (
    <div className="connections-list">
      <div className="connections-header">
        <div className="connections-header-text">
          <h2>🐳 Docker Swarm Connections</h2>
          <p>Connect to Docker hosts and manage Swarm clusters</p>
        </div>
        <div className="connections-header-actions">
          <button
            id="refresh-swarm-btn"
            className="connections-button secondary"
            onClick={() => actions.detectSwarmConnections()}
            disabled={swarmDetecting}
          >
            🔄 Refresh
          </button>
          <button
            id="add-swarm-btn"
            className="connections-button primary"
            onClick={() => actions.showAddSwarmOverlay(true)}
          >
            ➕ Add Connection
          </button>
        </div>
      </div>

      {swarmDetecting && <div className="connections-loading">Detecting Docker connections...</div>}

      {!swarmDetecting && displayConnections.length === 0 && (
        <div className="connections-empty">
          <div className="connections-empty-icon">🐳</div>
          <h3 className="connections-empty-title">No Docker Connections Found</h3>
          <p>Add a Docker host connection to manage containers and Swarm services</p>
          <button className="connections-button primary" onClick={() => actions.showAddSwarmOverlay(true)}>
            ➕ Add Connection
          </button>
        </div>
      )}

      {!swarmDetecting && displayConnections.length > 0 && (
        <div className="connections-card-list">
          {displayConnections.map((connection, index) => {
            const isHovered = hoveredIndex === index;
            const pinned = isPinned(connection);
            const testResult = testResults[connection.id];
            const isConnected = connection.connected || testResult?.connected;
            const cardClassName = [
              'connections-card',
              isConnected ? 'is-connected' : '',
              !isConnected && isHovered ? 'is-hovered' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div
                key={connection.id}
                className={cardClassName}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="connections-card-row">
                  <div className="connections-card-main">
                    <div className="connections-card-title">
                      {connection.name}
                      {pinned && <span>📌</span>}
                      {isConnected && (
                        <span className="connections-status-badge connections-status-connected">Connected</span>
                      )}
                      {connection.swarmActive && (
                        <span className="connections-status-badge connections-status-swarm">Swarm</span>
                      )}
                    </div>
                    <div className="connections-card-path">{connection.host}</div>
                    {connection.serverVersion && (
                      <div className="connections-card-meta">Docker {connection.serverVersion}</div>
                    )}
                    {testResult && (
                      <div className={`connections-test-result ${testResult.connected ? 'success' : 'error'}`}>
                        {testResult.connected
                          ? `✓ Connection successful${testResult.serverVersion ? ` (Docker ${testResult.serverVersion})` : ''}`
                          : `✗ ${testResult.error || 'Connection failed'}`}
                      </div>
                    )}
                  </div>
                  <div className="connections-card-actions">
                    <button
                      onClick={(e) => handleTogglePin(e, connection)}
                      className={`connections-icon-button${pinned ? ' pinned' : ''}`}
                      title={pinned ? 'Unpin' : 'Pin to sidebar'}
                    >
                      📌
                    </button>
                    <button
                      onClick={(e) => handleProxySettings(e, connection)}
                      className="connections-icon-button"
                      title="Proxy settings"
                    >
                      🌐
                    </button>

                    <button
                      id={`swarm-hooks-btn-${String(connection.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`}
                      onClick={(e) => handleHooksSettings(e, connection)}
                      className="connections-icon-button"
                      title="Hooks"
                    >
                      🪝
                      {hookCountFor(connection) > 0 && (
                        <span className="connections-badge">{hookCountFor(connection)}</span>
                      )}
                    </button>
                    <button
                      onClick={(e) => handleTestConnection(e, connection)}
                      disabled={testing === connection.id}
                      className={`connections-button secondary small${testing === connection.id ? ' dimmed' : ''}`}
                    >
                      {testing === connection.id ? '...' : 'Test'}
                    </button>
                    <button
                      onClick={(e) => handleConnect(e, connection)}
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

export default DockerSwarmConnectionsList;
