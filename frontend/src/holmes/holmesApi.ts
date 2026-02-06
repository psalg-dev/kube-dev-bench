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
  AnalyzeJobStream as _AnalyzeJobStream,
  AnalyzeCronJobStream as _AnalyzeCronJobStream,
  AnalyzeIngressStream as _AnalyzeIngressStream,
  AnalyzeConfigMapStream as _AnalyzeConfigMapStream,
  AnalyzeSecretStream as _AnalyzeSecretStream,
  AnalyzePersistentVolumeStream as _AnalyzePersistentVolumeStream,
  AnalyzePersistentVolumeClaimStream as _AnalyzePersistentVolumeClaimStream,
  AnalyzeSwarmService as _AnalyzeSwarmService,
  AnalyzeSwarmServiceStream as _AnalyzeSwarmServiceStream,
  AnalyzeSwarmTask as _AnalyzeSwarmTask,
  AnalyzeSwarmTaskStream as _AnalyzeSwarmTaskStream,
  AnalyzeSwarmNode as _AnalyzeSwarmNode,
  AnalyzeSwarmNodeStream as _AnalyzeSwarmNodeStream,
  AnalyzeSwarmStack as _AnalyzeSwarmStack,
  AnalyzeSwarmStackStream as _AnalyzeSwarmStackStream,
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

export interface HolmesResponse {
  response?: string;
  Response?: string;
  analysis?: string;
  Analysis?: string;
  rich_output?: unknown;
  RichOutput?: unknown;
}

export interface HolmesConfig {
  enabled: boolean;
  endpoint: string;
  apiKey?: string;
  modelKey?: string;
  responseFormat?: string;
}

export interface HolmesConnectionStatus {
  connected: boolean;
  endpoint: string;
  error?: string;
}

export interface HolmesDeploymentStatus {
  phase: string;
  message: string;
  progress: number;
  endpoint?: string;
  error?: string;
}

export interface HolmesStreamEvent {
  stream_id?: string;
  event: string;
  data?: string;
  error?: string;
}

export interface HolmesContextProgressEvent {
  key: string;
  kind: string;
  namespace: string;
  name: string;
  step: string;
  status: string;
  detail?: string;
}

/**
 * Send a question to HolmesGPT
 * @param question - The question to ask Holmes
 */
export async function AskHolmes(question: string): Promise<HolmesResponse> {
  return await _AskHolmes(question);
}

/**
 * Start a streamed HolmesGPT response
 * @param question - The question to ask Holmes
 * @param streamId - Client-generated stream id
 */
export async function AskHolmesStream(question: string, streamId: string): Promise<void> {
  return await _AskHolmesStream(question, streamId);
}

/**
 * Cancel a running HolmesGPT stream
 * @param streamId - Client-generated stream id
 */
export async function CancelHolmesStream(streamId: string): Promise<void> {
  return await _CancelHolmesStream(streamId);
}

/**
 * Analyze a pod using HolmesGPT with context.
 */
export async function AnalyzePod(namespace: string, name: string): Promise<HolmesResponse> {
  return await _AnalyzePod(namespace, name);
}

/**
 * Analyze a pod's logs using HolmesGPT.
 */
export async function AnalyzePodLogs(namespace: string, podName: string, lines = 200): Promise<HolmesResponse> {
  return await _AnalyzePodLogs(namespace, podName, lines);
}

/**
 * Analyze a deployment using HolmesGPT with context.
 */
export async function AnalyzeDeployment(namespace: string, name: string): Promise<HolmesResponse> {
  return await _AnalyzeDeployment(namespace, name);
}

/**
 * Analyze a statefulset using HolmesGPT with context.
 */
export async function AnalyzeStatefulSet(namespace: string, name: string): Promise<HolmesResponse> {
  return await _AnalyzeStatefulSet(namespace, name);
}

/**
 * Analyze a daemonset using HolmesGPT with context.
 */
export async function AnalyzeDaemonSet(namespace: string, name: string): Promise<HolmesResponse> {
  return await _AnalyzeDaemonSet(namespace, name);
}

/**
 * Analyze a service using HolmesGPT with context.
 */
export async function AnalyzeService(namespace: string, name: string): Promise<HolmesResponse> {
  return await _AnalyzeService(namespace, name);
}

/**
 * Analyze a Docker Swarm service using HolmesGPT.
 */
export async function AnalyzeSwarmService(serviceID: string): Promise<HolmesResponse> {
  return await _AnalyzeSwarmService(serviceID);
}

/**
 * Analyze a Docker Swarm service using HolmesGPT (streaming).
 */
export async function AnalyzeSwarmServiceStream(serviceID: string, streamId: string): Promise<void> {
  return await _AnalyzeSwarmServiceStream(serviceID, streamId);
}

/**
 * Analyze a Docker Swarm task using HolmesGPT.
 */
export async function AnalyzeSwarmTask(taskID: string): Promise<HolmesResponse> {
  return await _AnalyzeSwarmTask(taskID);
}

/**
 * Analyze a Docker Swarm task using HolmesGPT (streaming).
 */
export async function AnalyzeSwarmTaskStream(taskID: string, streamId: string): Promise<void> {
  return await _AnalyzeSwarmTaskStream(taskID, streamId);
}

/**
 * Analyze a Docker Swarm node using HolmesGPT.
 */
export async function AnalyzeSwarmNode(nodeID: string): Promise<HolmesResponse> {
  return await _AnalyzeSwarmNode(nodeID);
}

/**
 * Analyze a Docker Swarm node using HolmesGPT (streaming).
 */
export async function AnalyzeSwarmNodeStream(nodeID: string, streamId: string): Promise<void> {
  return await _AnalyzeSwarmNodeStream(nodeID, streamId);
}

/**
 * Analyze a Docker Swarm stack using HolmesGPT.
 */
export async function AnalyzeSwarmStack(stackName: string): Promise<HolmesResponse> {
  return await _AnalyzeSwarmStack(stackName);
}

/**
 * Analyze a Docker Swarm stack using HolmesGPT (streaming).
 */
export async function AnalyzeSwarmStackStream(stackName: string, streamId: string): Promise<void> {
  return await _AnalyzeSwarmStackStream(stackName, streamId);
}

/**
 * Analyze a resource using HolmesGPT with context.
 */
export async function AnalyzeResource(kind: string, namespace: string, name: string): Promise<HolmesResponse> {
  return await _AnalyzeResource(kind, namespace, name);
}

/**
 * Analyze a pod using HolmesGPT with context (streaming).
 */
export async function AnalyzePodStream(namespace: string, name: string, streamId: string): Promise<void> {
  return await _AnalyzePodStream(namespace, name, streamId);
}

/**
 * Analyze a deployment using HolmesGPT with context (streaming).
 */
export async function AnalyzeDeploymentStream(namespace: string, name: string, streamId: string): Promise<void> {
  return await _AnalyzeDeploymentStream(namespace, name, streamId);
}

/**
 * Analyze a statefulset using HolmesGPT with context (streaming).
 */
export async function AnalyzeStatefulSetStream(namespace: string, name: string, streamId: string): Promise<void> {
  return await _AnalyzeStatefulSetStream(namespace, name, streamId);
}

/**
 * Analyze a daemonset using HolmesGPT with context (streaming).
 */
export async function AnalyzeDaemonSetStream(namespace: string, name: string, streamId: string): Promise<void> {
  return await _AnalyzeDaemonSetStream(namespace, name, streamId);
}

/**
 * Analyze a service using HolmesGPT with context (streaming).
 */
export async function AnalyzeServiceStream(namespace: string, name: string, streamId: string): Promise<void> {
  return await _AnalyzeServiceStream(namespace, name, streamId);
}

/**
 * Analyze a job using HolmesGPT with context (streaming).
 */
export async function AnalyzeJobStream(namespace: string, name: string, streamId: string): Promise<void> {
  return await _AnalyzeJobStream(namespace, name, streamId);
}

/**
 * Analyze a cronjob using HolmesGPT with context (streaming).
 */
export async function AnalyzeCronJobStream(namespace: string, name: string, streamId: string): Promise<void> {
  return await _AnalyzeCronJobStream(namespace, name, streamId);
}

/**
 * Analyze an ingress using HolmesGPT with context (streaming).
 */
export async function AnalyzeIngressStream(namespace: string, name: string, streamId: string): Promise<void> {
  return await _AnalyzeIngressStream(namespace, name, streamId);
}

/**
 * Analyze a configmap using HolmesGPT with context (streaming).
 */
export async function AnalyzeConfigMapStream(namespace: string, name: string, streamId: string): Promise<void> {
  return await _AnalyzeConfigMapStream(namespace, name, streamId);
}

/**
 * Analyze a secret using HolmesGPT with context (streaming).
 */
export async function AnalyzeSecretStream(namespace: string, name: string, streamId: string): Promise<void> {
  return await _AnalyzeSecretStream(namespace, name, streamId);
}

/**
 * Analyze a persistent volume using HolmesGPT with context (streaming).
 */
export async function AnalyzePersistentVolumeStream(name: string, streamId: string): Promise<void> {
  return await _AnalyzePersistentVolumeStream(name, streamId);
}

/**
 * Analyze a persistent volume claim using HolmesGPT with context (streaming).
 */
export async function AnalyzePersistentVolumeClaimStream(namespace: string, name: string, streamId: string): Promise<void> {
  return await _AnalyzePersistentVolumeClaimStream(namespace, name, streamId);
}

/**
 * Analyze a resource using HolmesGPT with context (streaming).
 */
export async function AnalyzeResourceStream(kind: string, namespace: string, name: string, streamId: string): Promise<void> {
  return await _AnalyzeResourceStream(kind, namespace, name, streamId);
}

/**
 * Get the current Holmes configuration (API key is masked)
 */
export async function GetHolmesConfig(): Promise<HolmesConfig> {
  return await _GetHolmesConfig();
}

/**
 * Set the Holmes configuration
 */
export async function SetHolmesConfig(config: HolmesConfig): Promise<void> {
  return await _SetHolmesConfig(config);
}

/**
 * Test the connection to HolmesGPT
 */
export async function TestHolmesConnection(): Promise<HolmesConnectionStatus> {
  return await _TestHolmesConnection();
}

/**
 * Check if HolmesGPT is deployed in the cluster
 */
export async function CheckHolmesDeployment(): Promise<HolmesDeploymentStatus> {
  return await _CheckHolmesDeployment();
}

/**
 * Deploy HolmesGPT to the cluster using Helm
 */
export async function DeployHolmesGPT(request: { openAIKey: string; namespace?: string; releaseName?: string }): Promise<HolmesDeploymentStatus> {
  return await _DeployHolmesGPT(request);
}

/**
 * Undeploy HolmesGPT from the cluster
 */
export async function UndeployHolmesGPT(namespace: string, releaseName: string): Promise<void> {
  return await _UndeployHolmesGPT(namespace, releaseName);
}

/**
 * Subscribe to Holmes deployment status updates
 */
export function onHolmesDeploymentStatus(callback: (_status: HolmesDeploymentStatus) => void): () => void {
  return EventsOn('holmes:deployment:status', callback);
}

/**
 * Subscribe to Holmes chat stream events
 */
export function onHolmesChatStream(callback: (_event: HolmesStreamEvent) => void): () => void {
  return EventsOn('holmes:chat:stream', callback);
}

/**
 * Subscribe to Holmes context progress updates
 */
export function onHolmesContextProgress(callback: (_event: HolmesContextProgressEvent) => void): () => void {
  return EventsOn('holmes:context:progress', callback);
}

/**
 * Reconnect to Holmes by re-establishing the port-forward
 * Use this when connection fails due to DNS errors or port-forward dying
 */
export async function ReconnectHolmes(): Promise<HolmesConnectionStatus> {
  return await _ReconnectHolmes();
}

/**
 * Clear the Holmes configuration (reset to defaults)
 * Useful when redeploying Holmes with new settings
 */
export async function ClearHolmesConfig(): Promise<void> {
  return await _ClearHolmesConfig();
}
