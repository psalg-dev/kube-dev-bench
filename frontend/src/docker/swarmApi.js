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
  
  // Nodes
  GetSwarmNodes,
  GetSwarmNode,
  UpdateSwarmNodeAvailability,
  GetSwarmNodeTasks,
  RemoveSwarmNode,
  
  // Networks
  GetSwarmNetworks,
  GetSwarmNetwork,
  RemoveSwarmNetwork,
  
  // Configs
  GetSwarmConfigs,
  GetSwarmConfig,
  GetSwarmConfigData,
  CreateSwarmConfig,
  RemoveSwarmConfig,
  
  // Secrets
  GetSwarmSecrets,
  GetSwarmSecret,
  CreateSwarmSecret,
  RemoveSwarmSecret,
  
  // Stacks
  GetSwarmStacks,
  GetSwarmStackServices,
  RemoveSwarmStack,
  
  // Volumes
  GetSwarmVolumes,
  GetSwarmVolume,
  RemoveSwarmVolume,
  
  // Logs
  GetSwarmServiceLogs,
  GetSwarmTaskLogs,
  
  // Resource counts
  GetSwarmResourceCounts,
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
  
  // Nodes
  GetSwarmNodes,
  GetSwarmNode,
  UpdateSwarmNodeAvailability,
  GetSwarmNodeTasks,
  RemoveSwarmNode,
  
  // Networks
  GetSwarmNetworks,
  GetSwarmNetwork,
  RemoveSwarmNetwork,
  
  // Configs
  GetSwarmConfigs,
  GetSwarmConfig,
  GetSwarmConfigData,
  CreateSwarmConfig,
  RemoveSwarmConfig,
  
  // Secrets
  GetSwarmSecrets,
  GetSwarmSecret,
  CreateSwarmSecret,
  RemoveSwarmSecret,
  
  // Stacks
  GetSwarmStacks,
  GetSwarmStackServices,
  RemoveSwarmStack,
  
  // Volumes
  GetSwarmVolumes,
  GetSwarmVolume,
  RemoveSwarmVolume,
  
  // Logs
  GetSwarmServiceLogs,
  GetSwarmTaskLogs,
  
  // Resource counts
  GetSwarmResourceCounts,
};
