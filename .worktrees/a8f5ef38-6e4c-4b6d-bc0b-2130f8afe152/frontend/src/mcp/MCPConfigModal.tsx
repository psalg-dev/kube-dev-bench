import { useState, useEffect } from 'react';
import { useMCP } from './MCPContext';
import type { MCPConfig } from './mcpApi';
import './MCPConfigModal.css';

interface MCPFormState {
  enabled: boolean;
  host: string;
  port: number;
  transportMode: string;
  allowDestructive: boolean;
  requireConfirm: boolean;
  maxLogLines: number;
}

function formToConfig(form: MCPFormState): MCPConfig {
  return { ...form };
}

/**
 * MCPConfigModal - Configuration overlay for MCP server settings
 */
export function MCPConfigModal() {
  const { state, saveConfig, startServer, stopServer, hideConfigModal, loadConfig } = useMCP();
  const [formData, setFormData] = useState<MCPFormState>({
    enabled: false,
    host: 'localhost',
    port: 3000,
    transportMode: 'http',
    allowDestructive: false,
    requireConfirm: true,
    maxLogLines: 1000,
  });
  const [saving, setSaving] = useState(false);

  // Sync form from context state when modal opens
  useEffect(() => {
    if (state.showConfig && state.config) {
      setFormData({
        enabled: state.config.enabled,
        host: state.config.host || 'localhost',
        port: state.config.port || 3000,
        transportMode: state.config.transportMode || 'http',
        allowDestructive: state.config.allowDestructive,
        requireConfirm: state.config.requireConfirm,
        maxLogLines: state.config.maxLogLines || 1000,
      });
    }
  }, [state.showConfig, state.config]);

  if (!state.showConfig) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target;
    const { name, value } = target;
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      const checked = target.checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (target instanceof HTMLInputElement && target.type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value, 10) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveConfig(formToConfig(formData));
    } catch {
      // Error handled in context
    } finally {
      setSaving(false);
    }
  };

  const handleStartStop = async () => {
    if (state.status?.running) {
      await stopServer();
    } else {
      await startServer();
    }
    // Refresh config to pick up any server-side changes
    await loadConfig();
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

  const isRunning = state.status?.running ?? false;
  const showHTTPFields = formData.transportMode !== 'stdio';

  return (
    <div
      className="mcp-config-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="mcp-config-modal" id="mcp-config-modal">
        <div className="mcp-config-header">
          <h3>MCP Server Configuration</h3>
          <button
            className="mcp-config-close"
            onClick={hideConfigModal}
            title="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="mcp-config-body">
            {/* Server Section */}
            <div className="mcp-config-section">
              <h4 className="mcp-config-section-title">Server</h4>

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
                  Expose cluster tools via the Model Context Protocol for AI assistants.
                </p>
              </div>

              <div className="mcp-config-field">
                <label htmlFor="mcp-transport">Transport</label>
                <select
                  id="mcp-transport"
                  name="transportMode"
                  className="mcp-config-input"
                  value={formData.transportMode}
                  onChange={handleChange}
                  disabled={!formData.enabled}
                >
                  <option value="http">Streamable HTTP</option>
                  <option value="stdio">stdio (Claude Desktop)</option>
                </select>
                <p className="mcp-config-help">
                  HTTP for network access; stdio for Claude Desktop subprocess mode.
                </p>
              </div>

              {showHTTPFields && (
                <>
                  <div className="mcp-config-field">
                    <label htmlFor="mcp-host">Host</label>
                    <input
                      type="text"
                      id="mcp-host"
                      name="host"
                      className="mcp-config-input"
                      placeholder="localhost"
                      value={formData.host}
                      onChange={handleChange}
                      disabled={!formData.enabled}
                    />
                  </div>

                  <div className="mcp-config-field">
                    <label htmlFor="mcp-port">Port</label>
                    <input
                      type="number"
                      id="mcp-port"
                      name="port"
                      className="mcp-config-input"
                      min={1}
                      max={65535}
                      value={formData.port}
                      onChange={handleChange}
                      disabled={!formData.enabled}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Security Section */}
            <div className="mcp-config-section">
              <h4 className="mcp-config-section-title">Security</h4>

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
                  Permits scale-to-zero and other destructive operations via MCP.
                </p>
              </div>

              <div className="mcp-config-field">
                <label className="mcp-config-checkbox">
                  <input
                    type="checkbox"
                    name="requireConfirm"
                    checked={formData.requireConfirm}
                    onChange={handleChange}
                    disabled={!formData.enabled}
                  />
                  <span>Require Confirmation</span>
                </label>
                <p className="mcp-config-help">
                  AI must pass a <code>confirmed: true</code> parameter for write operations.
                </p>
              </div>
            </div>

            {/* Limits Section */}
            <div className="mcp-config-section">
              <h4 className="mcp-config-section-title">Limits</h4>

              <div className="mcp-config-field">
                <label htmlFor="mcp-max-log-lines">Max Log Lines</label>
                <input
                  type="number"
                  id="mcp-max-log-lines"
                  name="maxLogLines"
                  className="mcp-config-input"
                  min={10}
                  max={50000}
                  value={formData.maxLogLines}
                  onChange={handleChange}
                  disabled={!formData.enabled}
                />
                <p className="mcp-config-help">
                  Maximum log lines returned per pod log request (10–50,000).
                </p>
              </div>
            </div>

            {/* Status Section */}
            <div className="mcp-config-section">
              <h4 className="mcp-config-section-title">Status</h4>

              <div className="mcp-config-status-row">
                <span
                  className={`mcp-config-status-dot ${isRunning ? 'mcp-config-status-running' : 'mcp-config-status-stopped'}`}
                />
                <span className="mcp-config-status-label">
                  {isRunning ? 'Running' : 'Stopped'}
                  {state.status?.address ? ` — ${state.status.address}` : ''}
                </span>
                <button
                  type="button"
                  className={`mcp-config-btn ${isRunning ? 'mcp-config-btn-danger' : 'mcp-config-btn-primary'}`}
                  onClick={handleStartStop}
                  disabled={!state.config?.enabled}
                >
                  {isRunning ? 'Stop' : 'Start'}
                </button>
              </div>
            </div>
          </div>

          <div className="mcp-config-footer">
            <div className="mcp-config-footer-right">
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
          </div>
        </form>
      </div>
    </div>
  );
}

export default MCPConfigModal;
