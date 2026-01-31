import * as AppAPI from '../../wailsjs/go/main/App';

/**
 * Execute a bulk operation.
 * @param {string} platform - 'k8s' or 'swarm'
 * @param {string} actionKey - Action key (e.g., 'delete', 'restart', 'scale')
 * @param {Array} selectedRows - Array of selected row objects
 * @param {Object} options - Additional options (e.g., { replicas: 3, resourceKind: 'deployment' })
 * @returns {Promise<Object>} BulkOperationResponse { results, successCount, errorCount }
 */
export async function executeBulkAction(platform, actionKey, selectedRows, options = {}) {
  if (!selectedRows || selectedRows.length === 0) {
    return { results: [], successCount: 0, errorCount: 0 };
  }

  const { replicas, resourceKind, availability } = options;

  if (platform === 'swarm') {
    return executeSwarmBulkAction(actionKey, selectedRows, { replicas, resourceKind, availability });
  }

  return executeK8sBulkAction(actionKey, selectedRows, { replicas, resourceKind });
}

/**
 * Execute a Kubernetes bulk operation.
 */
async function executeK8sBulkAction(actionKey, selectedRows, options = {}) {
  const { replicas, resourceKind } = options;

  // Transform rows to BulkOperationItem format
  const items = selectedRows.map(row => ({
    kind: resourceKind || row.kind || row.Kind || 'unknown',
    name: row.name || row.Name,
    namespace: row.namespace || row.Namespace || '',
  }));

  switch (actionKey) {
    case 'delete':
      return AppAPI.BulkDeleteResources(items);
    case 'restart':
      return AppAPI.BulkRestartResources(items);
    case 'scale':
      if (typeof replicas !== 'number') {
        throw new Error('Replicas count is required for scale operation');
      }
      return AppAPI.BulkScaleResources(items, replicas);
    case 'suspend':
      return AppAPI.BulkSuspendCronJobs(items);
    case 'resume':
      return AppAPI.BulkResumeCronJobs(items);
    default:
      throw new Error(`Unknown action: ${actionKey}`);
  }
}

/**
 * Execute a Docker Swarm bulk operation.
 */
async function executeSwarmBulkAction(actionKey, selectedRows, options = {}) {
  const { replicas, resourceKind, availability } = options;

  // Transform rows to SwarmBulkItem format
  const items = selectedRows.map(row => ({
    id: row.id || row.ID || row.Id,
    name: row.name || row.Name,
    kind: resourceKind || row.kind || row.Kind || 'unknown',
  }));

  switch (actionKey) {
    case 'delete':
      return AppAPI.BulkRemoveSwarmResources(items);
    case 'restart':
      return AppAPI.BulkRestartSwarmServices(items);
    case 'scale':
      if (typeof replicas !== 'number') {
        throw new Error('Replicas count is required for scale operation');
      }
      return AppAPI.BulkScaleSwarmServices(items, replicas);
    case 'drain':
      return AppAPI.BulkSetNodeAvailability(items, 'drain');
    case 'pause':
      return AppAPI.BulkSetNodeAvailability(items, 'pause');
    case 'activate':
      return AppAPI.BulkSetNodeAvailability(items, 'active');
    default:
      throw new Error(`Unknown Swarm action: ${actionKey}`);
  }
}

/**
 * Check if any selected items are in production or system namespaces.
 * @param {Array} selectedRows - Array of selected row objects
 * @returns {boolean}
 */
export function hasProductionNamespace(selectedRows) {
  const productionNamespaces = new Set([
    'production', 'prod',
    'kube-system', 'kube-public', 'kube-node-lease',
    'default', // Could be production in some setups
  ]);

  return selectedRows.some(row => {
    const ns = row.namespace || row.Namespace || '';
    return productionNamespaces.has(ns.toLowerCase());
  });
}

/**
 * Prepare items for the confirm dialog.
 * @param {Array} selectedRows - Array of selected row objects
 * @returns {Array} Array of { key, name, namespace } objects
 */
export function prepareConfirmItems(selectedRows) {
  return selectedRows.map((row, idx) => {
    const namespace = row.namespace || row.Namespace || '';
    const name = row.name || row.Name || `Item ${idx + 1}`;
    return {
      key: namespace ? `${namespace}/${name}` : name,
      name,
      namespace,
    };
  });
}
