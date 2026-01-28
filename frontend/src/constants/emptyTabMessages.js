/**
 * Empty tab messages configuration.
 * Defines icon, title, description, and tip for each empty tab type.
 */

export const emptyTabMessages = {
  // Kubernetes messages
  events: {
    icon: 'events',
    title: 'No events yet',
    description: 'No events have been recorded for this resource.',
    tip: 'Events appear when Kubernetes performs actions like scheduling, pulling images, or detecting issues.',
  },
  pods: {
    icon: 'pods',
    title: 'No pods running',
    description: 'No pods are currently associated with this resource.',
    tip: 'Pods will appear here once the workload starts creating them.',
  },
  consumers: {
    icon: 'consumers',
    title: 'No consumers found',
    description: 'This resource is not currently used by any workloads.',
    tip: 'Workloads (Deployments, StatefulSets, etc.) that reference this resource will appear here.',
  },
  endpoints: {
    icon: 'endpoints',
    title: 'No endpoints available',
    description: 'No endpoints are currently available for this service.',
    tip: 'Endpoints appear when pods matching the service selector are running and ready.',
  },
  history: {
    icon: 'history',
    title: 'No job history',
    description: 'No jobs have been executed by this CronJob yet.',
    tip: 'Jobs will appear here after the CronJob runs according to its schedule.',
  },
  rules: {
    icon: 'rules',
    title: 'No ingress rules',
    description: 'No routing rules are configured for this ingress.',
    tip: 'Add rules to define how traffic should be routed to your services.',
  },
  pvcs: {
    icon: 'pvcs',
    title: 'No volume claims',
    description:
      'No persistent volume claims are associated with this resource.',
    tip: 'Volume claims will appear when the workload requests persistent storage.',
  },
  data: {
    icon: 'data',
    title: 'No data',
    description: 'This resource contains no data entries.',
    tip: 'Add key-value pairs to store configuration data.',
  },

  // Swarm services and tasks messages
  'swarm-services': {
    icon: '🐳',
    title: 'No services found',
    description: 'No Swarm services are currently running.',
    tip: 'Deploy a stack or create a service to see it here.',
  },
  'swarm-tasks': {
    icon: '📦',
    title: 'No tasks running',
    description: 'No tasks are currently running for this resource.',
    tip: 'Tasks appear when services schedule containers on nodes.',
  },
  'swarm-stack-services': {
    icon: '🐳',
    title: 'No services in this stack',
    description: 'This stack has no services deployed.',
    tip: 'Update the stack compose file to add services.',
  },

  // Swarm network-related messages
  'swarm-connected-services': {
    icon: '🌐',
    title: 'No services attached',
    description: 'No services are currently connected to this network.',
    tip: 'Services join networks when specified in their configuration.',
  },
  'swarm-containers': {
    icon: '🐋',
    title: 'No containers attached',
    description: 'No containers are currently attached to this network.',
    tip: 'Containers attach to networks when their tasks are scheduled.',
  },
  'swarm-options': {
    icon: '⚙️',
    title: 'No driver options',
    description: 'No driver-specific options are configured for this network.',
    tip: 'Driver options can be set when creating the network.',
  },
  'swarm-ipam': {
    icon: '🌐',
    title: 'No IPAM configuration',
    description: 'No IP Address Management configuration is set.',
    tip: 'IPAM settings control subnet and IP allocation for the network.',
  },

  // Swarm stack resource messages
  'swarm-stack-networks': {
    icon: '🌐',
    title: 'No networks found',
    description: 'This stack has no networks defined.',
    tip: 'Add network definitions to your compose file to create stack networks.',
  },
  'swarm-stack-volumes': {
    icon: '💾',
    title: 'No volumes found',
    description: 'This stack has no volumes defined.',
    tip: 'Add volume definitions to your compose file for persistent storage.',
  },
  'swarm-stack-configs': {
    icon: '⚙️',
    title: 'No configs found',
    description: 'This stack has no configs defined.',
    tip: 'Use configs to store non-sensitive configuration data.',
  },
  'swarm-stack-secrets': {
    icon: '🔐',
    title: 'No secrets found',
    description: 'This stack has no secrets defined.',
    tip: 'Use secrets to store sensitive data like passwords and API keys.',
  },

  // Swarm "Used By" messages
  'swarm-config-usedby': {
    icon: '🔗',
    title: 'Not in use',
    description: 'No services currently reference this config.',
    tip: 'Services will appear here when they mount this config.',
  },
  'swarm-secret-usedby': {
    icon: '🔗',
    title: 'Not in use',
    description: 'No services currently reference this secret.',
    tip: 'Services will appear here when they mount this secret.',
  },
  'swarm-volume-usedby': {
    icon: '🔗',
    title: 'Not in use',
    description: 'No services currently reference this volume.',
    tip: 'Services will appear here when they mount this volume.',
  },

  // Swarm task unavailable messages
  'swarm-task-logs': {
    icon: '📜',
    title: 'Logs unavailable',
    description: 'No container is associated with this task yet.',
    tip: 'Logs become available once the task has a running container.',
  },
  'swarm-task-exec': {
    icon: '💻',
    title: 'Exec unavailable',
    description: 'Cannot execute commands in this task.',
    tip: 'Exec requires a running container. Check the task state.',
  },

  // Swarm node messages
  'swarm-node-logs': {
    icon: '📜',
    title: 'No logs available',
    description: 'No task logs are available for this node.',
    tip: 'Node logs show task output from containers running on this node.',
  },
  'swarm-node-tasks': {
    icon: '📦',
    title: 'No tasks on this node',
    description: 'No tasks are currently scheduled on this node.',
    tip: 'Tasks appear when services schedule containers on this node.',
  },

  // Swarm summary empty list messages
  'swarm-no-env': {
    icon: '📝',
    title: 'No environment variables',
    description: 'No environment variables are configured.',
    tip: 'Environment variables can be set in the service specification.',
  },
  'swarm-no-mounts': {
    icon: '💾',
    title: 'No mounts configured',
    description: 'No volume mounts are configured for this service.',
    tip: 'Mounts provide persistent or shared storage for containers.',
  },
  'swarm-no-ports': {
    icon: '🔌',
    title: 'No ports published',
    description: 'No ports are published for this service.',
    tip: 'Publish ports to expose the service externally.',
  },
  'swarm-no-constraints': {
    icon: '📐',
    title: 'No placement constraints',
    description: 'No placement constraints are configured.',
    tip: 'Constraints control which nodes can run this service.',
  },
};

/**
 * Get empty tab message for a specific tab type.
 * @param {string} tabType - The type of tab (events, pods, consumers, etc.)
 * @returns {Object} The message configuration or a default message
 */
export function getEmptyTabMessage(tabType) {
  return (
    emptyTabMessages[tabType] || {
      icon: 'default',
      title: 'No data',
      description: 'No items found for this tab.',
      tip: '',
    }
  );
}

/**
 * Get empty tab message for Swarm-specific tab types.
 * Convenience wrapper that prefixes 'swarm-' to the tab type if not already present.
 * @param {string} tabType - The type of tab (e.g., 'services', 'tasks', 'config-usedby')
 * @returns {Object} The message configuration or a default message
 */
export function getSwarmEmptyTabMessage(tabType) {
  // If already prefixed with 'swarm-', use as-is
  if (tabType && tabType.startsWith('swarm-')) {
    return getEmptyTabMessage(tabType);
  }
  // Otherwise, try with 'swarm-' prefix first, then fall back to regular lookup
  const swarmKey = `swarm-${tabType}`;
  if (emptyTabMessages[swarmKey]) {
    return emptyTabMessages[swarmKey];
  }
  return getEmptyTabMessage(tabType);
}

export default emptyTabMessages;
