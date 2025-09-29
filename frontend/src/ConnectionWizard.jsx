import React, { useState, useEffect } from 'react';
import { GetKubeConfigs, SelectKubeConfigFile, SaveCustomKubeConfig, SetKubeConfigPath, GetKubeContextsFromFile } from '../wailsjs/go/main/App';

const ConnectionWizard = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [discoveredConfigs, setDiscoveredConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [customConfigName, setCustomConfigName] = useState('');
  const [customConfigContent, setCustomConfigContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDiscoveredConfigs();
  }, []);

  const loadDiscoveredConfigs = async () => {
    try {
      setLoading(true);
      const configs = await GetKubeConfigs();
      setDiscoveredConfigs(configs);
      if (configs.length > 0) {
        setSelectedConfig(configs[0]);
      }
    } catch (err) {
      setError('Failed to discover kubeconfig files: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = async () => {
    try {
      setError('');
      const filePath = await SelectKubeConfigFile();
      if (filePath) {
        const contexts = await GetKubeContextsFromFile(filePath);
        const fileName = filePath.split(/[\\/]/).pop();
        const newConfig = {
          path: filePath,
          name: fileName,
          contexts: contexts
        };
        setSelectedConfig(newConfig);
        setDiscoveredConfigs(prev => [...prev, newConfig]);
      }
    } catch (err) {
      setError('Failed to load kubeconfig file: ' + err);
    }
  };

  const handleSaveCustomConfig = async () => {
    if (!customConfigName.trim() || !customConfigContent.trim()) {
      setError('Please provide both a name and config content');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await SaveCustomKubeConfig(customConfigName, customConfigContent);
      // Reload discovered configs to include the new one
      await loadDiscoveredConfigs();
      setCustomConfigName('');
      setCustomConfigContent('');
      setStep(1); // Go back to selection step
    } catch (err) {
      setError('Failed to save custom kubeconfig: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedConfig) {
      setError('Please select a kubeconfig');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await SetKubeConfigPath(selectedConfig.path);
      onComplete();
    } catch (err) {
      setError('Failed to set kubeconfig: ' + err);
      setLoading(false);
    }
  };

  return (
    <div className="connection-wizard-overlay">
      <div className="connection-wizard">
        <div className="wizard-header">
          <h2>🔧 Kubernetes Connection Setup</h2>
          <p>Choose how you want to connect to your Kubernetes cluster</p>
        </div>

        {step === 1 && (
          <div className="wizard-step">
            <h3>Select Kubeconfig</h3>

            {loading && <div className="loading">Loading kubeconfig files...</div>}

            {error && <div className="error-message">{error}</div>}

            {discoveredConfigs.length > 0 && (
              <div className="config-list">
                <h4>Discovered Configurations:</h4>
                {discoveredConfigs.map((config, index) => (
                  <div
                    key={index}
                    className={`config-item ${selectedConfig?.path === config.path ? 'selected' : ''}`}
                    onClick={() => setSelectedConfig(config)}
                  >
                    <div className="config-name">{config.name}</div>
                    <div className="config-path">{config.path}</div>
                    <div className="config-contexts">
                      Contexts: {config.contexts.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {discoveredConfigs.length === 0 && !loading && (
              <div className="no-configs">
                <p>No kubeconfig files found in your home directory.</p>
              </div>
            )}

            <div className="wizard-actions">
              <button onClick={handleSelectFile} className="btn btn-secondary">
                📁 Browse for File
              </button>
              <button onClick={() => setStep(2)} className="btn btn-secondary">
                ➕ Paste Config
              </button>
              <button
                onClick={handleComplete}
                disabled={!selectedConfig || loading}
                className="btn btn-primary"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-step">
            <h3>Add Custom Kubeconfig</h3>

            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="configName">Configuration Name:</label>
              <input
                id="configName"
                type="text"
                value={customConfigName}
                onChange={(e) => setCustomConfigName(e.target.value)}
                placeholder="e.g., my-cluster"
                className="input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="configContent">Kubeconfig Content:</label>
              <textarea
                id="configContent"
                value={customConfigContent}
                onChange={(e) => setCustomConfigContent(e.target.value)}
                placeholder="Paste your kubeconfig YAML content here..."
                className="textarea"
                rows={15}
              />
            </div>

            <div className="wizard-actions">
              <button onClick={() => setStep(1)} className="btn btn-secondary">
                ← Back
              </button>
              <button
                onClick={handleSaveCustomConfig}
                disabled={loading || !customConfigName.trim() || !customConfigContent.trim()}
                className="btn btn-primary"
              >
                {loading ? 'Saving...' : 'Save & Use'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionWizard;
