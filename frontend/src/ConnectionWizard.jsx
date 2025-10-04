import React, { useState, useEffect } from 'react';
import { GetKubeConfigs, SelectKubeConfigFile, SaveCustomKubeConfig, SetKubeConfigPath, GetKubeContextsFromFile, SavePrimaryKubeConfig, GetKubeContexts, GetNamespaces, SetCurrentKubeContext, SetCurrentNamespace, GetCurrentConfig } from '../wailsjs/go/main/App';

const ConnectionWizard = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [discoveredConfigs, setDiscoveredConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [customConfigName, setCustomConfigName] = useState('');
  const [customConfigContent, setCustomConfigContent] = useState('');
  const [primaryConfigContent, setPrimaryConfigContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDiscoveredConfigs();
  }, []);

  const loadDiscoveredConfigs = async () => {
    try {
      setLoading(true);
      const configs = await GetKubeConfigs();
      const safe = Array.isArray(configs) ? configs : [];
      setDiscoveredConfigs(safe);
      if (safe.length > 0) {
        setSelectedConfig(safe[0]);
      } else {
        setSelectedConfig(null);
      }
      return safe;
    } catch (err) {
      setError('Failed to discover kubeconfig files: ' + err);
      return [];
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
          contexts: Array.isArray(contexts) ? contexts : []
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
      await loadDiscoveredConfigs();
      setCustomConfigName('');
      setCustomConfigContent('');
      setStep(1);
    } catch (err) {
      setError('Failed to save custom kubeconfig: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const autoSelectContextAndNamespaceIfMissing = async () => {
    try {
      const cfg = await GetCurrentConfig();
      let contextWasSet = !!cfg.currentContext;
      if (!contextWasSet) {
        const contexts = await GetKubeContexts();
        if (Array.isArray(contexts) && contexts.length > 0) {
          await SetCurrentKubeContext(contexts[0]);
          contextWasSet = true;
        }
      }
      if (contextWasSet) {
        try {
          const namespaces = await GetNamespaces();
          if (Array.isArray(namespaces) && namespaces.length > 0) {
            // Only set if we just set context or currentNamespace absent
            if (!cfg.currentNamespace) {
              const firstNs = namespaces[0];
              await Promise.all([
                (window?.go?.main?.App?.SetPreferredNamespaces ? window.go.main.App.SetPreferredNamespaces([firstNs]) : Promise.resolve()),
                SetCurrentNamespace(firstNs).catch(()=>{}),
              ]);
            }
          }
        } catch (_) { /* ignore namespace failures */ }
      }
    } catch (_) { /* ignore auto select failures */ }
  };

  const handleSavePrimaryConfig = async () => {
    if (!primaryConfigContent.trim()) {
      setError('Please paste a kubeconfig first');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const path = await SavePrimaryKubeConfig(primaryConfigContent);
      const configs = await loadDiscoveredConfigs();
      const primary = configs.find(c => c.path === path);
      if (primary) {
        setSelectedConfig(primary);
        await SetKubeConfigPath(primary.path);
      } else {
        await SetKubeConfigPath(path);
      }
      // Attempt auto context + namespace selection for freshly saved primary config
      await autoSelectContextAndNamespaceIfMissing();
      onComplete();
    } catch (err) {
      setError('Failed to save primary kubeconfig: ' + err);
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
      // Ensure a context & namespaces are present (first time selection scenario)
      await autoSelectContextAndNamespaceIfMissing();
      onComplete();
    } catch (err) {
      setError('Failed to set kubeconfig: ' + err);
      setLoading(false);
    }
  };

  const noConfigs = !Array.isArray(discoveredConfigs) || discoveredConfigs.length === 0;

  return (
    <div className="connection-wizard-overlay">
      <div className="connection-wizard">
        <div className="wizard-header">
          <h2>🔧 Kubernetes Connection Setup</h2>
          <p>Choose how you want to connect to your Kubernetes cluster</p>
        </div>

        {noConfigs && (
          <div className="wizard-step">
            <h3>Create Your First Kubeconfig</h3>
            {loading && <div className="loading">Preparing...</div>}
            {error && <div className="error-message">{error}</div>}
            <p>No kubeconfig files were discovered. Paste a kubeconfig (YAML) below to create <code>~/.kube/kubeconfig</code>.</p>
            <div className="form-group">
              <label htmlFor="primaryConfigContent">Kubeconfig Content:</label>
              <textarea
                id="primaryConfigContent"
                value={primaryConfigContent}
                onChange={e => setPrimaryConfigContent(e.target.value)}
                placeholder="apiVersion: v1\nclusters:\n- cluster: ..."
                className="textarea"
                rows={18}
              />
            </div>
            <div className="wizard-actions">
              <button onClick={handleSelectFile} className="btn btn-secondary" disabled={loading}>📁 Browse for File</button>
              <button onClick={handleSavePrimaryConfig} className="btn btn-primary" disabled={loading || !primaryConfigContent.trim()}>
                {loading ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          </div>
        )}

        {!noConfigs && step === 1 && (
          <div className="wizard-step">
            <h3>Select Kubeconfig</h3>

            {loading && <div className="loading">Loading kubeconfig files...</div>}

            {error && <div className="error-message">{error}</div>}

            {Array.isArray(discoveredConfigs) && discoveredConfigs.length > 0 && (
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
                      Contexts: {(config.contexts || []).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="wizard-actions">
              <button onClick={handleSelectFile} className="btn btn-secondary">
                📁 Browse for File
              </button>
              <button onClick={() => setStep(2)} className="btn btn-secondary">
                ➕ Paste Additional Config
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

        {!noConfigs && step === 2 && (
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
