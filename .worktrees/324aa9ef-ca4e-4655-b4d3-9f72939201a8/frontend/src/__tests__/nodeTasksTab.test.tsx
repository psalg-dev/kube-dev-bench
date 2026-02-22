import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const { swarmApiMocks } = vi.hoisted(() => {
  return {
    swarmApiMocks: {
      GetSwarmNodeTasks: vi.fn(),
    },
  };
});

vi.mock('../docker/swarmApi', () => swarmApiMocks);

vi.mock('../docker/resources/tasks/HealthStatusBadge', () => ({
  default: function HealthStatusBadgeMock({ status }: { status?: string }) {
    return <div data-testid="health-badge">{status || '-'}</div>;
  },
}));

import NodeTasksTab from '../docker/resources/nodes/NodeTasksTab';

describe('NodeTasksTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no tasks', async () => {
    swarmApiMocks.GetSwarmNodeTasks.mockResolvedValue([]);

    render(<NodeTasksTab nodeId="node1" nodeName="worker-1" />);

    expect(await screen.findByText('No tasks running on this node.')).toBeInTheDocument();
  });

  it('renders tasks table and state colors', async () => {
    swarmApiMocks.GetSwarmNodeTasks.mockResolvedValue([
      {
        id: 'task1234567890abcdef',
        serviceId: 'svc1',
        serviceName: 'api',
        state: 'running',
        desiredState: 'running',
        healthStatus: 'healthy',
        containerId: 'cont1234567890abcdef',
      },
      {
        id: 'task2',
        serviceId: 'svc1',
        serviceName: 'api',
        state: 'failed',
        desiredState: 'shutdown',
        healthStatus: 'unhealthy',
        containerId: null,
      },
    ]);

    render(<NodeTasksTab nodeId="node1" nodeName="worker-1" />);

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBeGreaterThanOrEqual(3);

    const runningSpan = screen.getAllByText('running').find((el) => el.tagName.toLowerCase() === 'span');
    expect(runningSpan).toHaveStyle({ color: '#3fb950' });

    const failedSpan = screen.getByText('failed');
    expect(failedSpan).toHaveStyle({ color: '#f85149' });

    expect(screen.getAllByTestId('health-badge')[0]).toHaveTextContent('healthy');
  });
});
