import { useEffect, useState } from 'react';
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
  minHeight: '300px',
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


function AddKubeConfigOverlay({ onClose, onSuccess }) {
  const { actions, loading, error, kubeConfigs } = useConnectionsState();
  const [mode, setMode] = useState('paste'); // 'paste' | 'named'
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
      title={isFirstConfig ? '☸️ Create Your First Kubeconfig' : '☸️ Add Kubeconfig'}
      width={600}
      className="add-kubeconfig-overlay"
      footer={
        <>
          <ModalButton onClick={onClose} disabled={loading}>
            Cancel
          </ModalButton>
          <ModalPrimaryButton
            onClick={handleSave}
            disabled={loading || !configContent.trim()}
          >
            {loading ? 'Saving...' : 'Save & Continue'}
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

        {/* Mode selection - only show if not first config */}
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

        {/* Name input (for named mode) */}
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

        {/* Kubeconfig content */}
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
    </BaseModal>
  );
}

export default AddKubeConfigOverlay;
