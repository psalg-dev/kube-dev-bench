import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import StackServicesTab from '../docker/resources/stacks/StackServicesTab';
import type { docker } from '../../wailsjs/go/models';

vi.mock('../docker/swarmApi', () => ({
  GetSwarmStackServices: vi.fn(),
}));

vi.mock('../utils/resourceNavigation', () => ({
  navigateToResource: vi.fn(),
}));

import { GetSwarmStackServices } from '../docker/swarmApi';
const getSwarmStackServicesMock = vi.mocked(GetSwarmStackServices);

describe('StackServicesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no services', async () => {
    getSwarmStackServicesMock.mockResolvedValue([] as docker.SwarmServiceInfo[]);
    render(<StackServicesTab stackName="my-stack" />);
    await waitFor(() => {
      expect(screen.queryByText(/Loading services/)).not.toBeInTheDocument();
    });
  });

  it('shows error when API call fails', async () => {
    getSwarmStackServicesMock.mockRejectedValue(new Error('Stack not found'));
    render(<StackServicesTab stackName="my-stack" />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load services/)).toBeInTheDocument();
      expect(screen.getByText(/Stack not found/)).toBeInTheDocument();
    });
  });

  it('renders table columns when services exist', async () => {
    getSwarmStackServicesMock.mockResolvedValue([
      { id: 'svc-1', name: 'my-stack_web', image: 'nginx:latest', mode: 'replicated', replicas: 2, runningTasks: 2, createdAt: '2024-01-01T00:00:00Z' } as docker.SwarmServiceInfo,
    ]);
    render(<StackServicesTab stackName="my-stack" />);
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Image')).toBeInTheDocument();
      expect(screen.getByText('Mode')).toBeInTheDocument();
      expect(screen.getByText('Replicas')).toBeInTheDocument();
    });
  });

  it('strips stack prefix from service name', async () => {
    getSwarmStackServicesMock.mockResolvedValue([
      { id: 'svc-1', name: 'mystack_api', image: 'node:18', mode: 'replicated', replicas: 1, runningTasks: 1 } as docker.SwarmServiceInfo,
    ]);
    render(<StackServicesTab stackName="mystack" />);
    await waitFor(() => {
      // Strip prefix "mystack_" → "api"
      expect(screen.getByText('api')).toBeInTheDocument();
    });
  });

  it('renders image column data', async () => {
    getSwarmStackServicesMock.mockResolvedValue([
      { id: 'svc-1', name: 'stack_web', image: 'nginx:1.25', mode: 'replicated', replicas: 3, runningTasks: 3 } as docker.SwarmServiceInfo,
    ]);
    render(<StackServicesTab stackName="stack" />);
    await waitFor(() => {
      expect(screen.getByText('nginx:1.25')).toBeInTheDocument();
    });
  });

  it('renders replica counts', async () => {
    getSwarmStackServicesMock.mockResolvedValue([
      { id: 'svc-1', name: 'stack_svc', image: 'redis:7', mode: 'replicated', replicas: 3, runningTasks: 2 } as docker.SwarmServiceInfo,
    ]);
    render(<StackServicesTab stackName="stack" />);
    await waitFor(() => {
      expect(screen.getByText('2/3')).toBeInTheDocument();
    });
  });

  it('calls API with stackName', async () => {
    getSwarmStackServicesMock.mockResolvedValue([]);
    render(<StackServicesTab stackName="my-app-stack" />);
    await waitFor(() => {
      expect(getSwarmStackServicesMock).toHaveBeenCalledWith('my-app-stack');
    });
  });

  it('does not call API when stackName is missing', () => {
    render(<StackServicesTab />);
    expect(getSwarmStackServicesMock).not.toHaveBeenCalled();
  });
});
