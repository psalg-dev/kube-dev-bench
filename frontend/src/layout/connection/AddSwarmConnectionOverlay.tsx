import { useState, useEffect } from 'react';
import { useConnectionsState, type SwarmConnectionEntry } from './ConnectionsStateContext';
import './AddSwarmConnectionOverlay.css';

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
      className="add-swarm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="add-swarm-dialog">
        <div className="add-swarm-header">
          <h2 className="add-swarm-title">🐳 Add Docker Connection</h2>
          <button
            onClick={onClose}
            className="add-swarm-close"
          >
            ✕
          </button>
        </div>

        <div className="add-swarm-content">
          {error && (
            <div className="add-swarm-alert">
              {error}
            </div>
          )}

          <div className="add-swarm-field">
            <label className="add-swarm-label" htmlFor="connectionName">
              Connection Name
            </label>
            <input
              id="connectionName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Remote Docker Host"
              className="add-swarm-input"
            />
          </div>

          <div className="add-swarm-field">
            <label className="add-swarm-label">Connection Type</label>
            <div
              className={`add-swarm-radio${connectionType === 'local' ? ' is-active' : ''}`}
              onClick={() => setConnectionType('local')}
            >
              <input type="radio" checked={connectionType === 'local'} onChange={() => setConnectionType('local')} />
              <div>
                <div className="add-swarm-radio-title">Local Socket</div>
                <div className="add-swarm-radio-desc">
                  Connect to Docker on this machine
                </div>
              </div>
            </div>
            <div
              className={`add-swarm-radio${connectionType === 'tcp' ? ' is-active' : ''}`}
              onClick={() => setConnectionType('tcp')}
            >
              <input type="radio" checked={connectionType === 'tcp'} onChange={() => setConnectionType('tcp')} />
              <div>
                <div className="add-swarm-radio-title">TCP (Unencrypted)</div>
                <div className="add-swarm-radio-desc">
                  Connect over TCP without encryption
                </div>
              </div>
            </div>
            <div
              className={`add-swarm-radio${connectionType === 'tls' ? ' is-active' : ''}`}
              onClick={() => setConnectionType('tls')}
            >
              <input type="radio" checked={connectionType === 'tls'} onChange={() => setConnectionType('tls')} />
              <div>
                <div className="add-swarm-radio-title">TCP with TLS</div>
                <div className="add-swarm-radio-desc">
                  Secure connection with certificates
                </div>
              </div>
            </div>
          </div>

          <div className="add-swarm-field">
            <label className="add-swarm-label" htmlFor="dockerHost">
              Docker Host
            </label>
            <input
              id="dockerHost"
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="tcp://host:port or unix:///path/to/socket"
              className="add-swarm-input"
            />
          </div>

          {connectionType === 'tls' && (
            <>
              <div className="add-swarm-field">
                <label className="add-swarm-label" htmlFor="tlsCert">
                  Client Certificate (PEM)
                </label>
                <textarea
                  id="tlsCert"
                  value={tlsCert}
                  onChange={(e) => setTlsCert(e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----\n..."
                  className="add-swarm-textarea"
                />
              </div>
              <div className="add-swarm-field">
                <label className="add-swarm-label" htmlFor="tlsKey">
                  Client Key (PEM)
                </label>
                <textarea
                  id="tlsKey"
                  value={tlsKey}
                  onChange={(e) => setTlsKey(e.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY-----\n..."
                  className="add-swarm-textarea"
                />
              </div>
              <div className="add-swarm-field">
                <label className="add-swarm-label" htmlFor="tlsCA">
                  CA Certificate (PEM)
                </label>
                <textarea
                  id="tlsCA"
                  value={tlsCA}
                  onChange={(e) => setTlsCA(e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----\n..."
                  className="add-swarm-textarea"
                />
              </div>
              <div className="add-swarm-field">
                <label className="add-swarm-checkbox">
                  <input type="checkbox" checked={tlsVerify} onChange={(e) => setTlsVerify(e.target.checked)} />
                  <span className="add-swarm-checkbox-text">Verify server certificate</span>
                </label>
              </div>
            </>
          )}

          {testResult && (
            <div
              className={`add-swarm-test-result${testResult.connected ? ' is-success' : ' is-error'}`}
            >
              {testResult.connected
                ? `✓ Connection successful${testResult.serverVersion ? ` - Docker ${testResult.serverVersion}` : ''}${testResult.swarmActive ? ' (Swarm active)' : ''}`
                : `✗ ${testResult.error || 'Connection failed'}`}
            </div>
          )}
        </div>

        <div className="add-swarm-footer">
          <button className="add-swarm-button add-swarm-button--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`add-swarm-button add-swarm-button--secondary${testing ? ' is-loading' : ''}`}
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            className={`add-swarm-button add-swarm-button--primary${!name.trim() ? ' is-disabled' : ''}`}
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
