import { useState } from 'react';
import { useConnectionsState } from './ConnectionsStateContext';

type AddKubeConfigOverlayProps = {
  onClose: () => void;
  onSuccess: () => void;
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
  minHeight: '300px',
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

function AddKubeConfigOverlay({ onClose, onSuccess }: AddKubeConfigOverlayProps) {
  const { actions, loading, error, kubeConfigs } = useConnectionsState();
  const [mode, setMode] = useState<'paste' | 'named'>('paste');
  const [configContent, setConfigContent] = useState('');
  const [configName, setConfigName] = useState('');
  const [localError, setLocalError] = useState('');

  const isFirstConfig = kubeConfigs.length === 0;

  const handleSave = async () => {
    setLocalError('');

    if (!configContent.trim()) {
      setLocalError('Please paste a kubeconfig');
      return;
    }

    if (mode === 'named') {
      if (!configName.trim()) {
        setLocalError('Please provide a name for the configuration');
        return;
      }
      const success = await actions.saveCustomKubeConfig(configName, configContent);
      if (success) {
        onSuccess();
      }
    } else {
      const path = await actions.savePrimaryKubeConfig(configContent);
      if (path) {
        onSuccess();
      }
    }
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
      className="add-kubeconfig-overlay"
    >
      <div style={dialogStyle}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0, color: 'var(--gh-text, #fff)', fontSize: 20 }}>
            {isFirstConfig ? '☸️ Create Your First Kubeconfig' : '☸️ Add Kubeconfig'}
          </h2>
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

          {!isFirstConfig && (
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Configuration Type</label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="mode"
                    value="paste"
                    checked={mode === 'paste'}
                    onChange={() => setMode('paste')}
                  />
                  <span style={{ color: 'var(--gh-text, #fff)' }}>Save as primary (~/.kube/kubeconfig)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="mode"
                    value="named"
                    checked={mode === 'named'}
                    onChange={() => setMode('named')}
                  />
                  <span style={{ color: 'var(--gh-text, #fff)' }}>Save with custom name</span>
                </label>
              </div>
            </div>
          )}

          {mode === 'named' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle} htmlFor="configName">
                Configuration Name
              </label>
              <input
                id="configName"
                type="text"
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="e.g., my-cluster"
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle} htmlFor="primaryConfigContent">
              Kubeconfig Content (YAML)
            </label>
            <textarea
              id="primaryConfigContent"
              value={configContent}
              onChange={(e) => setConfigContent(e.target.value)}
              placeholder={`apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://your-cluster.example.com
    certificate-authority-data: ...
  name: my-cluster
contexts:
- context:
    cluster: my-cluster
    user: my-user
  name: my-context
current-context: my-context
users:
- name: my-user
  user:
    token: ...`}
              style={textareaStyle}
            />
          </div>

          <p style={{ margin: 0, color: 'var(--gh-text-tertiary, #999)', fontSize: 12 }}>
            {isFirstConfig
              ? 'Paste your kubeconfig YAML content above. This will be saved as your primary kubeconfig.'
              : mode === 'paste'
                ? 'This will overwrite your primary kubeconfig at ~/.kube/kubeconfig'
                : 'This will save a custom kubeconfig that you can select later'}
          </p>
        </div>

        <div style={footerStyle}>
          <button style={secondaryButtonStyle} onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            style={{
              ...primaryButtonStyle,
              opacity: loading || !configContent.trim() ? 0.5 : 1,
              cursor: loading || !configContent.trim() ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSave}
            disabled={loading || !configContent.trim()}
          >
            {loading ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddKubeConfigOverlay;
