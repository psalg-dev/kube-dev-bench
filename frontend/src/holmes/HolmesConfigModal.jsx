import { useState, useEffect, useCallback } from 'react';
import { useHolmes } from './HolmesContext';
import { BaseModal, ModalButton, ModalDangerButton, ModalPrimaryButton } from '../components/BaseModal';
import './HolmesConfigModal.css';

/**
 * HolmesConfigModal - Configuration overlay for Holmes AI settings
 */
export function HolmesConfigModal() {
  const { state, saveConfig, clearConfig, testConnection, hideConfigModal } = useHolmes();
  const [formData, setFormData] = useState({
    enabled: false,
    endpoint: '',
    apiKey: '',
    modelKey: '',
    responseFormat: '',
  });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Initialize form data when config modal opens
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

  // Handle Escape key to close modal - must be called before any early returns
  useEffect(() => {
    if (!state.showConfig) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        hideConfigModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.showConfig, hideConfigModal]);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);

  const handleTest = useCallback(async () => {
    setTesting(true);
    try {
      await testConnection();
    } finally {
      setTesting(false);
    }
  }, [testConnection]);

  const handleClear = useCallback(async () => {
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
  }, [clearConfig]);

  const handleSave = useCallback(async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveConfig(formData);
    } catch (_err) {
      // Error handled in context
    } finally {
      setSaving(false);
    }
  }, [formData, saveConfig]);

  if (!state.showConfig) return null;

  return (
    <BaseModal
      isOpen={state.showConfig}
      onClose={hideConfigModal}
      title="Holmes AI Configuration"
      width={480}
      className="holmes-config-modal"
      footer={
        <div className="holmes-config-footer">
          <ModalButton
            type="button"
            className="holmes-config-btn"
            onClick={handleTest}
            disabled={!formData.enabled || !formData.endpoint || testing}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </ModalButton>
          <ModalDangerButton
            type="button"
            className="holmes-config-btn holmes-config-btn-danger"
            onClick={handleClear}
            disabled={clearing}
            title="Clear saved Holmes configuration (for redeployment)"
          >
            {clearing ? 'Clearing...' : 'Clear Config'}
          </ModalDangerButton>
          <div className="holmes-config-footer-right">
            <ModalButton
              type="button"
              className="holmes-config-btn"
              onClick={hideConfigModal}
            >
              Cancel
            </ModalButton>
            <ModalPrimaryButton
              type="submit"
              form="holmes-config-form"
              className="holmes-config-btn holmes-config-btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </ModalPrimaryButton>
          </div>
        </div>
      }
    >
      <form id="holmes-config-form" onSubmit={handleSave}>
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
      </form>
    </BaseModal>
  );
}

export default HolmesConfigModal;
