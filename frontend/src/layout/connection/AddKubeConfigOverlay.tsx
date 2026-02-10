import { useState } from 'react';
import { useConnectionsState } from './ConnectionsStateContext';
import './AddKubeConfigOverlay.css';

type AddKubeConfigOverlayProps = {
  onClose: () => void;
  onSuccess: () => void;
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
      className="add-kubeconfig-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="add-kubeconfig-dialog">
        <div className="add-kubeconfig-header">
          <h2 className="add-kubeconfig-title">
            {isFirstConfig ? '☸️ Create Your First Kubeconfig' : '☸️ Add Kubeconfig'}
          </h2>
          <button
            onClick={onClose}
            className="add-kubeconfig-close"
          >
            ✕
          </button>
        </div>

        <div className="add-kubeconfig-content">
          {(error || localError) && (
            <div className="add-kubeconfig-alert">
              {localError || error}
            </div>
          )}

          {!isFirstConfig && (
            <div className="add-kubeconfig-section">
              <label className="add-kubeconfig-label">Configuration Type</label>
              <div className="add-kubeconfig-radio-group">
                <label className="add-kubeconfig-radio">
                  <input
                    type="radio"
                    name="mode"
                    value="paste"
                    checked={mode === 'paste'}
                    onChange={() => setMode('paste')}
                  />
                  <span className="add-kubeconfig-radio-text">Save as primary (~/.kube/kubeconfig)</span>
                </label>
                <label className="add-kubeconfig-radio">
                  <input
                    type="radio"
                    name="mode"
                    value="named"
                    checked={mode === 'named'}
                    onChange={() => setMode('named')}
                  />
                  <span className="add-kubeconfig-radio-text">Save with custom name</span>
                </label>
              </div>
            </div>
          )}

          {mode === 'named' && (
            <div className="add-kubeconfig-field">
              <label className="add-kubeconfig-label" htmlFor="configName">
                Configuration Name
              </label>
              <input
                id="configName"
                type="text"
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="e.g., my-cluster"
                className="add-kubeconfig-input"
              />
            </div>
          )}

          <div className="add-kubeconfig-field">
            <label className="add-kubeconfig-label" htmlFor="primaryConfigContent">
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
              className="add-kubeconfig-textarea"
            />
          </div>

          <p className="add-kubeconfig-help">
            {isFirstConfig
              ? 'Paste your kubeconfig YAML content above. This will be saved as your primary kubeconfig.'
              : mode === 'paste'
                ? 'This will overwrite your primary kubeconfig at ~/.kube/kubeconfig'
                : 'This will save a custom kubeconfig that you can select later'}
          </p>
        </div>

        <div className="add-kubeconfig-footer">
          <button className="add-kubeconfig-button add-kubeconfig-button--secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="add-kubeconfig-button add-kubeconfig-button--primary"
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
