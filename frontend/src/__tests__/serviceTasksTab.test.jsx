import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, act } from '@testing-library/react';

const { runtimeHandlers, swarmApiMocks } = vi.hoisted(() => {
  return {
    runtimeHandlers: new Map(),
    swarmApiMocks: {
      GetSwarmTasksByService: vi.fn(),
    },
  };
});

vi.mock('../docker/swarmApi.js', () => swarmApiMocks);

// ServiceTasksTab imports "../../../../wailsjs/runtime" (package.json points to runtime.js)
vi.mock('../../wailsjs/runtime', () => ({
  EventsOn: vi.fn((eventName, cb) => {
    runtimeHandlers.set(eventName, cb);
    return vi.fn();
  }),
}));

vi.mock('../docker/resources/tasks/HealthStatusBadge.jsx', () => ({
  default: function HealthStatusBadgeMock({ status }) {
    return <div data-testid="health-badge">{status || '-'}</div>;
  },
}));

import ServiceTasksTab from '../docker/resources/services/ServiceTasksTab.jsx';

function emit(eventName, payload) {
  const cb = runtimeHandlers.get(eventName);
  if (!cb) throw new Error(`No handler registered for ${eventName}`);
  cb(payload);
}

describe('ServiceTasksTab', () => {
  beforeEach(() => {
    runtimeHandlers.clear();
    vi.clearAllMocks();
  });

  it('loads tasks and renders a table with state colors', async () => {
    swarmApiMocks.GetSwarmTasksByService.mockResolvedValue([
      {
        id: 'task1234567890abcdef',
        serviceId: 'svc1',
        nodeName: 'node-a',
        slot: 1,
        state: 'running',
        healthStatus: 'healthy',
        desiredState: 'running',
        containerId: 'cont1234567890abcdef',
        error: '',
      },
      {
        id: 'task2',
        serviceId: 'svc1',
        nodeId: 'nodeid1234567890',
        slot: null,
        state: 'failed',
        healthStatus: 'unhealthy',
        desiredState: 'shutdown',
        containerId: null,
        error: 'boom',
      },
    ]);

    render(<ServiceTasksTab serviceId="svc1" serviceName="api" />);

    expect(screen.getByText('Loading tasks...')).toBeInTheDocument();

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBeGreaterThanOrEqual(3); // header + 2

    // running task state color (avoid collision with Desired State column)
    const runningState = screen
      .getAllByText('running')
      .find((el) => el.classList?.contains('task-state'));
    expect(runningState).toBeTruthy();
    expect(runningState).toHaveStyle({ color: '#3fb950' });

    // failed task state color
    const failedState = screen.getByText('failed');
    expect(failedState).toHaveStyle({ color: '#f85149' });

    // health badge mocked
    expect(screen.getAllByTestId('health-badge')[0]).toHaveTextContent(
      'healthy',
    );

    expect(swarmApiMocks.GetSwarmTasksByService).toHaveBeenCalledWith('svc1');
  });

  it('shows empty state when no tasks returned', async () => {
    swarmApiMocks.GetSwarmTasksByService.mockResolvedValue([]);

    render(<ServiceTasksTab serviceId="svc1" serviceName="api" />);

    expect(
      await screen.findByText('No tasks found for this service.'),
    ).toBeInTheDocument();
  });

  it('filters runtime task updates by serviceId', async () => {
    swarmApiMocks.GetSwarmTasksByService.mockResolvedValue([]);

    render(<ServiceTasksTab serviceId="svc1" serviceName="api" />);
    await screen.findByText('No tasks found for this service.');

    act(() => {
      emit('swarm:tasks:update', [
        {
          id: 't1',
          serviceId: 'svc1',
          state: 'running',
          desiredState: 'running',
        },
        {
          id: 't2',
          serviceId: 'svc2',
          state: 'running',
          desiredState: 'running',
        },
      ]);
    });

    await waitFor(() => {
      expect(
        screen.queryByText('No tasks found for this service.'),
      ).not.toBeInTheDocument();
    });

    expect(screen.getByTitle('t1')).toBeInTheDocument();
    expect(screen.queryByTitle('t2')).not.toBeInTheDocument();
  });

  it('handles API errors by showing empty state', async () => {
    swarmApiMocks.GetSwarmTasksByService.mockRejectedValue(new Error('nope'));

    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ServiceTasksTab serviceId="svc1" serviceName="api" />);

    expect(
      await screen.findByText('No tasks found for this service.'),
    ).toBeInTheDocument();

    err.mockRestore();
  });
});
