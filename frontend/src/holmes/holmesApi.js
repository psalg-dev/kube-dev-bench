// Holmes API wrapper - imports from Wails-generated bindings
import {
  AskHolmes as _AskHolmes,
  GetHolmesConfig as _GetHolmesConfig,
  SetHolmesConfig as _SetHolmesConfig,
  TestHolmesConnection as _TestHolmesConnection,
} from '../../wailsjs/go/main/App';

/**
 * Send a question to HolmesGPT
 * @param {string} question - The question to ask Holmes
 * @returns {Promise<{response: string, rich_output?: object, timestamp: string, query_id?: string}>}
 */
export async function AskHolmes(question) {
  return await _AskHolmes(question);
}

/**
 * Get the current Holmes configuration (API key is masked)
 * @returns {Promise<{enabled: boolean, endpoint: string, apiKey: string}>}
 */
export async function GetHolmesConfig() {
  return await _GetHolmesConfig();
}

/**
 * Set the Holmes configuration
 * @param {{enabled: boolean, endpoint: string, apiKey?: string}} config
 * @returns {Promise<void>}
 */
export async function SetHolmesConfig(config) {
  return await _SetHolmesConfig(config);
}

/**
 * Test the connection to HolmesGPT
 * @returns {Promise<{connected: boolean, endpoint: string, error?: string}>}
 */
export async function TestHolmesConnection() {
  return await _TestHolmesConnection();
}
