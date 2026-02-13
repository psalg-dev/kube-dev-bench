import { Edge, Node } from '@xyflow/react';
import { useMemo } from 'react';
import { computeLayout, LayoutOptions } from '../utils/layoutEngine';

/**
 * Hook to compute graph layout using Dagre
 * @param graphData - Raw graph data from backend
 * @param layoutOptions - Layout configuration options
 * @returns React Flow nodes and edges with computed positions
 */
export function useGraphLayout(
  graphData: unknown | null,
  layoutOptions?: LayoutOptions
): { nodes: Node[]; edges: Edge[] } {
  return useMemo(() => {
    if (!graphData || !graphData.nodes || !graphData.edges) {
      return { nodes: [], edges: [] };
    }

    try {
      const { nodes, edges } = computeLayout(graphData, layoutOptions);
      return { nodes, edges };
    } catch (error) {
      console.error('Failed to compute graph layout:', error);
      return { nodes: [], edges: [] };
    }
  }, [graphData, layoutOptions]);
}
