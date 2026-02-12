/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { useClusterState } from '../../state/ClusterStateContext';
import { useGraphLayout } from './hooks/useGraphLayout';
import { GraphCanvas } from './components/GraphCanvas';
import { GraphLegend } from './components/GraphLegend';
import { GraphToolbar } from './components/GraphToolbar';
import { getNamespaceGraph, getNetworkPolicyGraph, getRBACGraph, getStorageGraph } from './utils/graphApi';
import { collapsePodsForLargeNamespaceGraph } from './utils/graphTransforms';
import './GraphView.css';

type GraphMode = 'namespace' | 'storage' | 'network' | 'rbac';

type GraphViewProps = {
  mode: GraphMode;
};

export default function GraphView({ mode }: GraphViewProps) {
  const { selectedNamespaces } = useClusterState() as any;
  const [depth, setDepth] = useState(mode === 'namespace' || mode === 'network' || mode === 'rbac' ? 1 : 2);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [graph, setGraph] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [kindFilters, setKindFilters] = useState<Record<string, boolean>>({
    pod: true,
    configmap: true,
    secret: true,
    service: true,
    storage: true,
  });

  const namespace = Array.isArray(selectedNamespaces) && selectedNamespaces.length > 0 ? selectedNamespaces[0] : '';

  useEffect(() => {
    setDepth(mode === 'namespace' || mode === 'network' || mode === 'rbac' ? 1 : 2);
    if (mode !== 'rbac') {
      setSubjectSearch('');
    }
  }, [mode]);

  useEffect(() => {
    if (!namespace) {
      setGraph(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const payload = mode === 'storage'
          ? await getStorageGraph(namespace, depth)
          : mode === 'network'
            ? await getNetworkPolicyGraph(namespace, depth)
            : mode === 'rbac'
              ? await getRBACGraph(namespace)
            : await getNamespaceGraph(namespace, depth);
        if (!cancelled) {
          setGraph(payload);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load graph';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [mode, namespace, depth, refreshToken]);

  const transformedGraph = useMemo(() => {
    if (!graph?.nodes || !graph?.edges) {
      return {
        graph,
        collapsed: false,
        collapsedPodCount: 0,
      };
    }

    if (mode === 'namespace') {
      return collapsePodsForLargeNamespaceGraph(graph, 200);
    }

    return {
      graph,
      collapsed: false,
      collapsedPodCount: 0,
    };
  }, [graph, mode]);

  const filteredGraph = useMemo(() => {
    if (!transformedGraph.graph?.nodes || !transformedGraph.graph?.edges) {
      return transformedGraph.graph;
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

    const filteredNodes = transformedGraph.graph.nodes.filter((node: any) => shouldKeepNode(node.kind || ''));
    const allowedNodeIds = new Set(filteredNodes.map((node: any) => node.id));
    const filteredEdges = transformedGraph.graph.edges.filter((edge: any) => allowedNodeIds.has(edge.source) && allowedNodeIds.has(edge.target));

    return {
      ...transformedGraph.graph,
      nodes: filteredNodes,
      edges: filteredEdges,
    };
  }, [transformedGraph, kindFilters]);

  const highlightedGraph = useMemo(() => {
    if (mode !== 'rbac') {
      return filteredGraph;
    }
    if (!filteredGraph?.nodes || !filteredGraph?.edges) {
      return filteredGraph;
    }

    const term = subjectSearch.trim().toLowerCase();
    if (!term) {
      return filteredGraph;
    }

    const isSubjectKind = (resourceKind: string) => {
      const value = resourceKind.toLowerCase();
      return value === 'serviceaccount' || value === 'user' || value === 'group';
    };

    const matchingIDs = new Set<string>(
      filteredGraph.nodes
        .filter((node: any) => {
          if (!isSubjectKind(node.kind || '')) {
            return false;
          }
          const fullName = node.metadata?.fullName || '';
          const raw = `${node.name || ''} ${fullName}`.toLowerCase();
          return raw.includes(term);
        })
        .map((node: any) => node.id)
    );

    if (matchingIDs.size === 0) {
      return {
        ...filteredGraph,
        nodes: filteredGraph.nodes.map((node: any) => ({
          ...node,
          dimmed: true,
        })),
        edges: filteredGraph.edges.map((edge: any) => ({
          ...edge,
          dimmed: true,
        })),
      };
    }

    const adjacency = new Map<string, Set<string>>();
    const connect = (a: string, b: string) => {
      if (!adjacency.has(a)) {
        adjacency.set(a, new Set<string>());
      }
      adjacency.get(a)!.add(b);
    };

    filteredGraph.edges.forEach((edge: any) => {
      connect(edge.source, edge.target);
      connect(edge.target, edge.source);
    });

    const highlightedIDs = new Set<string>();
    const queue: string[] = Array.from(matchingIDs);
    queue.forEach((id) => highlightedIDs.add(id));

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      const neighbors = adjacency.get(current);
      if (!neighbors) {
        continue;
      }
      neighbors.forEach((neighbor) => {
        if (!highlightedIDs.has(neighbor)) {
          highlightedIDs.add(neighbor);
          queue.push(neighbor);
        }
      });
    }

    return {
      ...filteredGraph,
      nodes: filteredGraph.nodes.map((node: any) => ({
        ...node,
        dimmed: !highlightedIDs.has(node.id),
      })),
      edges: filteredGraph.edges.map((edge: any) => ({
        ...edge,
        dimmed: !(highlightedIDs.has(edge.source) && highlightedIDs.has(edge.target)),
      })),
    };
  }, [filteredGraph, mode, subjectSearch]);

  const { nodes, edges } = useGraphLayout(highlightedGraph);

  const onRefresh = () => {
    setRefreshToken((current) => current + 1);
  };

  const toggleKindFilter = (filterKey: string) => {
    setKindFilters((current) => ({
      ...current,
      [filterKey]: !current[filterKey],
    }));
  };

  return (
    <div className="graph-view-root">
      <div className="graph-view-header">
        <div className="graph-view-title">
          {mode === 'storage' ? 'Storage Graph' : mode === 'network' ? 'Network Policy Graph' : mode === 'rbac' ? 'RBAC Graph' : 'Namespace Topology'}
        </div>
        <div className="graph-view-subtitle">
          {namespace ? `Namespace: ${namespace}` : 'Select a namespace to view topology'}
        </div>
        {mode === 'rbac' && (
          <div className="graph-view-search-row">
            <label htmlFor="rbac-subject-search" className="graph-view-search-label">
              What can X do?
            </label>
            <input
              id="rbac-subject-search"
              className="graph-view-search-input"
              type="text"
              value={subjectSearch}
              onChange={(event) => setSubjectSearch(event.target.value)}
              placeholder="Search User, Group, or ServiceAccount"
            />
          </div>
        )}
      </div>

      <div className="graph-view-canvas-wrap">
        {namespace ? (
          <>
            <GraphToolbar
              depth={depth}
              onDepthChange={setDepth}
              loading={loading}
              onRefresh={onRefresh}
              filters={kindFilters}
              onToggleFilter={toggleKindFilter}
            />
            <div className="graph-view-canvas-content">
              {transformedGraph.collapsed && (
                <div className="graph-view-collapse-hint">
                  Collapsed {transformedGraph.collapsedPodCount} pods into owner nodes for readability.
                </div>
              )}
              <GraphCanvas
                nodes={nodes}
                edges={edges}
                loading={loading}
                error={error}
                onRefresh={onRefresh}
              />
            </div>
            {!loading && !error && nodes.length > 0 && <GraphLegend />}
          </>
        ) : (
          <div className="graph-view-empty">Select a namespace to view topology.</div>
        )}
      </div>
    </div>
  );
}
