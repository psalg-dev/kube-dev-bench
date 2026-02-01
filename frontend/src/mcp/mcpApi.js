// MCP API wrapper - imports from Wails-generated bindings
import {
  GetMCPConfig as _GetMCPConfig,
  SetMCPConfig as _SetMCPConfig,
  GetMCPStatus as _GetMCPStatus,
  StartMCPServer as _StartMCPServer,
  StopMCPServer as _StopMCPServer,
} from '../../wailsjs/go/main/App';

/**
 * Get current MCP configuration
 * @returns {Promise<{enabled: boolean, allowDestructive: boolean, requireConfirm: boolean, maxLogLines: number}>}
 */
export async function GetMCPConfig() {
  return _GetMCPConfig();
}

/**
 * Set MCP configuration
 * @param {Object} config - MCP configuration
 * @param {boolean} config.enabled - Enable/disable MCP server
 * @param {boolean} config.allowDestructive - Allow destructive operations
 * @param {boolean} config.requireConfirm - Require confirmation for destructive ops
 * @param {number} config.maxLogLines - Maximum log lines to return
 * @returns {Promise<void>}
 */
export async function SetMCPConfig(config) {
  return _SetMCPConfig(config);
}

/**
 * Get MCP server status
 * @returns {Promise<{running: boolean, enabled: boolean, transport: string, error?: string}>}
 */
export async function GetMCPStatus() {
  return _GetMCPStatus();
}

/**
 * Start MCP server
 * @returns {Promise<void>}
 */
export async function StartMCPServer() {
  return _StartMCPServer();
}

/**
 * Stop MCP server
 * @returns {Promise<void>}
 */
export async function StopMCPServer() {
  return _StopMCPServer();
}

/**
 * Default MCP configuration
 */
export const DefaultMCPConfig = {
  enabled: false,
  host: 'localhost',
  port: 3000,
  allowDestructive: false,
  requireConfirm: true,
  maxLogLines: 1000,
};
