// Centralized Wails + notification mocks for tests
// Usage: import { createResourceMock, eventsEmitMock, resetAllMocks, appApiMocks } from './wailsMocks';
// Ensure this file is imported before components that import the real modules.
import { vi } from 'vitest';

export const createResourceMock = vi.fn();
export const eventsEmitMock = vi.fn();
export const eventsOnMock = vi.fn();

// Generic mock for other App API functions to avoid individual test failures
export const genericAPIMock = vi.fn().mockResolvedValue(undefined);

// Keep a registry of all App API mocks (except CreateResource which has its own)
export const appApiMocks = {};

const appFunctionNames = [
  'CreateResource','DeletePod','ExecCommand','GetConfigMaps','GetConnectionStatus','GetCronJobs','GetCurrentConfig','GetDaemonSets','GetDeployments','GetIngresses','GetJobs','GetKubeConfigs','GetKubeContexts','GetKubeContextsFromFile','GetNamespaces','GetOverview','GetPersistentVolumeClaims','GetPersistentVolumes','GetPodContainerLog','GetPodContainerPorts','GetPodContainers','GetPodEvents','GetPodEventsLegacy','GetPodLog','GetPodMounts','GetPodStatusCounts','GetPodSummary','GetPodYAML','GetRememberContext','GetRememberNamespace','GetReplicaSets','GetResourceCounts','GetRunningPods','GetSecretData','GetSecrets','GetStatefulSets','Greet','ListPortForwards','PortForwardPod','PortForwardPodWith','ResizeShellSession','RestartPod','SaveCustomKubeConfig','SavePrimaryKubeConfig','SelectKubeConfigFile','SendShellInput','SetCurrentKubeContext','SetCurrentNamespace','SetKubeConfigPath','SetPreferredNamespaces','SetRememberContext','SetRememberNamespace','ShellPod','StartCronJobPolling','StartDaemonSetPolling','StartDeploymentPolling','StartPodExecSession','StartPodPolling','StartReplicaSetPolling','StartShellSession','StartStatefulSetPolling','Startup','StopPodLogs','StopPortForward','StopShellSession','StreamPodContainerLogs','StreamPodLogs'
];

vi.mock('../../wailsjs/go/main/App', () => {
  const exports = {};
  for (const name of appFunctionNames) {
    if (name === 'CreateResource') {
      exports[name] = (...args) => createResourceMock(...args);
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
  eventsEmitMock.mockReset();
  eventsOnMock.mockReset();
  genericAPIMock.mockReset();
  Object.values(appApiMocks).forEach((m) => m.mock && m.mockReset && m.mockReset());
}
