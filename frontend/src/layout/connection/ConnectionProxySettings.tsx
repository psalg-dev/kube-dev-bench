import { useState, useEffect } from 'react';
import { useConnectionsState, type ProxyConfig } from './ConnectionsStateContext';
import './ConnectionProxySettings.css';

type ConnectionProxySettingsProps = {
  onClose: () => void;
};

type SystemProxyConfig = {
  HTTP_PROXY?: string;
  HTTPS_PROXY?: string;
  NO_PROXY?: string;
};

function ConnectionProxySettings({ onClose }: ConnectionProxySettingsProps) {
  const { proxyConfig, systemProxy, editingConnectionProxy, loading, error, actions } = useConnectionsState();

  const [authType, setAuthType] = useState<ProxyConfig['authType']>(proxyConfig.authType || 'none');
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const title = editingConnectionProxy
    ? `🌐 Proxy Settings - ${editingConnectionProxy.path || editingConnectionProxy.name}`
    : '🌐 Global Proxy Settings';

  return (
    <div
      className="proxy-settings-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="proxy-settings-dialog">
        <div className="proxy-settings-header">
          <h2 className="proxy-settings-title">{title}</h2>
          <button
            onClick={onClose}
            className="proxy-settings-close"
          >
            ✕
          </button>
        </div>

        <div className="proxy-settings-content">
          {(error || localError) && (
            <div className="proxy-settings-alert">
              {localError || error}
            </div>
          )}

          <p className="proxy-settings-description">
            Configure HTTP/HTTPS proxy for API connections.
          </p>

          <div className="proxy-settings-section">
            <label className="proxy-settings-label">Proxy Mode</label>
            <div
              className={`proxy-settings-radio${authType === 'none' ? ' is-active' : ''}`}
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
                <div className="proxy-settings-radio-title">No Proxy</div>
                <div className="proxy-settings-radio-description">
                  Connect directly without a proxy
                </div>
              </div>
            </div>
            <div
              className={`proxy-settings-radio${authType === 'system' ? ' is-active' : ''}`}
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
                <div className="proxy-settings-radio-title">Use System Proxy</div>
                <div className="proxy-settings-radio-description">
                  Use proxy settings from environment
                </div>
              </div>
            </div>
            <div
              className={`proxy-settings-radio${authType === 'basic' ? ' is-active' : ''}`}
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
                <div className="proxy-settings-radio-title">Manual Configuration</div>
                <div className="proxy-settings-radio-description">
                  Specify proxy URL and credentials
                </div>
              </div>
            </div>
          </div>

          {authType === 'system' && (
            <div className="proxy-settings-system">
              <label className="proxy-settings-label proxy-settings-label--spaced">Detected System Proxy:</label>
              <div className="proxy-settings-system-values">
                <div>HTTP_PROXY: {(systemProxy as SystemProxyConfig).HTTP_PROXY || '(not set)'}</div>
                <div>HTTPS_PROXY: {(systemProxy as SystemProxyConfig).HTTPS_PROXY || '(not set)'}</div>
                <div>NO_PROXY: {(systemProxy as SystemProxyConfig).NO_PROXY || '(not set)'}</div>
              </div>
            </div>
          )}

          {authType === 'basic' && (
            <>
              <div className="proxy-settings-field">
                <label className="proxy-settings-label" htmlFor="proxyURL">
                  Proxy URL
                </label>
                <input
                  id="proxyURL"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http://proxy.example.com:8080"
                  className="proxy-settings-input"
                />
              </div>
              <div className="proxy-settings-field">
                <label className="proxy-settings-label" htmlFor="proxyUsername">
                  Username (optional)
                </label>
                <input
                  id="proxyUsername"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  className="proxy-settings-input"
                />
              </div>
              <div className="proxy-settings-field">
                <label className="proxy-settings-label" htmlFor="proxyPassword">
                  Password (optional)
                </label>
                <input
                  id="proxyPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="proxy-settings-input"
                />
              </div>
            </>
          )}
        </div>

        <div className="proxy-settings-footer">
          <button className="proxy-settings-button proxy-settings-button--secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            id="save-proxy-btn"
            className="proxy-settings-button proxy-settings-button--primary"
            onClick={handleSave}
            disabled={loading || (authType === 'basic' && !url.trim())}
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConnectionProxySettings;
