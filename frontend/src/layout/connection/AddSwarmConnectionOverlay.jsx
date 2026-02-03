import { useState, useEffect } from 'react';
import { useConnectionsState } from './ConnectionsStateContext.jsx';
import { BaseModal, ModalButton, ModalPrimaryButton } from '../../components/BaseModal';

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  backgroundColor: 'var(--gh-input-bg, #0d1117)',
  border: '1px solid var(--gh-border, #30363d)',
  color: 'var(--gh-text, #c9d1d9)',
  fontSize: 14,
  boxSizing: 'border-box',
};

const textareaStyle = {
  ...inputStyle,
  minHeight: '120px',
  fontFamily: 'Courier New, monospace',
  fontSize: 12,
  resize: 'vertical',
};

const labelStyle = {
  display: 'block',
  marginBottom: 6,
  color: 'var(--gh-text, #fff)',
  fontWeight: 500,
};

const radioGroupStyle = {
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


function AddSwarmConnectionOverlay({ onClose, onSuccess }) {
  const { actions } = useConnectionsState();
  const [name, setName] = useState('');
  const [connectionType, setConnectionType] = useState('local'); // 'local', 'tcp', 'tls'
  const [host, setHost] = useState('');
  const [tlsCert, setTlsCert] = useState('');
  const [tlsKey, setTlsKey] = useState('');
  const [tlsCA, setTlsCA] = useState('');
  const [tlsVerify, setTlsVerify] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState('');

  // Set default host based on connection type
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
    } catch (err) {
      setError(err.toString());
      setTestResult({ connected: false, error: err.toString() });
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title="🐳 Add Docker Connection"
      width={600}
      className="add-swarm-overlay"
      footer={
        <>
          <ModalButton onClick={onClose}>Cancel</ModalButton>
          <ModalButton onClick={handleTest} disabled={testing}>
            {testing ? 'Testing...' : 'Test Connection'}
          </ModalButton>
          <ModalPrimaryButton onClick={handleSave} disabled={!name.trim()}>
            Save
          </ModalPrimaryButton>
        </>
      }
    >
      <div style={{ padding: 8, overflowY: 'auto' }}>
          {/* Error display */}
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

          {/* Connection name */}
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

          {/* Connection type */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Connection Type</label>
            <div
              style={{
                ...radioGroupStyle,
                borderColor: connectionType === 'local' ? '#238636' : 'var(--gh-border, #30363d)',
              }}
              onClick={() => setConnectionType('local')}
            >
              <input
                type="radio"
                checked={connectionType === 'local'}
                onChange={() => setConnectionType('local')}
              />
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
              <input
                type="radio"
                checked={connectionType === 'tcp'}
                onChange={() => setConnectionType('tcp')}
              />
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
              <input
                type="radio"
                checked={connectionType === 'tls'}
                onChange={() => setConnectionType('tls')}
              />
              <div>
                <div style={{ fontWeight: 500, color: 'var(--gh-text, #fff)' }}>TCP with TLS</div>
                <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
                  Secure connection with certificates
                </div>
              </div>
            </div>
          </div>

          {/* Host input */}
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

          {/* TLS options */}
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
                  <input
                    type="checkbox"
                    checked={tlsVerify}
                    onChange={(e) => setTlsVerify(e.target.checked)}
                  />
                  <span style={{ color: 'var(--gh-text, #fff)' }}>Verify server certificate</span>
                </label>
              </div>
            </>
          )}

          {/* Test result */}
          {testResult && (
            <div
              style={{
                padding: '12px',
                borderRadius: 4,
                marginBottom: 16,
                background: testResult.connected
                  ? 'rgba(46, 164, 79, 0.1)'
                  : 'rgba(248, 81, 73, 0.1)',
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
    </BaseModal>
  );
}

export default AddSwarmConnectionOverlay;
