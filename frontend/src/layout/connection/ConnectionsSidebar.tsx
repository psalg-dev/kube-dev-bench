import { useState } from 'react';
import { useConnectionsState, type PinnedConnection, type SelectedSection } from './ConnectionsStateContext';

type SidebarSection = {
  key: SelectedSection;
  label: string;
  icon: string;
  count: number;
};

type ConnectionsSidebarProps = {
  onConnect?: () => void;
};

const sidebarItemStyle: React.CSSProperties = {
  padding: '8px 16px',
  cursor: 'pointer',
  color: 'var(--gh-table-header-text, #fff)',
  fontSize: 15,
  margin: 0,
  borderRadius: 4,
  transition: 'background 0.15s',
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  justifyContent: 'space-between',
};

const selectedStyle: React.CSSProperties = {
  ...sidebarItemStyle,
  background: 'rgba(56, 139, 253, 0.08)',
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gh-text-secondary, #ccc)' }}>Connections</span>
      </div>

      <div style={{ flex: 1 }}>
        {sections.map((sec) => {
          const isSelected = selectedSection === sec.key;
          return (
            <div
              key={sec.key}
              id={`connection-section-${sec.key}`}
              className={`sidebar-section${isSelected ? ' selected' : ''}`}
              style={isSelected ? selectedStyle : sidebarItemStyle}
              onClick={() => actions.selectSection(sec.key)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{sec.icon}</span>
                <span>{sec.label}</span>
              </span>
              <span
                style={{
                  minWidth: '2em',
                  textAlign: 'right',
                  color: sec.count > 0 ? '#8ecfff' : '#9aa0a6',
                  fontWeight: 700,
                }}
              >
                {sec.count}
              </span>
            </div>
          );
        })}

        {pinnedConnections.length > 0 && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid var(--gh-border, #30363d)', margin: '16px 0' }} />
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gh-text-muted, #8b949e)' }}>PINNED</span>
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
                  className={`sidebar-section${isSelected ? ' selected' : ''}`}
                  style={{
                    ...(isSelected ? selectedStyle : sidebarItemStyle),
                    opacity: isConnecting ? 0.6 : 1,
                  }}
                  onClick={handlePinnedClick}
                  title={isConnecting ? 'Connecting...' : `Click to connect to ${conn.name}`}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{conn.type === 'kubernetes' ? '☸️' : '🐳'}</span>
                    <span style={{ fontSize: 13 }}>{isConnecting ? 'Connecting...' : conn.name}</span>
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--gh-text-muted, #8b949e)' }}>📌</span>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--gh-border, #30363d)' }}>
        <button
          id="global-proxy-settings-btn"
          onClick={() => actions.showProxySettings(true)}
          style={{
            width: '100%',
            padding: '8px 16px',
            background: 'transparent',
            border: '1px solid var(--gh-border, #444)',
            color: 'var(--gh-text-secondary, #ccc)',
            borderRadius: 0,
            cursor: 'pointer',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span>🌐</span>
          <span>Proxy Settings</span>
        </button>
      </div>
    </div>
  );
}

export default ConnectionsSidebar;
