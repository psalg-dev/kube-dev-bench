import { BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { getEdgeStyle } from '../../utils/graphStyles';

/**
 * Custom React Flow edge for resource relationships
 */
export function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  const edgeType = typeof data?.edgeType === 'string' ? data.edgeType : '';
  const edgeLabel = typeof data?.label === 'string' ? data.label : '';
  const style = getEdgeStyle(edgeType);
  const isDimmed = Boolean(data?.dimmed);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={`graph-edge graph-edge--${edgeType || 'unknown'}`}
        style={{
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          strokeDasharray: style.strokeDasharray,
          opacity: isDimmed ? 0.25 : 1
        }}
      />
      {edgeLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
              fontWeight: 500,
              background: 'white',
              padding: '2px 6px',
              borderRadius: 3,
              border: `1px solid ${style.stroke}`,
              color: style.stroke,
              opacity: isDimmed ? 0.35 : 1,
              pointerEvents: 'all'
            }}
            className="edge-label"
          >
            {edgeLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
