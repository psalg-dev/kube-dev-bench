import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../docker/swarmApi.js', () => ({
  GetSwarmMetricsHistory: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../wailsjs/runtime/runtime.js', () => ({
  EventsOn: vi.fn(() => () => {}),
  EventsOff: vi.fn(),
}));

import SwarmMetricsDashboard from '../docker/metrics/SwarmMetricsDashboard.jsx';

function iso(msAgo) {
  return new Date(Date.now() - msAgo).toISOString();
}

describe('SwarmMetricsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters charts by selected time range', async () => {
    const { GetSwarmMetricsHistory } = await import('../docker/swarmApi.js');
    GetSwarmMetricsHistory.mockResolvedValueOnce([
      { timestamp: iso(10 * 60 * 1000), runningTasks: 1, services: 1, cpuCapacityNano: 1e9, cpuReservationsNano: 5e8 },
      { timestamp: iso(5 * 60 * 1000), runningTasks: 2, services: 2, cpuCapacityNano: 1e9, cpuReservationsNano: 5e8 },
    ]);

    render(<SwarmMetricsDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('swarm-metrics-dashboard')).toBeTruthy();
    });

    const user = userEvent.setup();
    const select = screen.getByLabelText(/range/i);

    await user.selectOptions(select, '60');

    await waitFor(() => {
      expect(screen.getByText(/\(0 points\)/i)).toBeTruthy();
    });
  });
});
