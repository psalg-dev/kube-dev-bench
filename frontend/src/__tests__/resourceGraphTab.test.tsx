import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ResourceGraphTab } from '../k8s/graph/ResourceGraphTab';
import { appApiMocks } from './wailsMocks';

vi.mock('../k8s/graph/components/GraphCanvas', () => ({
  GraphCanvas: ({ nodes, edges }: { nodes: unknown[]; edges: unknown[] }) => (
    <div data-testid="graph-canvas-mock">
      nodes:{nodes.length} edges:{edges.length}
    </div>
  )
}));

describe('ResourceGraphTab', () => {
  beforeEach(() => {
    appApiMocks.GetResourceGraph?.mockResolvedValue({
      nodes: [
        { id: 'deployment:default:demo', kind: 'Deployment', name: 'demo', namespace: 'default', status: '1/1', group: 'workload', metadata: {} }
      ],
      edges: []
    });
  });

  it('renders graph canvas when data is loaded', async () => {
    render(<ResourceGraphTab namespace="default" kind="Deployment" name="demo" />);

    await waitFor(() => {
      expect(screen.getByTestId('graph-canvas-mock')).toHaveTextContent('nodes:1 edges:0');
    });
  });
});
