import { render, screen } from '@testing-library/react';
import { useGraphLayout } from '../k8s/graph/hooks/useGraphLayout';

function LayoutProbe({ graph }: { graph: unknown }) {
  const { nodes, edges } = useGraphLayout(graph);
  return (
    <div>
      <span data-testid="nodes-count">{nodes.length}</span>
      <span data-testid="edges-count">{edges.length}</span>
    </div>
  );
}

describe('useGraphLayout', () => {
  it('creates layout nodes and edges from graph data', () => {
    const graph = {
      nodes: [
        { id: 'deployment:default:demo', kind: 'Deployment', name: 'demo', namespace: 'default', status: '1/1', group: 'workload', metadata: {} },
        { id: 'pod:default:demo-pod', kind: 'Pod', name: 'demo-pod', namespace: 'default', status: 'Running', group: 'workload', metadata: {} }
      ],
      edges: [
        { id: 'edge-1', source: 'deployment:default:demo', target: 'pod:default:demo-pod', type: 'owns', label: 'owns' }
      ]
    };

    render(<LayoutProbe graph={graph} />);

    expect(screen.getByTestId('nodes-count')).toHaveTextContent('2');
    expect(screen.getByTestId('edges-count')).toHaveTextContent('1');
  });
});
