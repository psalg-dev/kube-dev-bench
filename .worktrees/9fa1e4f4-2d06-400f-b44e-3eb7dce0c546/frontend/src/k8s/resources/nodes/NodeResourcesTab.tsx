import type { app } from '../../../../wailsjs/go/models';

type NodeResourcesTabProps = {
  node?: app.NodeInfo | null;
};

type NodeTaint = {
  key?: string;
  value?: string;
  effect?: string;
};

export default function NodeResourcesTab({ node }: NodeResourcesTabProps) {
  if (!node) {
    return <div style={{ padding: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>No node selected.</div>;
  }

  const taints = Array.isArray(node.taints) ? (node.taints as NodeTaint[]) : [];

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 12 }}>
        <strong>Allocatable</strong>
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          <div>CPU: {node.allocatableCPU || '-'}</div>
          <div>Memory: {node.allocatableMemory || '-'}</div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Runtime</strong>
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          <div>Container Runtime: {node.containerRuntime || '-'}</div>
          <div>Kernel: {node.kernelVersion || '-'}</div>
          <div>OS Image: {node.osImage || '-'}</div>
          <div>Kubernetes Version: {node.version || '-'}</div>
        </div>
      </div>

      <div>
        <strong>Taints</strong>
        {taints.length === 0 ? (
          <div style={{ marginTop: 8, color: 'var(--gh-text-secondary, #8b949e)' }}>No taints.</div>
        ) : (
          <ul style={{ marginTop: 8, paddingLeft: 18 }}>
            {taints.map((taint, index) => (
              <li key={`${taint.key || 'taint'}-${index}`}>
                {taint.key || '-'}={taint.value || ''}:{taint.effect || '-'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
