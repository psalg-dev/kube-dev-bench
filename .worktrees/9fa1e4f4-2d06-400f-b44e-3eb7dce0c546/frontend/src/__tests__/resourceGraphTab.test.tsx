import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ResourceGraphTab } from '../k8s/graph/ResourceGraphTab';
import { appApiMocks } from './wailsMocks';
import { exportGraphCanvas } from '../k8s/graph/utils/exportGraph';

vi.mock('../k8s/graph/utils/exportGraph', () => ({
  exportGraphCanvas: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../k8s/graph/components/GraphCanvas', () => ({
  GraphCanvas: ({ nodes, edges }: { nodes: unknown[]; edges: unknown[] }) => (
    <div id="graph-canvas" data-testid="graph-canvas-mock">
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

  it('triggers SVG and PNG exports from toolbar buttons', async () => {
    const user = userEvent.setup();

    render(<ResourceGraphTab namespace="default" kind="Deployment" name="demo" />);

    await waitFor(() => {
      expect(screen.getByTestId('graph-canvas-mock')).toHaveTextContent('nodes:1 edges:0');
    });

    await user.click(screen.getByRole('button', { name: 'Export SVG' }));
    await user.click(screen.getByRole('button', { name: 'Export PNG' }));

    const canvas = document.getElementById('graph-canvas');
    expect(exportGraphCanvas).toHaveBeenNthCalledWith(1, canvas, 'svg', 'default-Deployment-demo-relationships');
    expect(exportGraphCanvas).toHaveBeenNthCalledWith(2, canvas, 'png', 'default-Deployment-demo-relationships');
  });
});
