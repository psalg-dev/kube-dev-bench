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
    dimmed?: boolean;
  };
}

/**
 * Custom React Flow node for Kubernetes resources
 */
export function ResourceNode({ data }: ResourceNodeProps) {
  const color = getNodeColor(data.kind, data.status);
  const kindClass = data.kind ? `graph-node--${data.kind.toLowerCase()}` : 'graph-node--unknown';
  const displayName = data.metadata?.fullName || data.name;
  const lowerKind = data.kind?.toLowerCase();
  const isExternal = lowerKind === 'external';
  const isUser = lowerKind === 'user';
  const isGroup = lowerKind === 'group';
  const roleRules = lowerKind === 'role' || lowerKind === 'clusterrole' ? data.metadata?.rules : '';
  const nameTitle = roleRules ? `${displayName}\n${roleRules}` : displayName;
  const kindLabel = isExternal ? '☁ External' : isUser ? '👤 User' : isGroup ? '👥 Group' : data.kind;

  return (
    <div className={`resource-node graph-node ${kindClass}${data.dimmed ? ' graph-node--dimmed' : ''}`} style={{ borderColor: color }}>
      <Handle type="target" position={Position.Top} />

      <div className="resource-node-header">
        <div className="resource-node-kind" style={{ backgroundColor: color }}>
          {kindLabel}
        </div>
      </div>

      <div className="resource-node-content">
        <div className="resource-node-name" title={nameTitle}>
          {displayName}
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
