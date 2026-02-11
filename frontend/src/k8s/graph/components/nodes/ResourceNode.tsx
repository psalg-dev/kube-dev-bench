import { Handle, Position } from '@xyflow/react';
import { getNodeColor } from '../../utils/graphStyles';
import './ResourceNode.css';

export interface ResourceNodeProps {
  data: {
    kind: string;
    name: string;
    namespace: string;
    status: string;
    group: string;
    metadata: Record<string, string>;
  };
}

/**
 * Custom React Flow node for Kubernetes resources
 */
export function ResourceNode({ data }: ResourceNodeProps) {
  const color = getNodeColor(data.kind, data.status);
  const truncatedName = data.name.length > 20 ? data.name.substring(0, 17) + '...' : data.name;

  return (
    <div className="resource-node" style={{ borderColor: color }}>
      <Handle type="target" position={Position.Top} />
      
      <div className="resource-node-header">
        <div className="resource-node-kind" style={{ backgroundColor: color }}>
          {data.kind}
        </div>
      </div>
      
      <div className="resource-node-content">
        <div className="resource-node-name" title={data.name}>
          {truncatedName}
        </div>
        {data.namespace && (
          <div className="resource-node-namespace">{data.namespace}</div>
        )}
        {data.status && (
          <div className="resource-node-status">
            <span className="status-badge" style={{ backgroundColor: color }}>
              {data.status}
            </span>
          </div>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
