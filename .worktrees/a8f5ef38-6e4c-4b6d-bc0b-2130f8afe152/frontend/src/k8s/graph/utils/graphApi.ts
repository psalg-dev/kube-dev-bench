import { GetNamespaceGraph, GetNetworkPolicyGraph, GetRBACGraph, GetResourceGraph, GetStorageGraph } from '../../../../wailsjs/go/main/App';

/**
 * Fetch resource relationship graph from backend
 * @param namespace - Resource namespace (empty for cluster-scoped resources)
 * @param kind - Resource kind (pod, deployment, service, etc.)
 * @param name - Resource name
 * @param depth - Graph traversal depth (1-3, default 2)
 * @returns Resource graph with nodes and edges
 */
export async function getResourceGraph(
  namespace: string,
  kind: string,
  name: string,
  depth: number = 2
) {
  try {
    const graph = await GetResourceGraph(namespace, kind, name, depth);
    return graph;
  } catch (error) {
    console.error('Failed to fetch resource graph:', error);
    throw error;
  }
}

export async function getNamespaceGraph(namespace: string, depth: number = 2) {
  try {
    const graph = await GetNamespaceGraph(namespace, depth);
    return graph;
  } catch (error) {
    console.error('Failed to fetch namespace graph:', error);
    throw error;
  }
}

export async function getStorageGraph(namespace: string, depth: number = 2) {
  try {
    const graph = await GetStorageGraph(namespace, depth);
    return graph;
  } catch (error) {
    console.error('Failed to fetch storage graph:', error);
    throw error;
  }
}

export async function getNetworkPolicyGraph(namespace: string, depth: number = 1) {
  try {
    const graph = await GetNetworkPolicyGraph(namespace, depth);
    return graph;
  } catch (error) {
    console.error('Failed to fetch network policy graph:', error);
    throw error;
  }
}

export async function getRBACGraph(namespace: string) {
  try {
    const graph = await GetRBACGraph(namespace);
    return graph;
  } catch (error) {
    console.error('Failed to fetch RBAC graph:', error);
    throw error;
  }
}
