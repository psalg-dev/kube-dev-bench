import React, { useState, useEffect } from 'react';
import { useSwarmState } from './SwarmStateContext';

const SwarmConnectionWizard = ({ onComplete }) => {
  const { actions, config: savedConfig, loading } = useSwarmState();
  const [step, setStep] = useState(1);
  const [connectionType, setConnectionType] = useState('local'); // 'local', 'tcp', 'tls'
  const [host, setHost] = useState('');
  const [tlsEnabled, setTlsEnabled] = useState(false);
  const [tlsCert, setTlsCert] = useState('');
  const [tlsKey, setTlsKey] = useState('');
  const [tlsCA, setTlsCA] = useState('');
  const [tlsVerify, setTlsVerify] = useState(true);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  // Detect platform and set default host
  useEffect(() => {
    const isWindows = navigator.platform.toLowerCase().includes('win');
    const defaultHost = isWindows ? 'npipe:////./pipe/docker_engine' : 'unix:///var/run/docker.sock';
    setHost(defaultHost);

    // Load saved config if available
    if (savedConfig) {
      setHost(savedConfig.host || defaultHost);
      setTlsEnabled(savedConfig.tlsEnabled || false);
      setTlsCert(savedConfig.tlsCert || '');
      setTlsKey(savedConfig.tlsKey || '');
      setTlsCA(savedConfig.tlsCA || '');
      setTlsVerify(savedConfig.tlsVerify !== false);

      if (savedConfig.tlsEnabled) {
        setConnectionType('tls');
      } else if (savedConfig.host && savedConfig.host.startsWith('tcp://')) {
        setConnectionType('tcp');
      }
    }
  }, [savedConfig]);

  const handleConnectionTypeChange = (type) => {
    setConnectionType(type);
    setTestResult(null);
    setError('');

    if (type === 'local') {
      const isWindows = navigator.platform.toLowerCase().includes('win');
      setHost(isWindows ? 'npipe:////./pipe/docker_engine' : 'unix:///var/run/docker.sock');
      setTlsEnabled(false);
    } else if (type === 'tcp') {
      setHost('tcp://localhost:2375');
      setTlsEnabled(false);
    } else if (type === 'tls') {
      setHost('tcp://localhost:2376');
      setTlsEnabled(true);
    }
  };

  const buildConfig = () => ({
    host,
    tlsEnabled,
    tlsCert: tlsEnabled ? tlsCert : '',
    tlsKey: tlsEnabled ? tlsKey : '',
    tlsCA: tlsEnabled ? tlsCA : '',
    tlsVerify: tlsEnabled ? tlsVerify : false,
  });

  const handleTest = async () => {
    setTesting(true);
    setError('');
    setTestResult(null);

    try {
      const config = buildConfig();
      const result = await actions.testConnection(config);
      setTestResult(result);
      if (!result.connected) {
        setError(result.error || 'Failed to connect');
      }
    } catch (err) {
      setError(err.toString());
      setTestResult({ connected: false, error: err.toString() });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    setError('');
    try {
      const config = buildConfig();
      const result = await actions.connect(config);
      if (result?.connected) {
        onComplete?.();
      } else {
        setError(result?.error || 'Failed to connect');
      }
    } catch (err) {
      setError(err.toString());
    }
  };

  const handleSkip = () => {
    actions.closeWizard();
    onComplete?.();
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: 'var(--gh-input-bg, #0d1117)',
    border: '1px solid var(--gh-border, #30363d)',
    borderRadius: 6,
    color: 'var(--gh-text, #c9d1d9)',
    fontSize: 14,
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: 6,
    color: 'var(--gh-text-secondary, #8b949e)',
    fontSize: 13,
  };

  const buttonStyle = {
    padding: '10px 20px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: 'var(--gh-button-primary-bg, #238636)',
    color: '#fff',
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: 'var(--gh-button-bg, #21262d)',
    color: 'var(--gh-text, #c9d1d9)',
    border: '1px solid var(--gh-border, #30363d)',
  };

  const radioStyle = {
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

  const renderConnectionTypeSelector = () => (
    <div style={{ marginBottom: 24 }}>
      <label style={labelStyle}>Connection Type</label>
      <div
        style={{ ...radioStyle, borderColor: connectionType === 'local' ? '#238636' : undefined }}
        onClick={() => handleConnectionTypeChange('local')}
      >
        <input
          type="radio"
          checked={connectionType === 'local'}
          onChange={() => handleConnectionTypeChange('local')}
        />
        <div>
          <div style={{ fontWeight: 500 }}>Local Socket</div>
          <div style={{ fontSize: 12, color: 'var(--gh-text-secondary)' }}>
            Connect to Docker on this machine (default)
          </div>
        </div>
      </div>
      <div
        style={{ ...radioStyle, borderColor: connectionType === 'tcp' ? '#238636' : undefined }}
        onClick={() => handleConnectionTypeChange('tcp')}
      >
        <input
          type="radio"
          checked={connectionType === 'tcp'}
          onChange={() => handleConnectionTypeChange('tcp')}
        />
        <div>
          <div style={{ fontWeight: 500 }}>TCP (Unencrypted)</div>
          <div style={{ fontSize: 12, color: 'var(--gh-text-secondary)' }}>
            Connect to a remote Docker host over TCP
          </div>
        </div>
      </div>
      <div
        style={{ ...radioStyle, borderColor: connectionType === 'tls' ? '#238636' : undefined }}
        onClick={() => handleConnectionTypeChange('tls')}
      >
        <input
          type="radio"
          checked={connectionType === 'tls'}
          onChange={() => handleConnectionTypeChange('tls')}
        />
        <div>
          <div style={{ fontWeight: 500 }}>TCP with TLS</div>
          <div style={{ fontSize: 12, color: 'var(--gh-text-secondary)' }}>
            Connect to a remote Docker host with TLS encryption
          </div>
        </div>
      </div>
    </div>
  );

  const renderHostInput = () => (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>Docker Host</label>
      <input
        type="text"
        value={host}
        onChange={(e) => setHost(e.target.value)}
        style={inputStyle}
        placeholder={connectionType === 'local' ? 'unix:///var/run/docker.sock' : 'tcp://hostname:port'}
      />
      <div style={{ fontSize: 12, color: 'var(--gh-text-secondary)', marginTop: 4 }}>
        {connectionType === 'local' && 'Path to Docker socket'}
        {connectionType === 'tcp' && 'Format: tcp://hostname:2375'}
        {connectionType === 'tls' && 'Format: tcp://hostname:2376'}
      </div>
    </div>
  );

  const renderTLSOptions = () => {
    if (!tlsEnabled) return null;

    return (
      <div style={{ marginTop: 16, padding: 16, backgroundColor: 'var(--gh-card-bg)', borderRadius: 6 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>CA Certificate Path</label>
          <input
            type="text"
            value={tlsCA}
            onChange={(e) => setTlsCA(e.target.value)}
            style={inputStyle}
            placeholder="/path/to/ca.pem"
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Client Certificate Path</label>
          <input
            type="text"
            value={tlsCert}
            onChange={(e) => setTlsCert(e.target.value)}
            style={inputStyle}
            placeholder="/path/to/cert.pem"
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Client Key Path</label>
          <input
            type="text"
            value={tlsKey}
            onChange={(e) => setTlsKey(e.target.value)}
            style={inputStyle}
            placeholder="/path/to/key.pem"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            id="tls-verify"
            checked={tlsVerify}
            onChange={(e) => setTlsVerify(e.target.checked)}
          />
          <label htmlFor="tls-verify" style={{ color: 'var(--gh-text)' }}>
            Verify TLS certificates
          </label>
        </div>
      </div>
    );
  };

  const renderTestResult = () => {
    if (!testResult) return null;

    const isSuccess = testResult.connected;
    const bgColor = isSuccess ? 'rgba(35, 134, 54, 0.15)' : 'rgba(215, 58, 73, 0.15)';
    const borderColor = isSuccess ? '#238636' : '#d73a49';
    const textColor = isSuccess ? '#3fb950' : '#f85149';

    return (
      <div
        style={{
          padding: 16,
          backgroundColor: bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: 6,
          marginTop: 16,
        }}
      >
        <div style={{ fontWeight: 500, color: textColor, marginBottom: 8 }}>
          {isSuccess ? '✓ Connection Successful' : '✗ Connection Failed'}
        </div>
        {isSuccess && (
          <div style={{ fontSize: 13, color: 'var(--gh-text-secondary)' }}>
            <div>Docker Version: {testResult.serverVersion}</div>
            <div>Swarm Active: {testResult.swarmActive ? 'Yes' : 'No'}</div>
            {testResult.swarmActive && (
              <>
                <div>Manager Node: {testResult.isManager ? 'Yes' : 'No'}</div>
                {testResult.nodeId && <div>Node ID: {testResult.nodeId.substring(0, 12)}...</div>}
              </>
            )}
          </div>
        )}
        {!isSuccess && testResult.error && (
          <div style={{ fontSize: 13, color: '#f85149' }}>{testResult.error}</div>
        )}
      </div>
    );
  };

  return (
    <div
      className="swarm-connection-wizard-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--gh-bg, #0d1117)',
          borderRadius: 12,
          width: 560,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--gh-border, #30363d)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: '#2496ed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            🐳
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: 'var(--gh-text)' }}>Connect to Docker</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--gh-text-secondary)' }}>
              Configure Docker Swarm connection
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          {renderConnectionTypeSelector()}
          {renderHostInput()}
          {renderTLSOptions()}

          {error && (
            <div
              style={{
                padding: 12,
                backgroundColor: 'rgba(215, 58, 73, 0.15)',
                border: '1px solid #d73a49',
                borderRadius: 6,
                color: '#f85149',
                marginTop: 16,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {renderTestResult()}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--gh-border, #30363d)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <button style={secondaryButtonStyle} onClick={handleSkip}>
            Skip
          </button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              style={secondaryButtonStyle}
              onClick={handleTest}
              disabled={testing || loading}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              style={{
                ...primaryButtonStyle,
                opacity: testing || loading ? 0.6 : 1,
              }}
              onClick={handleConnect}
              disabled={testing || loading}
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwarmConnectionWizard;
