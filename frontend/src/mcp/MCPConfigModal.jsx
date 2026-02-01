import { useState, useEffect } from 'react';
import { useMCP } from './MCPContext';
import './MCPConfigModal.css';

/**
 * MCPConfigModal - Configuration overlay for MCP Server settings
 * Also includes setup instructions for connecting AI clients
 */
export function MCPConfigModal() {
  const { state, saveConfig, hideConfigModal } = useMCP();

  const [formData, setFormData] = useState({
    enabled: false,
    host: 'localhost',
    port: 3000,
    allowDestructive: false,
    requireConfirm: true,
    maxLogLines: 1000,
  });
  const [saving, setSaving] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (state.showConfig) {
      setFormData({
        enabled: state.enabled,
        host: state.host || 'localhost',
        port: state.port || 3000,
        allowDestructive: state.allowDestructive,
        requireConfirm: state.requireConfirm,
        maxLogLines: state.maxLogLines,
      });
    }
  }, [state.showConfig, state.enabled, state.host, state.port, state.allowDestructive, state.requireConfirm, state.maxLogLines]);

  if (!state.showConfig) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value, 10) : value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveConfig(formData);
    } catch (_err) {
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

  // Get the MCP server URL for config instructions
  const getMCPServerUrl = () => {
    return `http://${formData.host}:${formData.port}/mcp`;
  };

  const vscodeSettingsConfig = `{
  "mcp": {
    "servers": {
      "kubedevbench": {
        "type": "http",
        "url": "${getMCPServerUrl()}"
      }
    }
  }
}`;

  return (
    <div
      className="mcp-config-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mcp-config-title"
    >
      <div className="mcp-config-modal" id="mcp-config-modal">
        <div className="mcp-config-header">
          <h3 id="mcp-config-title">MCP Server Configuration</h3>
          <button
            className="mcp-config-close"
            onClick={hideConfigModal}
            title="Close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="mcp-config-body">
            {/* Status Indicator */}
            <div className="mcp-status-banner">
              <span className={`mcp-status-indicator ${state.serverStatus?.running ? 'running' : 'stopped'}`} />
              <span>
                Server Status: {state.serverStatus?.running ? 'Running' : 'Stopped'}
                {state.serverStatus?.transport && ` (${state.serverStatus.transport})`}
              </span>
            </div>

            {/* Enable MCP Server */}
            <div className="mcp-config-field">
              <label className="mcp-config-checkbox">
                <input
                  type="checkbox"
                  name="enabled"
                  checked={formData.enabled}
                  onChange={handleChange}
                />
                <span>Enable MCP Server</span>
              </label>
              <p className="mcp-config-help">
                Enable the Model Context Protocol server to allow AI assistants (GitHub Copilot, etc.) to interact with your clusters.
              </p>
            </div>

            {/* Server Settings */}
            <div className="mcp-config-section">
              <h4>Server Settings</h4>
              
              <div className="mcp-config-row">
                <div className="mcp-config-field">
                  <label htmlFor="mcp-host">Host</label>
                  <input
                    type="text"
                    id="mcp-host"
                    name="host"
                    className="mcp-config-input"
                    value={formData.host}
                    onChange={handleChange}
                    disabled={!formData.enabled}
                    placeholder="localhost"
                  />
                </div>
                <div className="mcp-config-field">
                  <label htmlFor="mcp-port">Port</label>
                  <input
                    type="number"
                    id="mcp-port"
                    name="port"
                    className="mcp-config-input"
                    min={1024}
                    max={65535}
                    value={formData.port}
                    onChange={handleChange}
                    disabled={!formData.enabled}
                    placeholder="3000"
                  />
                </div>
              </div>
              <p className="mcp-config-help">
                The HTTP server will listen on this address. Use &quot;localhost&quot; for local-only access or &quot;0.0.0.0&quot; to accept remote connections.
              </p>
            </div>

            {/* Security Settings */}
            <div className="mcp-config-section">
              <h4>Security Settings</h4>
              
              <div className="mcp-config-field">
                <label className="mcp-config-checkbox">
                  <input
                    type="checkbox"
                    name="allowDestructive"
                    checked={formData.allowDestructive}
                    onChange={handleChange}
                    disabled={!formData.enabled}
                  />
                  <span>Allow Destructive Operations</span>
                </label>
                <p className="mcp-config-help">
                  Enable delete and scale-to-zero operations. When disabled, only read operations and safe writes are allowed.
                </p>
              </div>

              <div className="mcp-config-field">
                <label className="mcp-config-checkbox">
                  <input
                    type="checkbox"
                    name="requireConfirm"
                    checked={formData.requireConfirm}
                    onChange={handleChange}
                    disabled={!formData.enabled || !formData.allowDestructive}
                  />
                  <span>Require Confirmation for Destructive Operations</span>
                </label>
                <p className="mcp-config-help">
                  When enabled, destructive operations require explicit confirmation via the &quot;confirmed&quot; parameter.
                </p>
              </div>
            </div>

            {/* Output Settings */}
            <div className="mcp-config-field">
              <label htmlFor="mcp-max-log-lines">Maximum Log Lines</label>
              <input
                type="number"
                id="mcp-max-log-lines"
                name="maxLogLines"
                className="mcp-config-input"
                min={100}
                max={50000}
                step={100}
                value={formData.maxLogLines}
                onChange={handleChange}
                disabled={!formData.enabled}
              />
              <p className="mcp-config-help">
                Maximum number of log lines to return when fetching logs (100-50000).
              </p>
            </div>

            {/* Setup Instructions Toggle */}
            <div className="mcp-config-section">
              <button
                type="button"
                className="mcp-instructions-toggle"
                onClick={() => setShowInstructions(!showInstructions)}
              >
                {showInstructions ? '▼' : '▶'} Setup Instructions for VS Code
              </button>

              {showInstructions && (
                <div className="mcp-instructions">
                  <h4>VS Code Configuration</h4>
                  <p>
                    To connect VS Code (with GitHub Copilot) to KubeDevBench, add the following to your
                    {' '}<code>settings.json</code> file (or workspace settings):
                  </p>
                  <ul className="mcp-config-paths">
                    <li><strong>Windows:</strong> <code>%APPDATA%\Code\User\settings.json</code></li>
                    <li><strong>macOS:</strong> <code>~/Library/Application Support/Code/User/settings.json</code></li>
                    <li><strong>Linux:</strong> <code>~/.config/Code/User/settings.json</code></li>
                  </ul>
                  <div className="mcp-code-block">
                    <pre>{vscodeSettingsConfig}</pre>
                    <button
                      type="button"
                      className="mcp-copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(vscodeSettingsConfig);
                      }}
                      title="Copy to clipboard"
                    >
                      📋 Copy
                    </button>
                  </div>

                  <h4>Quick Setup Steps</h4>
                  <ol className="mcp-setup-steps">
                    <li>Enable the MCP server above and click &quot;Save&quot;</li>
                    <li>Open VS Code Settings (Ctrl/Cmd + ,)</li>
                    <li>Search for &quot;mcp&quot; to find MCP server settings</li>
                    <li>Click &quot;Edit in settings.json&quot; and add the configuration above</li>
                    <li>Reload VS Code window (Ctrl/Cmd + Shift + P → &quot;Reload Window&quot;)</li>
                    <li>Ask Copilot about your Kubernetes cluster!</li>
                  </ol>

                  <h4>Available Tools</h4>
                  <p>Once connected, GitHub Copilot can use these tools:</p>
                  
                  <h5>Kubernetes Read-Only</h5>
                  <ul className="mcp-tools-list">
                    <li><strong>k8s_list_pods</strong> - List pods in a namespace</li>
                    <li><strong>k8s_get_pod_logs</strong> - Retrieve pod logs</li>
                    <li><strong>k8s_get_events</strong> - Get Kubernetes events</li>
                    <li><strong>k8s_describe_pod</strong> - Get detailed pod info</li>
                    <li><strong>k8s_list_deployments</strong> - List deployments</li>
                    <li><strong>k8s_describe_deployment</strong> - Get detailed deployment info</li>
                    <li><strong>k8s_list_statefulsets</strong> - List StatefulSets</li>
                    <li><strong>k8s_list_daemonsets</strong> - List DaemonSets</li>
                    <li><strong>k8s_list_jobs</strong> - List Jobs</li>
                    <li><strong>k8s_list_cronjobs</strong> - List CronJobs</li>
                    <li><strong>k8s_list_configmaps</strong> - List ConfigMaps</li>
                    <li><strong>k8s_list_secrets</strong> - List Secrets (metadata only)</li>
                    <li><strong>k8s_get_resource_counts</strong> - Get resource counts</li>
                  </ul>

                  <h5>Kubernetes Write Operations</h5>
                  <ul className="mcp-tools-list">
                    <li><strong>k8s_scale_deployment</strong> - Scale deployment replicas</li>
                    <li><strong>k8s_restart_deployment</strong> - Restart a deployment</li>
                  </ul>

                  <h5>Docker Swarm Read-Only</h5>
                  <ul className="mcp-tools-list">
                    <li><strong>swarm_list_services</strong> - List Swarm services</li>
                    <li><strong>swarm_list_tasks</strong> - List Swarm tasks</li>
                    <li><strong>swarm_list_nodes</strong> - List Swarm nodes</li>
                    <li><strong>swarm_get_service_logs</strong> - Get service logs</li>
                  </ul>

                  <h5>Docker Swarm Write Operations</h5>
                  <ul className="mcp-tools-list">
                    <li><strong>swarm_scale_service</strong> - Scale a Swarm service</li>
                  </ul>

                  <h4>Security Notes</h4>
                  <ul className="mcp-security-notes">
                    <li>The MCP server only runs when KubeDevBench is open</li>
                    <li>All operations use your currently connected cluster/namespace</li>
                    <li>Destructive operations are disabled by default</li>
                    <li>Consider the security implications before enabling destructive operations</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="mcp-config-footer">
            <button
              type="button"
              className="mcp-config-btn"
              onClick={hideConfigModal}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="mcp-config-btn mcp-config-btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MCPConfigModal;
