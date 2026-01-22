import React, { useState, useEffect } from 'react';
import { useHolmes } from './HolmesContext';
import './HolmesConfigModal.css';

/**
 * HolmesConfigModal - Configuration overlay for Holmes AI settings
 */
export function HolmesConfigModal() {
  const { state, saveConfig, testConnection, hideConfigModal } = useHolmes();
  const [formData, setFormData] = useState({
    enabled: false,
    endpoint: '',
    apiKey: '',
  });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state.showConfig) {
      setFormData({
        enabled: state.enabled,
        endpoint: state.endpoint || '',
        apiKey: '', // Don't pre-fill API key for security
      });
    }
  }, [state.showConfig, state.enabled, state.endpoint]);

  if (!state.showConfig) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
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

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveConfig(formData);
    } catch (err) {
      // Error handled in context
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      hideConfigModal();
    }
  };

  const handleKeyDown = (e) => {
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
