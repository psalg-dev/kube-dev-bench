import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { swarmApiMocks } = vi.hoisted(() => {
  return {
    swarmApiMocks: {
      GetSwarmNodeTasks: vi.fn(),
      GetSwarmTaskLogs: vi.fn(),
    },
  };
});

vi.mock('../docker/swarmApi.js', () => swarmApiMocks);

vi.mock('../components/AggregateLogsTab.jsx', () => ({
  default: function AggregateLogsTabMock({ title, loadLogs }) {
    return (
      <div data-testid="aggregate-logs">
        <div data-testid="logs-title">{title}</div>
        <button type="button" onClick={() => loadLogs()}>Load</button>
      </div>
    );
  },
}));

import NodeLogsTab from '../docker/resources/nodes/NodeLogsTab.jsx';

describe('NodeLogsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error state when tasks API fails', async () => {
    swarmApiMocks.GetSwarmNodeTasks.mockRejectedValue(new Error('boom'));

    render(<NodeLogsTab nodeId="node1" nodeName="worker-1" />);

    expect(await screen.findByText('Node Logs')).toBeInTheDocument();
    expect(screen.getByText(/Unable to load node tasks/)).toBeInTheDocument();
    expect(screen.getByText(/Error: boom/)).toBeInTheDocument();
  });

  it('shows no-task-with-containers message', async () => {
    swarmApiMocks.GetSwarmNodeTasks.mockResolvedValue([
      { id: 't1', state: 'running', containerId: '' },
      { id: 't2', state: 'running', containerId: null },
    ]);

    render(<NodeLogsTab nodeId="node1" nodeName="worker-1" />);

    expect(await screen.findByText('Node Logs')).toBeInTheDocument();
    expect(screen.getByText(/No tasks with containers/)).toBeInTheDocument();
  });

  it('selects a running task with container and wires AggregateLogsTab loadLogs', async () => {
    swarmApiMocks.GetSwarmNodeTasks.mockResolvedValue([
      { id: 't1', state: 'complete', containerId: 'c1', serviceName: 'api' },
      { id: 't2', state: 'running', containerId: 'c2', serviceName: 'web' },
    ]);
    swarmApiMocks.GetSwarmTaskLogs.mockResolvedValue('ok');

    render(<NodeLogsTab nodeId="node1" nodeName="worker-1" />);

    expect(await screen.findByTestId('aggregate-logs')).toBeInTheDocument();
    expect(screen.getByTestId('logs-title')).toHaveTextContent('Node Logs (task fallback: web');

    // clicking Load should call GetSwarmTaskLogs for selected running task (t2)
    screen.getByRole('button', { name: 'Load' }).click();
    expect(swarmApiMocks.GetSwarmTaskLogs).toHaveBeenCalledWith('t2', '200');
  });
});
