import { useMemo, useState } from 'react';
import { GraphCanvas } from './components/GraphCanvas';
import { GraphLegend } from './components/GraphLegend';
import { GraphToolbar } from './components/GraphToolbar';
import { useGraphLayout } from './hooks/useGraphLayout';
import { useResourceGraph } from './hooks/useResourceGraph';
import './ResourceGraphTab.css';

export interface ResourceGraphTabProps {
  namespace: string;
  kind: string;
  name: string;
}

/**
 * Resource Relationships tab component for bottom panel
 * Displays interactive graph visualization of resource relationships
 */
export function ResourceGraphTab({ namespace, kind, name }: ResourceGraphTabProps) {
  const [depth, setDepth] = useState(2);
  const [kindFilters, setKindFilters] = useState<Record<string, boolean>>({
    pod: true,
    configmap: true,
    secret: true,
    service: true,
    storage: true,
  });

  // Fetch graph data
  const { graph, loading, error, refresh } = useResourceGraph(namespace, kind, name, depth);

  const filteredGraph = useMemo(() => {
    if (!graph?.nodes || !graph?.edges) {
      return graph;
    }

    const isStorageKind = (resourceKind: string): boolean => {
      const value = resourceKind.toLowerCase();
      return value === 'persistentvolume' || value === 'persistentvolumeclaim' || value === 'storageclass' || value === 'pv' || value === 'pvc';
    };

    const shouldKeepNode = (resourceKind: string): boolean => {
      const value = resourceKind.toLowerCase();
      if (value === 'pod') {
        return kindFilters.pod;
      }
      if (value === 'configmap') {
        return kindFilters.configmap;
      }
      if (value === 'secret') {
        return kindFilters.secret;
      }
      if (value === 'service') {
        return kindFilters.service;
      }
      if (isStorageKind(value)) {
        return kindFilters.storage;
      }
      return true;
    };

    const filteredNodes = graph.nodes.filter((node: unknown) => shouldKeepNode(node.kind || ''));
    const allowedNodeIds = new Set(filteredNodes.map((node: unknown) => node.id));
    const filteredEdges = graph.edges.filter((edge: unknown) => allowedNodeIds.has(edge.source) && allowedNodeIds.has(edge.target));

    return {
      ...graph,
      nodes: filteredNodes,
      edges: filteredEdges,
    };
  }, [graph, kindFilters]);

  // Compute layout
  const { nodes, edges } = useGraphLayout(filteredGraph);

  const toggleKindFilter = (filterKey: string) => {
    setKindFilters((current) => ({
      ...current,
      [filterKey]: !current[filterKey],
    }));
  };

  return (
    <div className="resource-graph-tab">
      <GraphToolbar
        depth={depth}
        onDepthChange={setDepth}
        loading={loading}
        onRefresh={refresh}
        filters={kindFilters}
        onToggleFilter={toggleKindFilter}
      />

      <div className="graph-content">
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          loading={loading}
          error={error}
          onRefresh={refresh}
        />
      </div>

      {!loading && !error && nodes.length > 0 && (
        <GraphLegend />
      )}
    </div>
  );
}
