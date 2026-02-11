import dagre from '@dagrejs/dagre';
import { Node, Edge, Position } from '@xyflow/react';

export interface GraphData {
  nodes: Array<{
    id: string;
    kind: string;
    name: string;
    namespace: string;
    status: string;
    group: string;
    metadata: Record<string, string>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    label: string;
  }>;
}

export interface LayoutOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

const defaultOptions: LayoutOptions = {
  direction: 'TB',
  nodeWidth: 180,
  nodeHeight: 60,
  rankSep: 80,
  nodeSep: 60
};

/**
 * Compute hierarchical layout using Dagre
 * @param graphData - Raw graph data from backend
 * @param options - Layout configuration options
 * @returns React Flow nodes and edges with computed positions
 */
export function computeLayout(
  graphData: GraphData,
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const opts = { ...defaultOptions, ...options };
  
  // Create new Dagre graph
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: opts.direction,
    ranksep: opts.rankSep,
    nodesep: opts.nodeSep
  });

  // Add nodes to Dagre
  graphData.nodes.forEach(node => {
    g.setNode(node.id, {
      width: opts.nodeWidth,
      height: opts.nodeHeight
    });
  });

  // Add edges to Dagre
  graphData.edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  // Compute layout
  dagre.layout(g);

  // Convert to React Flow nodes
  const nodes: Node[] = graphData.nodes.map(node => {
    const dagreNode = g.node(node.id);
    
    return {
      id: node.id,
      type: 'resourceNode',
      position: {
        x: dagreNode.x - (opts.nodeWidth || 180) / 2,
        y: dagreNode.y - (opts.nodeHeight || 60) / 2
      },
      data: {
        kind: node.kind,
        name: node.name,
        namespace: node.namespace,
        status: node.status,
        group: node.group,
        metadata: node.metadata
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top
    };
  });

  // Convert to React Flow edges
  const edges: Edge[] = graphData.edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'relationshipEdge',
    data: {
      edgeType: edge.type,
      label: edge.label
    },
    animated: edge.type === 'routes_to'
  }));

  return { nodes, edges };
}

/**
 * Re-layout existing nodes and edges
 * @param nodes - Current React Flow nodes
 * @param edges - Current React Flow edges
 * @param options - Layout configuration options
 * @returns Updated nodes with new positions
 */
export function relayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const graphData: GraphData = {
    nodes: nodes.map(n => ({
      id: n.id,
      kind: n.data.kind,
      name: n.data.name,
      namespace: n.data.namespace || '',
      status: n.data.status,
      group: n.data.group,
      metadata: n.data.metadata || {}
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.data?.edgeType || '',
      label: e.data?.label || ''
    }))
  };

  const { nodes: layoutedNodes } = computeLayout(graphData, options);
  return layoutedNodes;
}
