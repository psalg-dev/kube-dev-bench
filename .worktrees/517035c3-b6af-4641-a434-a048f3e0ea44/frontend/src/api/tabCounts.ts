/**
 * Tab counts API wrapper.
 * Provides functions to fetch counts for tab badges.
 */

import * as AppAPI from '../../wailsjs/go/main/App';

export type TabCounts = Record<string, number>;

/**
 * Fetch all tab counts for a resource in a single call.
 * @param {string} resourceKind - The Kubernetes resource kind (e.g., "ConfigMap", "Deployment")
 * @param {string} namespace - The resource namespace
 * @param {string} name - The resource name
 * @returns {Promise<Object>} Tab counts object with events, pods, consumers, etc.
 */
export async function fetchAllTabCounts(resourceKind: string, namespace: string, name: string): Promise<TabCounts> {
  try {
    const counts = await AppAPI.GetAllTabCounts(namespace, resourceKind, name);
    return (counts as unknown as Record<string, number>) || {};
  } catch (err) {
    console.error('Failed to fetch tab counts:', err);
    return {};
  }
}

/**
 * Fetch events count for a resource.
 * @param {string} resourceKind - The Kubernetes resource kind
 * @param {string} namespace - The resource namespace
 * @param {string} name - The resource name
 * @returns {Promise<number|null>} The count or null on error
 */
export async function fetchEventsCount(resourceKind: string, namespace: string, name: string): Promise<number | null> {
  try {
    return await AppAPI.GetResourceEventsCount(namespace, resourceKind, name);
  } catch (err) {
    console.error('Failed to fetch events count:', err);
    return null;
  }
}

/**
 * Fetch pods count for a workload resource.
 * @param {string} resourceKind - The owner kind (Deployment, StatefulSet, etc.)
 * @param {string} namespace - The resource namespace
 * @param {string} name - The resource name
 * @returns {Promise<number|null>} The count or null on error
 */
export async function fetchPodsCount(resourceKind: string, namespace: string, name: string): Promise<number | null> {
  try {
    return await AppAPI.GetPodsCountForResource(namespace, resourceKind, name);
  } catch (err) {
    console.error('Failed to fetch pods count:', err);
    return null;
  }
}

/**
 * Fetch consumers count for ConfigMap, Secret, or PVC.
 * @param {string} resourceKind - The resource kind (ConfigMap, Secret, PersistentVolumeClaim)
 * @param {string} namespace - The resource namespace
 * @param {string} name - The resource name
 * @returns {Promise<number|null>} The count or null on error
 */
export async function fetchConsumersCount(resourceKind: string, namespace: string, name: string): Promise<number | null> {
  try {
    switch (resourceKind) {
      case 'ConfigMap':
        return await AppAPI.GetConfigMapConsumersCount(namespace, name);
      case 'Secret':
        return await AppAPI.GetSecretConsumersCount(namespace, name);
      case 'PersistentVolumeClaim':
        return await AppAPI.GetPVCConsumersCount(namespace, name);
      default:
        return null;
    }
  } catch (err) {
    console.error('Failed to fetch consumers count:', err);
    return null;
  }
}

/**
 * Fetch job history count for a CronJob.
 * @param {string} namespace - The CronJob namespace
 * @param {string} name - The CronJob name
 * @returns {Promise<number|null>} The count or null on error
 */
export async function fetchCronJobHistoryCount(namespace: string, name: string): Promise<number | null> {
  try {
    return await AppAPI.GetCronJobHistoryCount(namespace, name);
  } catch (err) {
    console.error('Failed to fetch CronJob history count:', err);
    return null;
  }
}

/**
 * Fetch tab counts for a specific resource type.
 * Returns counts relevant to the resource kind.
 * @param {string} resourceKind - The Kubernetes resource kind
 * @param {string} namespace - The resource namespace
 * @param {string} name - The resource name
 * @returns {Promise<Object>} Object with count values keyed by tab type
 */
export async function fetchTabCounts(resourceKind: string, namespace: string, name: string): Promise<TabCounts> {
  // Use the consolidated API call for efficiency
  return fetchAllTabCounts(resourceKind, namespace, name);
}

export default fetchTabCounts;
