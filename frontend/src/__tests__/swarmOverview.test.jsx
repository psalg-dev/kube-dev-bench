import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../docker/SwarmStateContext.jsx', () => ({
  useSwarmState: vi.fn(),
}));

vi.mock('../docker/metrics/SwarmMetricsDashboard.jsx', () => ({
  default: () => <div data-testid="swarm-metrics">MetricsDash</div>,
}));

vi.mock('../docker/topology/TopologyView.jsx', () => ({
  default: () => <div data-testid="swarm-topology">TopologyView</div>,
}));

describe('SwarmOverview', () => {
  it('shows Metrics by default and switches to Topology', async () => {
    const swarmState = await import('../docker/SwarmStateContext.jsx');
    swarmState.useSwarmState.mockReturnValue({ serverVersion: 'Docker 25.0', swarmActive: true });

    const { default: SwarmOverview } = await import('../docker/SwarmOverview.jsx');

    render(<SwarmOverview />);

    expect(await screen.findByTestId('swarm-overview')).toBeInTheDocument();
    expect(screen.getByText('Docker 25.0 (Swarm)')).toBeInTheDocument();
    expect(screen.getByTestId('swarm-metrics')).toBeInTheDocument();
    expect(screen.queryByTestId('swarm-topology')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Topology' }));
    expect(await screen.findByTestId('swarm-topology')).toBeInTheDocument();
    expect(screen.queryByTestId('swarm-metrics')).not.toBeInTheDocument();
  });

  it('respects initialTab prop and updates when it changes', async () => {
    const swarmState = await import('../docker/SwarmStateContext.jsx');
    swarmState.useSwarmState.mockReturnValue({ serverVersion: '', swarmActive: false });

    const { default: SwarmOverview } = await import('../docker/SwarmOverview.jsx');

    const { rerender } = render(<SwarmOverview initialTab="topology" />);

    expect(await screen.findByTestId('swarm-topology')).toBeInTheDocument();
    expect(screen.getByText('(Standalone)')).toBeInTheDocument();

    rerender(<SwarmOverview initialTab="metrics" />);
    expect(await screen.findByTestId('swarm-metrics')).toBeInTheDocument();
  });
});
