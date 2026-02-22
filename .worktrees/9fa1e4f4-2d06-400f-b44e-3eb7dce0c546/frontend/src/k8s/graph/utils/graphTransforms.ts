/* eslint-disable @typescript-eslint/no-explicit-any */
export interface GraphTransformResult {
  graph: any;
  collapsed: boolean;
  collapsedPodCount: number;
}

const ownerKinds = new Set([
  'deployment',
  'statefulset',
  'daemonset',
  'replicaset',
  'job',
  'cronjob',
]);

function normalizeKind(kind: string | undefined): string {
  return (kind || '').toLowerCase();
}

export function collapsePodsForLargeNamespaceGraph(graph: any, threshold = 200): GraphTransformResult {
  if (!graph?.nodes || !graph?.edges || graph.nodes.length <= threshold) {
    return {
      graph,
      collapsed: false,
      collapsedPodCount: 0,
    };
  }

  const nodeByID = new Map<string, any>(graph.nodes.map((node: any) => [node.id, node]));
  const podNodeIDs = new Set<string>();
  const ownerPodCount = new Map<string, number>();

  graph.nodes.forEach((node: any) => {
    if (normalizeKind(node.kind) === 'pod') {
      podNodeIDs.add(node.id);
    }
  });

  graph.edges.forEach((edge: any) => {
    const sourceNode = nodeByID.get(edge.source);
    const targetNode = nodeByID.get(edge.target);

    if (!sourceNode || !targetNode) {
      return;
    }

    const sourceKind = normalizeKind(sourceNode.kind);
    const targetKind = normalizeKind(targetNode.kind);

    if (edge.type === 'owns' && targetKind === 'pod' && ownerKinds.has(sourceKind)) {
      ownerPodCount.set(edge.source, (ownerPodCount.get(edge.source) || 0) + 1);
    }
  });

  if (podNodeIDs.size === 0) {
    return {
      graph,
      collapsed: false,
      collapsedPodCount: 0,
    };
  }

  const collapsedNodes = graph.nodes
    .filter((node: any) => !podNodeIDs.has(node.id))
    .map((node: any) => {
      const count = ownerPodCount.get(node.id) || 0;
      if (count === 0) {
        return node;
      }

      const metadata = { ...(node.metadata || {}) };
      const baseName = metadata.fullName || node.name;
      metadata.fullName = `${baseName} [${count} pods]`;
      metadata.collapsedPods = String(count);

      return {
        ...node,
        metadata,
      };
    });

  const collapsedEdges = graph.edges.filter((edge: any) => !podNodeIDs.has(edge.source) && !podNodeIDs.has(edge.target));

  return {
    graph: {
      ...graph,
      nodes: collapsedNodes,
      edges: collapsedEdges,
    },
    collapsed: true,
    collapsedPodCount: podNodeIDs.size,
  };
}
