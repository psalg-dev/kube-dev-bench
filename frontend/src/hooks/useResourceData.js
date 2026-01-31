/**
 * Custom hook for resource data fetching and live event subscriptions.
 * Consolidates duplicated data loading logic from ~20 OverviewTable components.
 * 
 * This hook handles:
 * - Initial data fetching with namespace handling
 * - Live event subscription for real-time updates
 * - Data normalization (PascalCase to camelCase)
 * - Loading state management
 * 
 * @example
 * const { data, loading, refresh } = useResourceData({
 *   fetchFn: AppAPI.GetDeployments,
 *   eventName: 'deployments:update',
 *   namespaces,
 *   namespace,
 *   normalize: (d) => ({
 *     name: d.name ?? d.Name,
 *     namespace: d.namespace ?? d.Namespace,
 *     // ... other fields
 *   }),
 * });
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { EventsOn, EventsOff } from '../../wailsjs/runtime';

/**
 * Custom hook for fetching and subscribing to K8s/Swarm resource data
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.fetchFn - Function to fetch data (receives namespace as param)
 * @param {string} options.eventName - Wails event name for live updates
 * @param {Array<string>} [options.namespaces] - Array of namespaces to fetch from
 * @param {string} [options.namespace] - Single namespace (used if namespaces not provided)
 * @param {Function} [options.normalize] - Function to normalize each data item
 * @param {boolean} [options.clusterScoped=false] - If true, fetches without namespace parameter
 * @returns {Object} - { data, loading, refresh }
 */
export function useResourceData({
  fetchFn,
  eventName,
  namespaces,
  namespace,
  normalize,
  clusterScoped = false,
}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Use ref to store normalize function to avoid dependency changes
  const normalizeRef = useRef(normalize);
  normalizeRef.current = normalize;

  // Serialize namespaces for stable dependency
  const namespacesKey = Array.isArray(namespaces) ? namespaces.join(',') : '';

  // Helper to apply normalization if provided
  const applyNormalize = useCallback((arr) => {
    const items = (arr || []).filter(Boolean);
    if (normalizeRef.current) {
      return items.map(normalizeRef.current);
    }
    return items;
  }, []);

  // Fetch data from API
  const refresh = useCallback(async () => {
    if (clusterScoped) {
      // Cluster-scoped resources (e.g., PersistentVolumes)
      try {
        setLoading(true);
        const result = await fetchFn().catch(() => []);
        setData(applyNormalize(result));
      } catch (_error) {
        setData([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Namespace-scoped resources
    const nsArr = namespacesKey 
      ? namespacesKey.split(',')
      : (namespace ? [namespace] : []);
    
    if (nsArr.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const lists = await Promise.all(
        nsArr.map(ns => fetchFn(ns).catch(() => []))
      );
      const flat = lists.flat();
      setData(applyNormalize(flat));
    } catch (_error) {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, namespacesKey, namespace, clusterScoped, applyNormalize]);

  // Initial fetch on mount and when dependencies change
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to live updates from backend
  useEffect(() => {
    if (!eventName) return;

    const onUpdate = (list) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        setData(applyNormalize(arr));
      } catch (_e) {
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    EventsOn(eventName, onUpdate);
    return () => {
      try { EventsOff(eventName); } catch (_) { /* ignore cleanup errors */ }
    };
  }, [eventName, applyNormalize]);

  return { data, loading, refresh };
}

/**
 * Common normalizer factory for K8s resources.
 * Creates a normalize function based on field definitions.
 * 
 * @param {Object} fieldDefaults - Object with field names as keys and default values
 * @returns {Function} - Normalizer function
 * 
 * @example
 * const normalizeDeployment = createNormalizer({
 *   name: '',
 *   namespace: '',
 *   replicas: 0,
 *   ready: 0,
 *   available: 0,
 *   age: '-',
 *   image: '',
 *   labels: {},
 * });
 */
export function createNormalizer(fieldDefaults) {
  return (item) => {
    if (!item) return null;
    const result = {};
    for (const [key, defaultValue] of Object.entries(fieldDefaults)) {
      // Try camelCase first, then PascalCase
      const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
      result[key] = item[key] ?? item[pascalKey] ?? defaultValue;
    }
    return result;
  };
}

export default useResourceData;
