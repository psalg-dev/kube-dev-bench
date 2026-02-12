import {
    Background,
    Controls,
    EdgeTypes,
    MiniMap,
    Node,
    NodeTypes,
    OnEdgesChange,
    OnNodesChange,
    ReactFlow,
    applyEdgeChanges,
    applyNodeChanges
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useState } from 'react';
import { useGraphNavigation } from '../hooks/useGraphNavigation';
import { RelationshipEdge } from './edges/RelationshipEdge';
import './GraphCanvas.css';
import { ResourceNode } from './nodes/ResourceNode';

const nodeTypes: NodeTypes = {
  resourceNode: ResourceNode as unknown
};

const edgeTypes: EdgeTypes = {
  relationshipEdge: RelationshipEdge as unknown
};

export interface GraphCanvasProps {
  nodes: Node[];
  edges: unknown[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

/**
 * React Flow graph canvas for visualizing Kubernetes resource relationships
 */
export function GraphCanvas({ nodes, edges, loading, error, onRefresh }: GraphCanvasProps) {
  const { handleNodeClick } = useGraphNavigation();

  const [localNodes, setLocalNodes] = useState(nodes);
  const [localEdges, setLocalEdges] = useState(edges);

  // Update local state when props change
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setLocalNodes(nodes);
      setLocalEdges(edges);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [nodes, edges]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setLocalNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setLocalEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      handleNodeClick(node.data);
    },
    [handleNodeClick]
  );

  if (loading) {
    return (
      <div className="graph-canvas-loading">
        <div className="spinner"></div>
        <p>Loading resource relationships...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="graph-canvas-error">
        <p className="error-message">Failed to load graph: {error}</p>
        {onRefresh && (
          <button onClick={onRefresh} className="retry-button">
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!localNodes || localNodes.length === 0) {
    return (
      <div className="graph-canvas-empty">
        <p>No resource relationships found</p>
      </div>
    );
  }

  return (
    <div className="graph-canvas" id="graph-canvas">
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          animated: false
        }}
      >
        <Background color="#30363d" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const kindRaw = node.data?.kind;
            const kind = typeof kindRaw === 'string' ? kindRaw.toLowerCase() : '';
            if (kind.includes('pod')) return '#4ade80';
            if (kind.includes('service')) return '#f97316';
            if (kind.includes('deployment')) return '#3b82f6';
            return '#94a3b8';
          }}
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
