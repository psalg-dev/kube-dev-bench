/**
 * Bulk action definitions for Kubernetes and Docker Swarm resources.
 * Each action definition includes: key, label, icon, danger flag, and optional promptReplicas flag.
 */

// Kubernetes bulk actions by resource kind
export const K8S_BULK_ACTIONS = {
  deployment: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true },
    { key: 'restart', label: 'Restart', icon: '🔄' },
    { key: 'scale', label: 'Scale', icon: '📏', promptReplicas: true },
  ],
  statefulset: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true },
    { key: 'restart', label: 'Restart', icon: '🔄' },
    { key: 'scale', label: 'Scale', icon: '📏', promptReplicas: true },
  ],
  daemonset: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true },
    { key: 'restart', label: 'Restart', icon: '🔄' },
  ],
  replicaset: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true },
    { key: 'scale', label: 'Scale', icon: '📏', promptReplicas: true },
  ],
  pod: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true },
    { key: 'restart', label: 'Restart', icon: '🔄' },
  ],
  cronjob: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true },
    { key: 'suspend', label: 'Suspend', icon: '⏸️' },
    { key: 'resume', label: 'Resume', icon: '▶️' },
  ],
  job: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true },
  ],
  configmap: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true },
  ],
  secret: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true },
  ],
  persistentvolumeclaim: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true },
  ],
  persistentvolume: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true },
  ],
  ingress: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true },
  ],
  service: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true },
  ],
  helmrelease: [
    { key: 'delete', label: 'Uninstall', icon: '🗑️', danger: true },
  ],
};

// Docker Swarm bulk actions by resource kind
export const SWARM_BULK_ACTIONS = {
  service: [
    { key: 'delete', label: 'Remove', icon: '🗑️', danger: true },
    { key: 'restart', label: 'Restart', icon: '🔄' },
    { key: 'scale', label: 'Scale', icon: '📏', promptReplicas: true },
  ],
  task: [
    { key: 'delete', label: 'Remove', icon: '🗑️', danger: true },
  ],
  node: [
    { key: 'delete', label: 'Remove', icon: '🗑️', danger: true },
    { key: 'drain', label: 'Drain', icon: '🚫' },
    { key: 'pause', label: 'Pause', icon: '⏸️' },
    { key: 'activate', label: 'Activate', icon: '✅' },
  ],
  network: [
    { key: 'delete', label: 'Remove', icon: '🗑️', danger: true },
  ],
  config: [
    { key: 'delete', label: 'Remove', icon: '🗑️', danger: true },
  ],
  secret: [
    { key: 'delete', label: 'Remove', icon: '🗑️', danger: true },
  ],
  volume: [
    { key: 'delete', label: 'Remove', icon: '🗑️', danger: true },
  ],
  stack: [
    { key: 'delete', label: 'Remove', icon: '🗑️', danger: true },
  ],
};

/**
 * Get bulk actions for a resource kind.
 * @param {string} platform - 'k8s' or 'swarm'
 * @param {string} kind - Resource kind (lowercase)
 * @returns {Array} Array of action definitions
 */
export function getBulkActions(platform, kind) {
  const normalizedKind = kind?.toLowerCase();
  if (platform === 'swarm') {
    return SWARM_BULK_ACTIONS[normalizedKind] || [];
  }
  return K8S_BULK_ACTIONS[normalizedKind] || [];
}

/**
 * Check if a resource kind supports bulk actions.
 * @param {string} platform - 'k8s' or 'swarm'
 * @param {string} kind - Resource kind (lowercase)
 * @returns {boolean}
 */
export function hasBulkActions(platform, kind) {
  return getBulkActions(platform, kind).length > 0;
}

/**
 * Get a specific bulk action definition.
 * @param {string} platform - 'k8s' or 'swarm'
 * @param {string} kind - Resource kind (lowercase)
 * @param {string} actionKey - Action key (e.g., 'delete', 'restart')
 * @returns {Object|undefined} Action definition
 */
export function getBulkAction(platform, kind, actionKey) {
  const actions = getBulkActions(platform, kind);
  return actions.find(a => a.key === actionKey);
}
