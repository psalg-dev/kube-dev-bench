import dagre from '@dagrejs/dagre';
import { Node, Edge, MarkerType, Position } from '@xyflow/react';

export interface GraphData {
  nodes: Array<{
    id: string;
    kind: string;
    name: string;
    namespace: string;
    status: string;
    group: string;
    metadata: Record<string, string>;
    dimmed?: boolean;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    label: string;
    dimmed?: boolean;
  }>;
}

export interface LayoutOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
  preferWorkloadHierarchy?: boolean;
}

const defaultOptions: LayoutOptions = {
  direction: 'TB',
  nodeWidth: 220,
  nodeHeight: 96,
  rankSep: 80,
  nodeSep: 60,
  preferWorkloadHierarchy: false
};

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, v]) => {
    acc[key] = typeof v === 'string' ? v : String(v ?? '');
    return acc;
  }, {});
}

function hasCronJobHierarchy(graphData: GraphData): boolean {
  if (!graphData?.nodes || !graphData?.edges) {
    return false;
  }

  const nodeKindByID = new Map<string, string>();
  graphData.nodes.forEach((node) => {
    nodeKindByID.set(node.id, (node.kind || '').toLowerCase());
  });

  let hasCronToJob = false;
  let hasJobToPod = false;
  graphData.edges.forEach((edge) => {
    if (edge.type !== 'owns') {
      return;
    }
    const sourceKind = nodeKindByID.get(edge.source);
    const targetKind = nodeKindByID.get(edge.target);
    if (sourceKind === 'cronjob' && targetKind === 'job') {
      hasCronToJob = true;
    }
    if (sourceKind === 'job' && targetKind === 'pod') {
      hasJobToPod = true;
    }
  });

  return hasCronToJob && hasJobToPod;
}

function isCronJobHierarchyEdge(edge: GraphData['edges'][number], nodeKindByID: Map<string, string>): boolean {
  if (edge.type !== 'owns') {
    return false;
  }

  const sourceKind = nodeKindByID.get(edge.source);
  const targetKind = nodeKindByID.get(edge.target);
  return (sourceKind === 'cronjob' && targetKind === 'job') || (sourceKind === 'job' && targetKind === 'pod');
}

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
  const useWorkloadHierarchy = opts.preferWorkloadHierarchy || hasCronJobHierarchy(graphData);

  // Create new Dagre graph
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: opts.direction,
    ranksep: useWorkloadHierarchy ? Math.max(opts.rankSep || 80, 100) : opts.rankSep,
    nodesep: useWorkloadHierarchy ? Math.max(opts.nodeSep || 60, 80) : opts.nodeSep,
    ranker: useWorkloadHierarchy ? 'tight-tree' : undefined
  });

  // Add nodes to Dagre
  graphData.nodes.forEach(node => {
    g.setNode(node.id, {
      width: opts.nodeWidth,
      height: opts.nodeHeight
    });
  });

  const nodeKindByID = new Map<string, string>();
  graphData.nodes.forEach(node => {
    nodeKindByID.set(node.id, (node.kind || '').toLowerCase());
  });

  // Add edges to Dagre
  graphData.edges.forEach(edge => {
    const edgeConfig = useWorkloadHierarchy && isCronJobHierarchyEdge(edge, nodeKindByID)
      ? { weight: 4, minlen: 2 }
      : {};
    g.setEdge(edge.source, edge.target, edgeConfig);
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
        metadata: node.metadata,
        dimmed: Boolean(node.dimmed)
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top
    };
  });

  // Convert to React Flow edges
  const edges: Edge[] = graphData.edges.map(edge => {
    const directedPolicyEdge = edge.type === 'network_policy_ingress' || edge.type === 'network_policy_egress';
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'relationshipEdge',
      data: {
        edgeType: edge.type,
        label: edge.label,
        dimmed: Boolean(edge.dimmed)
      },
      animated: edge.type === 'routes_to',
      markerEnd: directedPolicyEdge ? { type: MarkerType.ArrowClosed } : undefined,
    };
  });

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
    nodes: nodes.map(n => {
      const nodeData = (n.data ?? {}) as Record<string, unknown>;
      return {
      id: n.id,
      kind: toStringValue(nodeData.kind, 'unknown'),
      name: toStringValue(nodeData.name, n.id),
      namespace: toStringValue(nodeData.namespace, ''),
      status: toStringValue(nodeData.status, ''),
      group: toStringValue(nodeData.group, 'infrastructure'),
      metadata: toStringRecord(nodeData.metadata)
      };
    }),
    edges: edges.map(e => {
      const edgeData = (e.data ?? {}) as Record<string, unknown>;
      return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: toStringValue(edgeData.edgeType, ''),
      label: toStringValue(edgeData.label, '')
      };
    })
  };

  const { nodes: layoutedNodes } = computeLayout(graphData, options);
  return layoutedNodes;
}
