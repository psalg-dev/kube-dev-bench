import { useState, useEffect } from 'react';
import { useConnectionsState, type SwarmConnectionEntry } from './ConnectionsStateContext';

type AddSwarmConnectionOverlayProps = {
  onClose: () => void;
  onSuccess: (connection: SwarmConnectionEntry) => void;
};

type TestResult = {
  connected?: boolean;
  error?: string;
  serverVersion?: string;
  swarmActive?: boolean;
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'rgba(0, 0, 0, 0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const dialogStyle: React.CSSProperties = {
  background: 'var(--gh-sidebar-bg, #1a1a1a)',
  border: '1px solid var(--gh-border, #444)',
  borderRadius: 0,
  maxWidth: '600px',
  width: '90%',
  maxHeight: '80vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle: React.CSSProperties = {
  padding: '24px',
  borderBottom: '1px solid var(--gh-border, #444)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const contentStyle: React.CSSProperties = {
  padding: '24px',
  overflowY: 'auto',
  flex: 1,
};

const footerStyle: React.CSSProperties = {
  padding: '16px 24px',
  borderTop: '1px solid var(--gh-border, #444)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  backgroundColor: 'var(--gh-input-bg, #0d1117)',
  border: '1px solid var(--gh-border, #30363d)',
  color: 'var(--gh-text, #c9d1d9)',
  fontSize: 14,
  boxSizing: 'border-box',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: '120px',
  fontFamily: 'Courier New, monospace',
  fontSize: 12,
  resize: 'vertical',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  color: 'var(--gh-text, #fff)',
  fontWeight: 500,
};

const radioGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  backgroundColor: 'var(--gh-card-bg, #161b22)',
  border: '1px solid var(--gh-border, #30363d)',
  borderRadius: 6,
  cursor: 'pointer',
  marginBottom: 8,
};

const buttonStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: 0,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'var(--gh-accent, #0969da)',
  color: '#fff',
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'var(--gh-button-secondary-bg, #444)',
  color: 'var(--gh-text, #fff)',
  border: '1px solid var(--gh-border, #555)',
};

function AddSwarmConnectionOverlay({ onClose, onSuccess }: AddSwarmConnectionOverlayProps) {
  const { actions } = useConnectionsState();
  const [name, setName] = useState('');
  const [connectionType, setConnectionType] = useState<'local' | 'tcp' | 'tls'>('local');
  const [host, setHost] = useState('');
  const [tlsCert, setTlsCert] = useState('');
  const [tlsKey, setTlsKey] = useState('');
  const [tlsCA, setTlsCA] = useState('');
  const [tlsVerify, setTlsVerify] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (connectionType === 'local') {
      const isWindows = navigator.platform?.toLowerCase().includes('win');
      setHost(isWindows ? 'npipe:////./pipe/docker_engine' : 'unix:///var/run/docker.sock');
    } else if (connectionType === 'tcp') {
      setHost('tcp://localhost:2375');
    } else if (connectionType === 'tls') {
      setHost('tcp://localhost:2376');
    }
  }, [connectionType]);

  const handleTest = async () => {
    setTesting(true);
    setError('');
    setTestResult(null);

    try {
      const config = {
        host,
        tlsEnabled: connectionType === 'tls',
        tlsCert: connectionType === 'tls' ? tlsCert : '',
        tlsKey: connectionType === 'tls' ? tlsKey : '',
        tlsCA: connectionType === 'tls' ? tlsCA : '',
        tlsVerify: connectionType === 'tls' ? tlsVerify : false,
      };
      const result = await actions.testSwarmConnection(config);
      setTestResult(result);
      if (!result.connected) {
        setError(result.error || 'Connection failed');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setTestResult({ connected: false, error: message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      setError('Please provide a name for the connection');
      return;
    }

    const connection = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      host,
      tlsEnabled: connectionType === 'tls',
      tlsCert: connectionType === 'tls' ? tlsCert : '',
      tlsKey: connectionType === 'tls' ? tlsKey : '',
      tlsCA: connectionType === 'tls' ? tlsCA : '',
      tlsVerify: connectionType === 'tls' ? tlsVerify : false,
      connected: false,
      serverVersion: testResult?.serverVersion || '',
      swarmActive: testResult?.swarmActive || false,
    };

    onSuccess(connection);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      style={overlayStyle}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
      className="add-swarm-overlay"
    >
      <div style={dialogStyle}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0, color: 'var(--gh-text, #fff)', fontSize: 20 }}>🐳 Add Docker Connection</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--gh-text-secondary, #ccc)',
              fontSize: 20,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div style={contentStyle}>
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

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="connectionName">
              Connection Name
            </label>
            <input
              id="connectionName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Remote Docker Host"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Connection Type</label>
            <div
              style={{
                ...radioGroupStyle,
                borderColor: connectionType === 'local' ? '#238636' : 'var(--gh-border, #30363d)',
              }}
              onClick={() => setConnectionType('local')}
            >
              <input type="radio" checked={connectionType === 'local'} onChange={() => setConnectionType('local')} />
              <div>
                <div style={{ fontWeight: 500, color: 'var(--gh-text, #fff)' }}>Local Socket</div>
                <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
                  Connect to Docker on this machine
                </div>
              </div>
            </div>
            <div
              style={{
                ...radioGroupStyle,
                borderColor: connectionType === 'tcp' ? '#238636' : 'var(--gh-border, #30363d)',
              }}
              onClick={() => setConnectionType('tcp')}
            >
              <input type="radio" checked={connectionType === 'tcp'} onChange={() => setConnectionType('tcp')} />
              <div>
                <div style={{ fontWeight: 500, color: 'var(--gh-text, #fff)' }}>TCP (Unencrypted)</div>
                <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
                  Connect over TCP without encryption
                </div>
              </div>
            </div>
            <div
              style={{
                ...radioGroupStyle,
                borderColor: connectionType === 'tls' ? '#238636' : 'var(--gh-border, #30363d)',
              }}
              onClick={() => setConnectionType('tls')}
            >
              <input type="radio" checked={connectionType === 'tls'} onChange={() => setConnectionType('tls')} />
              <div>
                <div style={{ fontWeight: 500, color: 'var(--gh-text, #fff)' }}>TCP with TLS</div>
                <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
                  Secure connection with certificates
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="dockerHost">
              Docker Host
            </label>
            <input
              id="dockerHost"
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="tcp://host:port or unix:///path/to/socket"
              style={inputStyle}
            />
          </div>

          {connectionType === 'tls' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="tlsCert">
                  Client Certificate (PEM)
                </label>
                <textarea
                  id="tlsCert"
                  value={tlsCert}
                  onChange={(e) => setTlsCert(e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----\n..."
                  style={textareaStyle}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="tlsKey">
                  Client Key (PEM)
                </label>
                <textarea
                  id="tlsKey"
                  value={tlsKey}
                  onChange={(e) => setTlsKey(e.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY-----\n..."
                  style={textareaStyle}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="tlsCA">
                  CA Certificate (PEM)
                </label>
                <textarea
                  id="tlsCA"
                  value={tlsCA}
                  onChange={(e) => setTlsCA(e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----\n..."
                  style={textareaStyle}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={tlsVerify} onChange={(e) => setTlsVerify(e.target.checked)} />
                  <span style={{ color: 'var(--gh-text, #fff)' }}>Verify server certificate</span>
                </label>
              </div>
            </>
          )}

          {testResult && (
            <div
              style={{
                padding: '12px',
                borderRadius: 4,
                marginBottom: 16,
                background: testResult.connected ? 'rgba(46, 164, 79, 0.1)' : 'rgba(248, 81, 73, 0.1)',
                border: `1px solid ${testResult.connected ? '#2ea44f' : '#f85149'}`,
                color: testResult.connected ? '#2ea44f' : '#f85149',
              }}
            >
              {testResult.connected
                ? `✓ Connection successful${testResult.serverVersion ? ` - Docker ${testResult.serverVersion}` : ''}${testResult.swarmActive ? ' (Swarm active)' : ''}`
                : `✗ ${testResult.error || 'Connection failed'}`}
            </div>
          )}
        </div>

        <div style={footerStyle}>
          <button style={secondaryButtonStyle} onClick={onClose}>
            Cancel
          </button>
          <button
            style={{
              ...secondaryButtonStyle,
              opacity: testing ? 0.5 : 1,
            }}
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            style={{
              ...primaryButtonStyle,
              opacity: !name.trim() ? 0.5 : 1,
              cursor: !name.trim() ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSave}
            disabled={!name.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddSwarmConnectionOverlay;
