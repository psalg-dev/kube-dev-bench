import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SwarmStateContextValue } from '../docker/SwarmStateContext';

vi.mock('../docker/SwarmStateContext', () => ({
  useSwarmState: vi.fn(),
}));

vi.mock('../docker/metrics/SwarmMetricsDashboard', () => ({
  default: () => <div data-testid="swarm-metrics">MetricsDash</div>,
}));

vi.mock('../docker/topology/TopologyView', () => ({
  default: () => <div data-testid="swarm-topology">TopologyView</div>,
}));

describe('SwarmOverview', () => {
  it('shows Metrics by default and switches to Topology', async () => {
    const swarmState = await import('../docker/SwarmStateContext');
    const useSwarmStateMock = vi.mocked(swarmState.useSwarmState);
    useSwarmStateMock.mockReturnValue({ serverVersion: 'Docker 25.0', swarmActive: true } as unknown as SwarmStateContextValue);

    const { default: SwarmOverview } = await import('../docker/SwarmOverview');

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
    const swarmState = await import('../docker/SwarmStateContext');
    const useSwarmStateMock = vi.mocked(swarmState.useSwarmState);
    useSwarmStateMock.mockReturnValue({ serverVersion: '', swarmActive: false } as unknown as SwarmStateContextValue);

    const { default: SwarmOverview } = await import('../docker/SwarmOverview');

    const { rerender } = render(<SwarmOverview initialTab="topology" />);

    expect(await screen.findByTestId('swarm-topology')).toBeInTheDocument();
    expect(screen.getByText('(Standalone)')).toBeInTheDocument();

    rerender(<SwarmOverview initialTab="metrics" />);
    expect(await screen.findByTestId('swarm-metrics')).toBeInTheDocument();
  });
});
