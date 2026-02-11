import { useState } from 'react';
import { useResourceGraph } from './hooks/useResourceGraph';
import { useGraphLayout } from './hooks/useGraphLayout';
import { GraphCanvas } from './components/GraphCanvas';
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
  
  // Fetch graph data
  const { graph, loading, error, refresh } = useResourceGraph(namespace, kind, name, depth);
  
  // Compute layout
  const { nodes, edges } = useGraphLayout(graph);

  return (
    <div className="resource-graph-tab">
      <div className="graph-toolbar" id="graph-toolbar">
        <div className="toolbar-left">
          <span className="toolbar-label">Depth:</span>
          <select
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="depth-selector"
          >
            <option value={1}>1 level</option>
            <option value={2}>2 levels</option>
            <option value={3}>3 levels</option>
          </select>
        </div>
        
        <div className="toolbar-right">
          <button
            id="graph-refresh-btn"
            onClick={refresh}
            className="refresh-button"
            disabled={loading}
          >
            <span className="refresh-icon">↻</span>
            Refresh
          </button>
        </div>
      </div>
      
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
        <div className="graph-legend" id="graph-legend">
          <div className="legend-title">Legend</div>
          <div className="legend-items">
            <div className="legend-item">
              <div className="legend-line" style={{ borderTop: '2px solid #64748b' }}></div>
              <span>owns</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ borderTop: '2px dashed #3b82f6' }}></div>
              <span>selects</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ borderTop: '2px dotted #10b981' }}></div>
              <span>mounts</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ borderTop: '3px solid #f97316' }}></div>
              <span>routes to</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ borderTop: '2px solid #14b8a6' }}></div>
              <span>bound to</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
