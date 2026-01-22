// Holmes API wrapper - imports from Wails-generated bindings
import {
  AskHolmes as _AskHolmes,
  AskHolmesStream as _AskHolmesStream,
  CancelHolmesStream as _CancelHolmesStream,
  GetHolmesConfig as _GetHolmesConfig,
  SetHolmesConfig as _SetHolmesConfig,
  TestHolmesConnection as _TestHolmesConnection,
  CheckHolmesDeployment as _CheckHolmesDeployment,
  DeployHolmesGPT as _DeployHolmesGPT,
  UndeployHolmesGPT as _UndeployHolmesGPT,
  ReconnectHolmes as _ReconnectHolmes,
  ClearHolmesConfig as _ClearHolmesConfig,
} from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime.js';

/**
 * Send a question to HolmesGPT
 * @param {string} question - The question to ask Holmes
 * @returns {Promise<{response: string, rich_output?: object, timestamp: string, query_id?: string}>}
 */
export async function AskHolmes(question) {
  return await _AskHolmes(question);
}

/**
 * Start a streamed HolmesGPT response
 * @param {string} question - The question to ask Holmes
 * @param {string} streamId - Client-generated stream id
 * @returns {Promise<void>}
 */
export async function AskHolmesStream(question, streamId) {
  return await _AskHolmesStream(question, streamId);
}

/**
 * Cancel a running HolmesGPT stream
 * @param {string} streamId - Client-generated stream id
 * @returns {Promise<void>}
 */
export async function CancelHolmesStream(streamId) {
  return await _CancelHolmesStream(streamId);
}

/**
 * Get the current Holmes configuration (API key is masked)
 * @returns {Promise<{enabled: boolean, endpoint: string, apiKey: string, modelKey?: string, responseFormat?: string}>}
 */
export async function GetHolmesConfig() {
  return await _GetHolmesConfig();
}

/**
 * Set the Holmes configuration
 * @param {{enabled: boolean, endpoint: string, apiKey?: string, modelKey?: string, responseFormat?: string}} config
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

/**
 * Check if HolmesGPT is deployed in the cluster
 * @returns {Promise<{phase: string, message: string, progress: number, endpoint?: string, error?: string}>}
 */
export async function CheckHolmesDeployment() {
  return await _CheckHolmesDeployment();
}

/**
 * Deploy HolmesGPT to the cluster using Helm
 * @param {{openAIKey: string, namespace?: string, releaseName?: string}} request
 * @returns {Promise<{phase: string, message: string, progress: number, endpoint?: string, error?: string}>}
 */
export async function DeployHolmesGPT(request) {
  return await _DeployHolmesGPT(request);
}

/**
 * Undeploy HolmesGPT from the cluster
 * @param {string} namespace
 * @param {string} releaseName
 * @returns {Promise<void>}
 */
export async function UndeployHolmesGPT(namespace, releaseName) {
  return await _UndeployHolmesGPT(namespace, releaseName);
}

/**
 * Subscribe to Holmes deployment status updates
 * @param {(status: {phase: string, message: string, progress: number, endpoint?: string, error?: string}) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onHolmesDeploymentStatus(callback) {
  return EventsOn('holmes:deployment:status', callback);
}

/**
 * Subscribe to Holmes chat stream events
 * @param {(event: {stream_id?: string, event: string, data?: string, error?: string}) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onHolmesChatStream(callback) {
  return EventsOn('holmes:chat:stream', callback);
}

/**
 * Reconnect to Holmes by re-establishing the port-forward
 * Use this when connection fails due to DNS errors or port-forward dying
 * @returns {Promise<{connected: boolean, endpoint: string, error?: string}>}
 */
export async function ReconnectHolmes() {
  return await _ReconnectHolmes();
}

/**
 * Clear the Holmes configuration (reset to defaults)
 * Useful when redeploying Holmes with new settings
 * @returns {Promise<void>}
 */
export async function ClearHolmesConfig() {
  return await _ClearHolmesConfig();
}
