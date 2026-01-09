// Thin service layer wrapping Wails-generated backend functions for Docker Swarm.
// This creates a single import surface so future concerns (logging, retry, normalization)
// can be added without touching many UI files.

import {
  // Connection
  GetDockerConnectionStatus,
  ConnectToDocker,
  TestDockerConnection,
  DisconnectDocker,
  GetDockerConfig,
  AutoConnectDocker,
  GetDefaultDockerHost,
  
  // Services
  GetSwarmServices,
  GetSwarmService,
  ScaleSwarmService,
  RemoveSwarmService,
  UpdateSwarmServiceImage,
  RestartSwarmService,
  
  // Tasks
  GetSwarmTasks,
  GetSwarmTasksByService,
  GetSwarmTask,
  GetSwarmTaskHealthLogs,
  
  // Nodes
  GetSwarmNodes,
  GetSwarmNode,
  UpdateSwarmNodeAvailability,
  UpdateSwarmNodeRole,
  UpdateSwarmNodeLabels,
  GetSwarmNodeTasks,
  RemoveSwarmNode,
  
  // Networks
  GetSwarmNetworks,
  GetSwarmNetwork,
  GetSwarmNetworkServices,
  GetSwarmNetworkContainers,
  GetSwarmNetworkInspectJSON,
  RemoveSwarmNetwork,
  
  // Configs
  GetSwarmConfigs,
  GetSwarmConfig,
  GetSwarmConfigData,
  GetSwarmConfigUsage,
  GetSwarmConfigInspectJSON,
  CreateSwarmConfig,
  CloneSwarmConfig,
  ExportSwarmConfig,
  UpdateSwarmConfigData,
  RemoveSwarmConfig,
  
  // Secrets
  GetSwarmSecrets,
  GetSwarmSecret,
  GetSwarmSecretUsage,
  GetSwarmSecretInspectJSON,
  CreateSwarmSecret,
  CloneSwarmSecret,
  UpdateSwarmSecretData,
  RemoveSwarmSecret,
  
  // Stacks
  GetSwarmStacks,
  GetSwarmStackServices,
  GetSwarmStackResources,
  GetSwarmStackComposeYAML,
  RollbackSwarmStack,
  RemoveSwarmStack,
  CreateSwarmStack,
  
  // Volumes
  GetSwarmVolumes,
  GetSwarmVolume,
  GetVolumeInfo,
  GetSwarmVolumeUsage,
  GetSwarmVolumeInspectJSON,
  BackupSwarmVolume,
  RestoreSwarmVolume,
  CloneSwarmVolume,
  DownloadFromSwarmVolume,
  UploadToSwarmVolume,
  WriteSwarmVolumeFile,
  DeleteSwarmVolumeFile,
  CreateSwarmVolumeDirectory,
  ListSwarmVolumeFiles,
  GetSwarmVolumeFileContent,
  IsSwarmVolumeReadOnly,
  RemoveSwarmVolume,
  
  // Logs
  GetSwarmServiceLogs,
  GetSwarmTaskLogs,
  
  // Resource counts
  GetSwarmResourceCounts,

  // Registries
  GetRegistries,
  AddRegistry,
  RemoveRegistry,
  TestRegistryConnection,
  ListRegistryRepositories,
  ListRegistryTags,
  GetImageDigest,

  // Docker Hub integration
  SearchDockerHubRepositories,
  GetDockerHubRepositoryDetails,
  PullDockerImageLatest,
} from '../../wailsjs/go/main/App';

// Direct re-exports
export {
  // Connection
  GetDockerConnectionStatus,
  ConnectToDocker,
  TestDockerConnection,
  DisconnectDocker,
  GetDockerConfig,
  AutoConnectDocker,
  GetDefaultDockerHost,
  
  // Services
  GetSwarmServices,
  GetSwarmService,
  ScaleSwarmService,
  RemoveSwarmService,
  UpdateSwarmServiceImage,
  RestartSwarmService,
  
  // Tasks
  GetSwarmTasks,
  GetSwarmTasksByService,
  GetSwarmTask,
  GetSwarmTaskHealthLogs,
  
  // Nodes
  GetSwarmNodes,
  GetSwarmNode,
  UpdateSwarmNodeAvailability,
  UpdateSwarmNodeRole,
  UpdateSwarmNodeLabels,
  GetSwarmNodeTasks,
  RemoveSwarmNode,
  
  // Networks
  GetSwarmNetworks,
  GetSwarmNetwork,
  GetSwarmNetworkServices,
  GetSwarmNetworkContainers,
  GetSwarmNetworkInspectJSON,
  RemoveSwarmNetwork,
  
  // Configs
  GetSwarmConfigs,
  GetSwarmConfig,
  GetSwarmConfigData,
  GetSwarmConfigUsage,
  GetSwarmConfigInspectJSON,
  CreateSwarmConfig,
  CloneSwarmConfig,
  ExportSwarmConfig,
  UpdateSwarmConfigData,
  RemoveSwarmConfig,
  
  // Secrets
  GetSwarmSecrets,
  GetSwarmSecret,
  GetSwarmSecretUsage,
  GetSwarmSecretInspectJSON,
  CreateSwarmSecret,
  CloneSwarmSecret,
  UpdateSwarmSecretData,
  RemoveSwarmSecret,
  
  // Stacks
  GetSwarmStacks,
  GetSwarmStackServices,
  GetSwarmStackResources,
  GetSwarmStackComposeYAML,
  RollbackSwarmStack,
  RemoveSwarmStack,
  CreateSwarmStack,
  
  // Volumes
  GetSwarmVolumes,
  GetSwarmVolume,
  GetVolumeInfo,
  GetSwarmVolumeUsage,
  GetSwarmVolumeInspectJSON,
  BackupSwarmVolume,
  RestoreSwarmVolume,
  CloneSwarmVolume,
  DownloadFromSwarmVolume,
  UploadToSwarmVolume,
  WriteSwarmVolumeFile,
  DeleteSwarmVolumeFile,
  CreateSwarmVolumeDirectory,
  ListSwarmVolumeFiles,
  GetSwarmVolumeFileContent,
  IsSwarmVolumeReadOnly,
  RemoveSwarmVolume,
  
  // Logs
  GetSwarmServiceLogs,
  GetSwarmTaskLogs,
  
  // Resource counts
  GetSwarmResourceCounts,

  // Registries
  GetRegistries,
  AddRegistry,
  RemoveRegistry,
  TestRegistryConnection,
  ListRegistryRepositories,
  ListRegistryTags,
  GetImageDigest,

  // Docker Hub integration
  SearchDockerHubRepositories,
  GetDockerHubRepositoryDetails,
  PullDockerImageLatest,
};
