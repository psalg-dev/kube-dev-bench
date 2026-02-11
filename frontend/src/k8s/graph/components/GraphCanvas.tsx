import { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  EdgeTypes,
  Node,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ResourceNode } from './nodes/ResourceNode';
import { RelationshipEdge } from './edges/RelationshipEdge';
import { useGraphNavigation } from '../hooks/useGraphNavigation';
import './GraphCanvas.css';

const nodeTypes: NodeTypes = {
  resourceNode: ResourceNode as any
};

const edgeTypes: EdgeTypes = {
  relationshipEdge: RelationshipEdge as any
};

export interface GraphCanvasProps {
  nodes: Node[];
  edges: any[];
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
    setLocalNodes(nodes);
    setLocalEdges(edges);
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
    (_: any, node: Node) => {
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
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const kind = node.data?.kind?.toLowerCase() || '';
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
