import { useState } from 'react';
import { useConnectionsState, type PinnedConnection, type SelectedSection } from './ConnectionsStateContext';
import './ConnectionsSidebar.css';

type SidebarSection = {
  key: SelectedSection;
  label: string;
  icon: string;
  count: number;
};

type ConnectionsSidebarProps = {
  onConnect?: () => void;
};

function ConnectionsSidebar({ onConnect }: ConnectionsSidebarProps) {
  const { selectedSection, kubeConfigCount, swarmConnectionCount, pinnedConnections, actions } =
    useConnectionsState();

  const [connecting, setConnecting] = useState<string | null>(null);

  const sections: SidebarSection[] = [
    {
      key: 'kubernetes',
      label: 'Kubernetes',
      icon: '☸️',
      count: kubeConfigCount,
    },
    {
      key: 'docker-swarm',
      label: 'Docker Swarm',
      icon: '🐳',
      count: swarmConnectionCount,
    },
  ];

  return (
    <div className="connections-sidebar">
      <div className="connections-sidebar__title">
        <span>Connections</span>
      </div>

      <div className="connections-sidebar__sections">
        {sections.map((sec) => {
          const isSelected = selectedSection === sec.key;
          return (
            <div
              key={sec.key}
              id={`connection-section-${sec.key}`}
              className={`sidebar-section connections-sidebar__item${isSelected ? ' selected' : ''}`}
              onClick={() => actions.selectSection(sec.key)}
            >
              <span className="connections-sidebar__item-label">
                <span>{sec.icon}</span>
                <span>{sec.label}</span>
              </span>
              <span
                className={`connections-sidebar__count${sec.count > 0 ? ' is-active' : ''}`}
              >
                {sec.count}
              </span>
            </div>
          );
        })}

        {pinnedConnections.length > 0 && (
          <>
            <hr className="connections-sidebar__divider" />
            <div className="connections-sidebar__pinned-label">
              <span>PINNED</span>
            </div>
            {(pinnedConnections as PinnedConnection[]).map((conn) => {
              const isSelected = selectedSection === `pinned-${conn.type}-${conn.id}`;
              const connKey = `${conn.type}-${conn.id}`;
              const isConnecting = connecting === connKey;

              const handlePinnedClick = async () => {
                if (isConnecting) return;

                setConnecting(connKey);
                try {
                  if (conn.type === 'kubernetes') {
                    const config = { path: conn.path || conn.id, name: conn.name || conn.id, contexts: conn.contexts || [] };
                    const success = await actions.connectKubeConfig(config);
                    if (success && onConnect) {
                      onConnect();
                    }
                  } else if (conn.type === 'swarm') {
                    const connectConfig = {
                      host: conn.host || conn.id,
                      tlsEnabled: conn.tlsEnabled || false,
                      tlsCert: conn.tlsCert || '',
                      tlsKey: conn.tlsKey || '',
                      tlsCA: conn.tlsCA || '',
                      tlsVerify: conn.tlsVerify !== false,
                    };
                    const result = await actions.connectSwarm(connectConfig);
                    if (result?.connected && onConnect) {
                      onConnect();
                    } else if (!result?.connected) {
                      console.warn('Docker Swarm connection failed:', result?.error || 'Unknown error');
                    }
                  }
                } finally {
                  setConnecting(null);
                }
              };

              return (
                <div
                  key={connKey}
                  id={`pinned-connection-${conn.type}-${conn.id}`}
                  className={`sidebar-section connections-sidebar__item${isSelected ? ' selected' : ''}${isConnecting ? ' is-connecting' : ''}`}
                  onClick={handlePinnedClick}
                  title={isConnecting ? 'Connecting...' : `Click to connect to ${conn.name}`}
                >
                  <span className="connections-sidebar__item-label">
                    <span>{conn.type === 'kubernetes' ? '☸️' : '🐳'}</span>
                    <span className="connections-sidebar__item-name">{isConnecting ? 'Connecting...' : conn.name}</span>
                  </span>
                  <span className="connections-sidebar__pinned-icon">📌</span>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="connections-sidebar__footer">
        <button
          id="global-proxy-settings-btn"
          onClick={() => actions.showProxySettings(true)}
          className="connections-sidebar__proxy-button"
        >
          <span>🌐</span>
          <span>Proxy Settings</span>
        </button>
      </div>
    </div>
  );
}

export default ConnectionsSidebar;
