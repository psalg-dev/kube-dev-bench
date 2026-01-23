// Holmes API wrapper - imports from Wails-generated bindings
import {
  AskHolmes as _AskHolmes,
  AskHolmesStream as _AskHolmesStream,
  CancelHolmesStream as _CancelHolmesStream,
  AnalyzePod as _AnalyzePod,
  AnalyzePodLogs as _AnalyzePodLogs,
  AnalyzePodStream as _AnalyzePodStream,
  AnalyzeDeployment as _AnalyzeDeployment,
  AnalyzeDeploymentStream as _AnalyzeDeploymentStream,
  AnalyzeStatefulSet as _AnalyzeStatefulSet,
  AnalyzeStatefulSetStream as _AnalyzeStatefulSetStream,
  AnalyzeDaemonSet as _AnalyzeDaemonSet,
  AnalyzeDaemonSetStream as _AnalyzeDaemonSetStream,
  AnalyzeService as _AnalyzeService,
  AnalyzeServiceStream as _AnalyzeServiceStream,
  AnalyzeSwarmService as _AnalyzeSwarmService,
  AnalyzeSwarmServiceStream as _AnalyzeSwarmServiceStream,
  AnalyzeSwarmTask as _AnalyzeSwarmTask,
  AnalyzeSwarmTaskStream as _AnalyzeSwarmTaskStream,
  AnalyzeResource as _AnalyzeResource,
  AnalyzeResourceStream as _AnalyzeResourceStream,
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
 * Analyze a pod using HolmesGPT with context.
 * @param {string} namespace
 * @param {string} name
 */
export async function AnalyzePod(namespace, name) {
  return await _AnalyzePod(namespace, name);
}

/**
 * Analyze a pod's logs using HolmesGPT.
 * @param {string} namespace
 * @param {string} podName
 * @param {number} lines
 */
export async function AnalyzePodLogs(namespace, podName, lines = 200) {
  return await _AnalyzePodLogs(namespace, podName, lines);
}

/**
 * Analyze a deployment using HolmesGPT with context.
 * @param {string} namespace
 * @param {string} name
 */
export async function AnalyzeDeployment(namespace, name) {
  return await _AnalyzeDeployment(namespace, name);
}

/**
 * Analyze a statefulset using HolmesGPT with context.
 * @param {string} namespace
 * @param {string} name
 */
export async function AnalyzeStatefulSet(namespace, name) {
  return await _AnalyzeStatefulSet(namespace, name);
}

/**
 * Analyze a daemonset using HolmesGPT with context.
 * @param {string} namespace
 * @param {string} name
 */
export async function AnalyzeDaemonSet(namespace, name) {
  return await _AnalyzeDaemonSet(namespace, name);
}

/**
 * Analyze a service using HolmesGPT with context.
 * @param {string} namespace
 * @param {string} name
 */
export async function AnalyzeService(namespace, name) {
  return await _AnalyzeService(namespace, name);
}

/**
 * Analyze a Docker Swarm service using HolmesGPT.
 * @param {string} serviceID
 */
export async function AnalyzeSwarmService(serviceID) {
  return await _AnalyzeSwarmService(serviceID);
}

/**
 * Analyze a Docker Swarm service using HolmesGPT (streaming).
 * @param {string} serviceID
 * @param {string} streamId - Client-generated stream id
 * @returns {Promise<void>}
 */
export async function AnalyzeSwarmServiceStream(serviceID, streamId) {
  return await _AnalyzeSwarmServiceStream(serviceID, streamId);
}

/**
 * Analyze a Docker Swarm task using HolmesGPT.
 * @param {string} taskID
 */
export async function AnalyzeSwarmTask(taskID) {
  return await _AnalyzeSwarmTask(taskID);
}

/**
 * Analyze a Docker Swarm task using HolmesGPT (streaming).
 * @param {string} taskID
 * @param {string} streamId - Client-generated stream id
 * @returns {Promise<void>}
 */
export async function AnalyzeSwarmTaskStream(taskID, streamId) {
  return await _AnalyzeSwarmTaskStream(taskID, streamId);
}

/**
 * Analyze a resource using HolmesGPT with context.
 * @param {string} kind
 * @param {string} namespace
 * @param {string} name
 */
export async function AnalyzeResource(kind, namespace, name) {
  return await _AnalyzeResource(kind, namespace, name);
}

/**
 * Analyze a pod using HolmesGPT with context (streaming).
 * @param {string} namespace
 * @param {string} name
 * @param {string} streamId - Client-generated stream id
 * @returns {Promise<void>}
 */
export async function AnalyzePodStream(namespace, name, streamId) {
  return await _AnalyzePodStream(namespace, name, streamId);
}

/**
 * Analyze a deployment using HolmesGPT with context (streaming).
 * @param {string} namespace
 * @param {string} name
 * @param {string} streamId - Client-generated stream id
 * @returns {Promise<void>}
 */
export async function AnalyzeDeploymentStream(namespace, name, streamId) {
  return await _AnalyzeDeploymentStream(namespace, name, streamId);
}

/**
 * Analyze a statefulset using HolmesGPT with context (streaming).
 * @param {string} namespace
 * @param {string} name
 * @param {string} streamId - Client-generated stream id
 * @returns {Promise<void>}
 */
export async function AnalyzeStatefulSetStream(namespace, name, streamId) {
  return await _AnalyzeStatefulSetStream(namespace, name, streamId);
}

/**
 * Analyze a daemonset using HolmesGPT with context (streaming).
 * @param {string} namespace
 * @param {string} name
 * @param {string} streamId - Client-generated stream id
 * @returns {Promise<void>}
 */
export async function AnalyzeDaemonSetStream(namespace, name, streamId) {
  return await _AnalyzeDaemonSetStream(namespace, name, streamId);
}

/**
 * Analyze a service using HolmesGPT with context (streaming).
 * @param {string} namespace
 * @param {string} name
 * @param {string} streamId - Client-generated stream id
 * @returns {Promise<void>}
 */
export async function AnalyzeServiceStream(namespace, name, streamId) {
  return await _AnalyzeServiceStream(namespace, name, streamId);
}

/**
 * Analyze a resource using HolmesGPT with context (streaming).
 * @param {string} kind
 * @param {string} namespace
 * @param {string} name
 * @param {string} streamId - Client-generated stream id
 * @returns {Promise<void>}
 */
export async function AnalyzeResourceStream(kind, namespace, name, streamId) {
  return await _AnalyzeResourceStream(kind, namespace, name, streamId);
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
 * Subscribe to Holmes context progress updates
 * @param {(event: {key: string, kind: string, namespace: string, name: string, step: string, status: string, detail?: string}) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onHolmesContextProgress(callback) {
  return EventsOn('holmes:context:progress', callback);
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
