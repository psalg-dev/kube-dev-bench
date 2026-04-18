// Centralized Wails + notification mocks for tests
// Usage: import { createResourceMock, eventsEmitMock, resetAllMocks, appApiMocks } from './wailsMocks';
// Ensure this file is imported before components that import the real modules.
import { vi, type Mock } from 'vitest';

export const createResourceMock = vi.fn();
export const eventsEmitMock = vi.fn();
export const eventsOnMock = vi.fn();
export const createSwarmConfigMock = vi.fn();
export const createSwarmSecretMock = vi.fn();
export const createSwarmServiceMock = vi.fn();
export const createSwarmStackMock = vi.fn();
export const updateSwarmNodeAvailabilityMock = vi.fn();
export const updateSwarmNodeRoleMock = vi.fn();
export const updateSwarmNodeLabelsMock = vi.fn();

// Generic mock for other App API functions to avoid individual test failures.
// Note: Vitest is configured with restoreMocks=true, so we must provide a stable
// default implementation (mockResolvedValue can be wiped by restore).
export const genericAPIMock = vi.fn(() => Promise.resolve(undefined));

// Keep a registry of all App API mocks (except CreateResource which has its own)
export const appApiMocks: Record<string, Mock> = {};
const appFunctionNames = [
  'CreateResource','DeletePod','DeleteResource','ExecCommand','GetConfigMaps','GetConnectionStatus','GetCronJobs','GetCurrentConfig','GetDaemonSets','GetDeployments','GetIngresses','GetIngressDetail','GetIngressTLSSummary','GetJobs','GetKubeConfigs','GetKubeContexts','GetKubeContextsFromFile','GetNamespaces','GetOverview','GetPersistentVolumeClaims','GetPersistentVolumes','GetPVCConsumers','GetRoles','GetClusterRoles','GetRoleBindings','GetClusterRoleBindings','ResizePersistentVolumeClaim','GetServiceSummary','GetServices','GetPodContainerLog','GetPodContainerPorts','GetPodContainers','GetPodEvents','GetPodEventsLegacy','GetPodLog','GetPodMounts','GetPodStatusCounts','GetPodSummary','GetPodYAML','GetRememberContext','GetRememberNamespace','GetUseInformers','GetReplicaSets','GetResourceCounts','GetResourceGraph','GetNamespaceGraph','GetStorageGraph','GetNetworkPolicyGraph','GetRunningPods','GetSecretData','GetSecrets','GetStatefulSets','Greet','ListPortForwards','PortForwardPod','PortForwardPodWith','ResizeShellSession','RestartPod','SaveCustomKubeConfig','SavePrimaryKubeConfig','SelectKubeConfigFile','SendShellInput','SetCurrentKubeContext','SetCurrentNamespace','SetKubeConfigPath','SetPreferredNamespaces','SetRememberContext','SetRememberNamespace','SetUseInformers','ShellPod','StartCronJobPolling','StartDaemonSetPolling','StartDeploymentPolling','StartPodExecSession','StartPodPolling','StartReplicaSetPolling','StartShellSession','StartStatefulSetPolling','Startup','StopPodLogs','StopPortForward','StopShellSession','StreamPodContainerLogs','StreamPodLogs',
  // Proxy functions
  'GetProxyConfig','SetProxyConfig','DetectSystemProxy','ClearProxyConfig',
  // Custom CA
  'GetCustomCAPath','SetCustomCAPath',
  // Hooks functions
  'GetHooksConfig','SaveHook','DeleteHook','TestHook','SelectHookScript',
  // Docker / Swarm functions
  'GetDockerConnectionStatus','ConnectToDocker','TestDockerConnection','DisconnectDocker','GetDockerConfig','AutoConnectDocker','GetDefaultDockerHost',
  'GetSwarmServices','GetSwarmService','ScaleSwarmService','RemoveSwarmService','UpdateSwarmServiceImage','RestartSwarmService',
  'GetSwarmTasks','GetSwarmTasksByService','GetSwarmTask',
  'StartSwarmTaskExecSession',
  'GetSwarmNodes','GetSwarmNode','UpdateSwarmNodeAvailability','UpdateSwarmNodeRole','UpdateSwarmNodeLabels','GetSwarmNodeTasks','RemoveSwarmNode',
  'GetSwarmNetworks','GetSwarmNetwork','RemoveSwarmNetwork',
  'GetSwarmNetworkServices','GetSwarmNetworkContainers','GetSwarmNetworkInspectJSON',
  'GetSwarmConfigs','GetSwarmConfig','GetSwarmConfigData','GetSwarmConfigUsage','GetSwarmConfigInspectJSON','UpdateSwarmConfigData','CreateSwarmConfig','CloneSwarmConfig','ExportSwarmConfig','RemoveSwarmConfig',
  'GetSwarmSecrets','GetSwarmSecret','GetSwarmSecretUsage','GetSwarmSecretInspectJSON','UpdateSwarmSecretData','CreateSwarmSecret','CloneSwarmSecret','RemoveSwarmSecret',
  'GetSwarmStacks','GetSwarmStackServices','GetSwarmStackResources','GetSwarmStackComposeYAML','RollbackSwarmStack','RemoveSwarmStack',
  'GetSwarmVolumes','GetSwarmVolume','GetSwarmVolumeUsage','GetSwarmVolumeInspectJSON','DownloadFromSwarmVolume','UploadToSwarmVolume','WriteSwarmVolumeFile','DeleteSwarmVolumeFile','CreateSwarmVolumeDirectory','RemoveSwarmVolume',
  'ListSwarmVolumeFiles','GetSwarmVolumeFileContent','IsSwarmVolumeReadOnly',
  'GetVolumeInfo',
  'BackupSwarmVolume','RestoreSwarmVolume','CloneSwarmVolume',
  'CreateSwarmService','CreateSwarmStack','CreateSwarmNetwork','CreateSwarmVolume',
  'GetSwarmServiceLogs','GetSwarmTaskLogs',
  'GetSwarmResourceCounts',
  // Registry Integration
  'GetRegistries','AddRegistry','RemoveRegistry','TestRegistryConnection','ListRegistryRepositories','ListRegistryTags','GetImageDigest',
  // Helm functions
  'GetHelmReleases','GetHelmRepositories','AddHelmRepository','RemoveHelmRepository','UpdateHelmRepositories','SearchHelmCharts','GetHelmChartVersions','InstallHelmChart','UpgradeHelmRelease','UninstallHelmRelease','RollbackHelmRelease','GetHelmReleaseHistory','GetHelmReleaseValues','GetHelmReleaseManifest','GetHelmReleaseNotes','StartHelmReleasePolling',
  // Holmes AI functions
  'AskHolmes','AskHolmesStream','AnalyzePod','AnalyzeDeployment','AnalyzeStatefulSet','AnalyzeDaemonSet','AnalyzeService','AnalyzeResource','GetHolmesConfig','SetHolmesConfig','TestHolmesConnection','CheckHolmesDeployment','DeployHolmesGPT','UndeployHolmesGPT',
  // Monitor enhancements
  'ScanClusterHealth','AnalyzeMonitorIssue','AnalyzeMonitorIssueStream','AnalyzeAllMonitorIssues','DismissMonitorIssue','SaveMonitorIssueAnalysis','GetDismissedIssues',
  // Prometheus alerts
  'GetPrometheusAlerts','InvestigatePrometheusAlert','GetAlertInvestigationHistory',
  // Enterprise auth (Gaps 2-7)
  'ConnectInsecure','RefreshCredentials','GetKubeconfigPaths','SetKubeconfigPaths','DetectKubeconfigEnvPaths','SetSessionProbeInterval','GetSessionProbeInterval'
];

vi.mock('../../wailsjs/go/main/App', () => {
  const exports: Record<string, (..._args: unknown[]) => unknown> = {};
  for (const name of appFunctionNames) {
    if (name === 'CreateResource') {
      exports[name] = (...args: unknown[]) => createResourceMock(...args);
    } else if (name === 'CreateSwarmConfig') {
      exports[name] = (...args: unknown[]) => createSwarmConfigMock(...args);
    } else if (name === 'CreateSwarmSecret') {
      exports[name] = (...args: unknown[]) => createSwarmSecretMock(...args);
    } else if (name === 'CreateSwarmService') {
      exports[name] = (...args: unknown[]) => createSwarmServiceMock(...args);
    } else if (name === 'CreateSwarmStack') {
      exports[name] = (...args: unknown[]) => createSwarmStackMock(...args);
    } else if (name === 'UpdateSwarmNodeAvailability') {
      exports[name] = (...args: unknown[]) => updateSwarmNodeAvailabilityMock(...args);
    } else if (name === 'UpdateSwarmNodeRole') {
      exports[name] = (...args: unknown[]) => updateSwarmNodeRoleMock(...args);
    } else if (name === 'UpdateSwarmNodeLabels') {
      exports[name] = (...args: unknown[]) => updateSwarmNodeLabelsMock(...args);
    } else {
      const fn = vi.fn((...args: unknown[]) => genericAPIMock(name, ...args));
      appApiMocks[name] = fn;
      exports[name] = fn;
    }
  }
  return exports;
});

// Mock Wails runtime EventsEmit and EventsOn
vi.mock('../../wailsjs/runtime', () => ({
  EventsOn: (...args: unknown[]) => eventsOnMock(...args),
  EventsEmit: (...args: unknown[]) => eventsEmitMock(...args),
}));

vi.mock('../../wailsjs/runtime/runtime.js', () => ({
  EventsOn: (...args: unknown[]) => eventsOnMock(...args),
  EventsEmit: (...args: unknown[]) => eventsEmitMock(...args),
}));

// Provide a minimal Wails binding for tests that gate on window.go.* availability.
if (typeof window !== 'undefined') {
  const win = window as unknown as { go?: { main?: { App?: Record<string, unknown> } } };
  const go = win.go ?? (win.go = { main: { App: {} as Record<string, unknown> } });
  const main = go.main ?? (go.main = { App: {} as Record<string, unknown> });
  const app = main.App ?? (main.App = {} as Record<string, unknown>);
  if (!('GetResourceCounts' in app)) {
    app.GetResourceCounts = vi.fn(() => Promise.resolve(undefined));
  }
}

export function resetAllMocks() {
  createResourceMock.mockReset();
  createSwarmConfigMock.mockReset();
  createSwarmSecretMock.mockReset();
  createSwarmServiceMock.mockReset();
  createSwarmStackMock.mockReset();
  updateSwarmNodeAvailabilityMock.mockReset();
  updateSwarmNodeRoleMock.mockReset();
  updateSwarmNodeLabelsMock.mockReset();
  eventsEmitMock.mockReset();
  eventsOnMock.mockReset();
  genericAPIMock.mockReset();
  genericAPIMock.mockImplementation(() => Promise.resolve(undefined));
  Object.entries(appApiMocks).forEach(([name, mockFn]) => {
    if (mockFn && mockFn.mockReset) {
      mockFn.mockReset();
      mockFn.mockImplementation((...args: unknown[]) => genericAPIMock(name, ...args));
    }
  });
}

// Helper to trigger runtime EventsOn callbacks that tests registered via EventsOn
export function triggerRuntimeEvent(name, ...args) {
  const calls = eventsOnMock.mock && eventsOnMock.mock.calls ? eventsOnMock.mock.calls : [];
  for (const call of calls) {
    if (call && call[0] === name && typeof call[1] === 'function') {
      try { call[1](...args); } catch (e) { /* ignore errors in test trigger */ }
    }
  }
}

// Helper to simulate EventsEmit calls
export function emitRuntimeEvent(name, ...args) {
  eventsEmitMock(name, ...args);
}

