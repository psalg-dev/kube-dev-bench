// Centralized Wails + notification mocks for tests
// Usage: import { createResourceMock, eventsEmitMock, resetAllMocks, appApiMocks } from './wailsMocks';
// Ensure this file is imported before components that import the real modules.
import { vi } from 'vitest';

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
export const appApiMocks = {};

const appFunctionNames = [
  'CreateResource','DeletePod','ExecCommand','GetConfigMaps','GetConnectionStatus','GetCronJobs','GetCurrentConfig','GetDaemonSets','GetDeployments','GetIngresses','GetIngressDetail','GetIngressTLSSummary','GetJobs','GetKubeConfigs','GetKubeContexts','GetKubeContextsFromFile','GetNamespaces','GetOverview','GetPersistentVolumeClaims','GetPersistentVolumes','GetPVCConsumers','ResizePersistentVolumeClaim','GetServiceSummary','GetServices','GetPodContainerLog','GetPodContainerPorts','GetPodContainers','GetPodEvents','GetPodEventsLegacy','GetPodLog','GetPodMounts','GetPodStatusCounts','GetPodSummary','GetPodYAML','GetRememberContext','GetRememberNamespace','GetReplicaSets','GetResourceCounts','GetRunningPods','GetSecretData','GetSecrets','GetStatefulSets','Greet','ListPortForwards','PortForwardPod','PortForwardPodWith','ResizeShellSession','RestartPod','SaveCustomKubeConfig','SavePrimaryKubeConfig','SelectKubeConfigFile','SendShellInput','SetCurrentKubeContext','SetCurrentNamespace','SetKubeConfigPath','SetPreferredNamespaces','SetRememberContext','SetRememberNamespace','ShellPod','StartCronJobPolling','StartDaemonSetPolling','StartDeploymentPolling','StartPodExecSession','StartPodPolling','StartReplicaSetPolling','StartShellSession','StartStatefulSetPolling','Startup','StopPodLogs','StopPortForward','StopShellSession','StreamPodContainerLogs','StreamPodLogs',
  // Proxy functions
  'GetProxyConfig','SetProxyConfig','DetectSystemProxy','ClearProxyConfig',
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
  'AskHolmes','AskHolmesStream','AnalyzePod','AnalyzeDeployment','AnalyzeStatefulSet','AnalyzeDaemonSet','AnalyzeService','AnalyzeResource','GetHolmesConfig','SetHolmesConfig','TestHolmesConnection','CheckHolmesDeployment','DeployHolmesGPT','UndeployHolmesGPT'
];

vi.mock('../../wailsjs/go/main/App', () => {
  const exports = {};
  for (const name of appFunctionNames) {
    if (name === 'CreateResource') {
      exports[name] = (...args) => createResourceMock(...args);
    } else if (name === 'CreateSwarmConfig') {
      exports[name] = (...args) => createSwarmConfigMock(...args);
    } else if (name === 'CreateSwarmSecret') {
      exports[name] = (...args) => createSwarmSecretMock(...args);
    } else if (name === 'CreateSwarmService') {
      exports[name] = (...args) => createSwarmServiceMock(...args);
    } else if (name === 'CreateSwarmStack') {
      exports[name] = (...args) => createSwarmStackMock(...args);
    } else if (name === 'UpdateSwarmNodeAvailability') {
      exports[name] = (...args) => updateSwarmNodeAvailabilityMock(...args);
    } else if (name === 'UpdateSwarmNodeRole') {
      exports[name] = (...args) => updateSwarmNodeRoleMock(...args);
    } else if (name === 'UpdateSwarmNodeLabels') {
      exports[name] = (...args) => updateSwarmNodeLabelsMock(...args);
    } else {
      const fn = (...args) => genericAPIMock(name, ...args);
      appApiMocks[name] = fn;
      exports[name] = fn;
    }
  }
  return exports;
});

// Mock Wails runtime EventsEmit and EventsOn
vi.mock('../../wailsjs/runtime', () => ({
  EventsEmit: (...args) => eventsEmitMock(...args),
}));

vi.mock('../../wailsjs/runtime/runtime.js', () => ({
  EventsOn: (...args) => eventsOnMock(...args),
  EventsEmit: (...args) => eventsEmitMock(...args),
}));

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
  Object.values(appApiMocks).forEach((m) => m.mock && m.mockReset && m.mockReset());
}
