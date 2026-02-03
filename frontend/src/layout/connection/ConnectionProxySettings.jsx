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


function ConnectionProxySettings({ onClose }) {
  const { proxyConfig, systemProxy, editingConnectionProxy, loading, error, actions } = useConnectionsState();

  const [authType, setAuthType] = useState(proxyConfig.authType || 'none');
  const [url, setUrl] = useState(proxyConfig.url || '');
  const [username, setUsername] = useState(proxyConfig.username || '');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setAuthType(proxyConfig.authType || 'none');
    setUrl(proxyConfig.url || '');
    setUsername(proxyConfig.username || '');
  }, [proxyConfig]);

  const handleSave = async () => {
    setLocalError('');

    if (authType === 'basic' && !url.trim()) {
      setLocalError('Please provide a proxy URL');
      return;
    }

    const success = await actions.saveProxyConfig({
      authType,
      url: authType === 'system' ? '' : url,
      username: authType === 'basic' ? username : '',
      password: authType === 'basic' ? password : '',
    });

    if (success) {
      onClose();
    }
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

  const title = editingConnectionProxy
    ? `🌐 Proxy Settings - ${editingConnectionProxy.path || editingConnectionProxy.name}`
    : '🌐 Global Proxy Settings';

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={title}
      width={500}
      className="proxy-settings-overlay"
      footer={
        <>
          <ModalButton onClick={onClose} disabled={loading}>
            Cancel
          </ModalButton>
          <ModalPrimaryButton
            id="save-proxy-btn"
            onClick={handleSave}
            disabled={loading || (authType === 'basic' && !url.trim())}
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </ModalPrimaryButton>
        </>
      }
    >
      <div style={{ padding: 8, overflowY: 'auto' }}>
          {/* Error display */}
          {(error || localError) && (
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
              {localError || error}
            </div>
          )}

          <p style={{ margin: '0 0 20px', color: 'var(--gh-text-secondary, #ccc)', fontSize: 14 }}>
            Configure HTTP/HTTPS proxy for API connections.
          </p>

          {/* Proxy mode selection */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Proxy Mode</label>
            <div
              style={{
                ...radioGroupStyle,
                borderColor: authType === 'none' ? '#238636' : 'var(--gh-border, #30363d)',
              }}
              onClick={() => setAuthType('none')}
            >
              <input
                type="radio"
                name="proxyAuthType"
                value="none"
                checked={authType === 'none'}
                onChange={() => setAuthType('none')}
              />
              <div>
                <div style={{ fontWeight: 500, color: 'var(--gh-text, #fff)' }}>No Proxy</div>
                <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
                  Connect directly without a proxy
                </div>
              </div>
            </div>
            <div
              style={{
                ...radioGroupStyle,
                borderColor: authType === 'system' ? '#238636' : 'var(--gh-border, #30363d)',
              }}
              onClick={() => setAuthType('system')}
            >
              <input
                type="radio"
                name="proxyAuthType"
                value="system"
                checked={authType === 'system'}
                onChange={() => setAuthType('system')}
              />
              <div>
                <div style={{ fontWeight: 500, color: 'var(--gh-text, #fff)' }}>Use System Proxy</div>
                <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
                  Use proxy settings from environment
                </div>
              </div>
            </div>
            <div
              style={{
                ...radioGroupStyle,
                borderColor: authType === 'basic' ? '#238636' : 'var(--gh-border, #30363d)',
              }}
              onClick={() => setAuthType('basic')}
            >
              <input
                type="radio"
                name="proxyAuthType"
                value="basic"
                checked={authType === 'basic'}
                onChange={() => setAuthType('basic')}
              />
              <div>
                <div style={{ fontWeight: 500, color: 'var(--gh-text, #fff)' }}>Manual Configuration</div>
                <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
                  Specify proxy URL and credentials
                </div>
              </div>
            </div>
          </div>

          {/* System proxy info */}
          {authType === 'system' && (
            <div
              style={{
                background: 'var(--bg-secondary, #21262d)',
                padding: '12px',
                borderRadius: 4,
                marginBottom: 16,
              }}
            >
              <label style={{ ...labelStyle, marginBottom: 8 }}>Detected System Proxy:</label>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--gh-text, #ccc)' }}>
                <div>HTTP_PROXY: {systemProxy.HTTP_PROXY || '(not set)'}</div>
                <div>HTTPS_PROXY: {systemProxy.HTTPS_PROXY || '(not set)'}</div>
                <div>NO_PROXY: {systemProxy.NO_PROXY || '(not set)'}</div>
              </div>
            </div>
          )}

          {/* Manual proxy config */}
          {authType === 'basic' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="proxyURL">
                  Proxy URL
                </label>
                <input
                  id="proxyURL"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http://proxy.example.com:8080"
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="proxyUsername">
                  Username (optional)
                </label>
                <input
                  id="proxyUsername"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="proxyPassword">
                  Password (optional)
                </label>
                <input
                  id="proxyPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </div>
            </>
          )}
      </div>
    </BaseModal>
  );
}

export default ConnectionProxySettings;
