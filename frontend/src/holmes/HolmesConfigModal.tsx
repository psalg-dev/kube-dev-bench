import { useState, useEffect } from 'react';
import { useHolmes } from './HolmesContext';
import './HolmesConfigModal.css';

interface HolmesConfigFormState {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  modelKey: string;
  responseFormat: string;
}

/**
 * HolmesConfigModal - Configuration overlay for Holmes AI settings
 */
export function HolmesConfigModal() {
  const { state, saveConfig, clearConfig, testConnection, hideConfigModal } = useHolmes();
  const [formData, setFormData] = useState<HolmesConfigFormState>({
    enabled: false,
    endpoint: '',
    apiKey: '',
    modelKey: '',
    responseFormat: '',
  });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (state.showConfig) {
      setFormData({
        enabled: state.enabled,
        endpoint: state.endpoint || '',
        apiKey: '', // Don't pre-fill API key for security
        modelKey: state.modelKey || '',
        responseFormat: state.responseFormat || '',
      });
    }
  }, [state.showConfig, state.enabled, state.endpoint, state.modelKey, state.responseFormat]);

  if (!state.showConfig) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const nextValue = e.target instanceof HTMLInputElement && e.target.type === 'checkbox'
      ? e.target.checked
      : value;
    setFormData(prev => ({
      ...prev,
      [name]: nextValue,
    }));
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await testConnection();
    } finally {
      setTesting(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearConfig();
      // Reset form to defaults after clearing
      setFormData({
        enabled: false,
        endpoint: '',
        apiKey: '',
        modelKey: '',
        responseFormat: '',
      });
    } finally {
      setClearing(false);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveConfig(formData);
    } catch {
      // Error handled in context
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      hideConfigModal();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      hideConfigModal();
    }
  };

  return (
    <div
      className="holmes-config-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="holmes-config-modal" id="holmes-config-modal">
        <div className="holmes-config-header">
          <h3>Holmes AI Configuration</h3>
          <button
            className="holmes-config-close"
            onClick={hideConfigModal}
            title="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="holmes-config-body">
            <div className="holmes-config-field">
              <label className="holmes-config-checkbox">
                <input
                  type="checkbox"
                  name="enabled"
                  checked={formData.enabled}
                  onChange={handleChange}
                />
                <span>Enable Holmes AI</span>
              </label>
              <p className="holmes-config-help">
                Holmes AI provides intelligent troubleshooting for your Kubernetes cluster.
              </p>
            </div>

            <div className="holmes-config-field">
              <label htmlFor="holmes-endpoint">Holmes Endpoint</label>
              <input
                type="url"
                id="holmes-endpoint"
                name="endpoint"
                className="holmes-config-input"
                placeholder="http://localhost:8080"
                value={formData.endpoint}
                onChange={handleChange}
                disabled={!formData.enabled}
              />
              <p className="holmes-config-help">
                URL of the HolmesGPT API server (e.g., http://localhost:8080 or in-cluster URL)
              </p>
            </div>

            <div className="holmes-config-field">
              <label htmlFor="holmes-apikey">API Key (optional)</label>
              <input
                type="password"
                id="holmes-apikey"
                name="apiKey"
                className="holmes-config-input"
                placeholder="Leave empty if not required"
                value={formData.apiKey}
                onChange={handleChange}
                disabled={!formData.enabled}
                autoComplete="off"
              />
              <p className="holmes-config-help">
                API key for authentication (only required if your Holmes instance requires it)
              </p>
            </div>

            <div className="holmes-config-field">
              <label htmlFor="holmes-model-key">Model key (optional)</label>
              <input
                type="text"
                id="holmes-model-key"
                name="modelKey"
                className="holmes-config-input"
                placeholder="fast-model"
                value={formData.modelKey}
                onChange={handleChange}
                disabled={!formData.enabled}
              />
              <p className="holmes-config-help">
                Use a modelList key from your HolmesGPT Helm values for faster responses.
              </p>
            </div>

            <div className="holmes-config-field">
              <label htmlFor="holmes-response-format">Response format (JSON schema, optional)</label>
              <textarea
                id="holmes-response-format"
                name="responseFormat"
                className="holmes-config-input holmes-config-textarea"
                placeholder='{"type":"json_schema","json_schema":{"name":"Result","strict":true,"schema":{...}}}'
                value={formData.responseFormat}
                onChange={handleChange}
                disabled={!formData.enabled}
                rows={6}
              />
              <p className="holmes-config-help">
                Provide a JSON schema to structure responses. Leave empty for free-form output.
              </p>
            </div>
          </div>

          <div className="holmes-config-footer">
            <button
              type="button"
              className="holmes-config-btn"
              onClick={handleTest}
              disabled={!formData.enabled || !formData.endpoint || testing}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              type="button"
              className="holmes-config-btn holmes-config-btn-danger"
              onClick={handleClear}
              disabled={clearing}
              title="Clear saved Holmes configuration (for redeployment)"
            >
              {clearing ? 'Clearing...' : 'Clear Config'}
            </button>
            <div className="holmes-config-footer-right">
              <button
                type="button"
                className="holmes-config-btn"
                onClick={hideConfigModal}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="holmes-config-btn holmes-config-btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default HolmesConfigModal;
