import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import NetworkConnectedContainersTable from '../docker/resources/networks/NetworkConnectedContainersTable';
import type { docker } from '../../wailsjs/go/models';

vi.mock('../docker/swarmApi', () => ({
  GetSwarmNetworkContainers: vi.fn(),
}));

vi.mock('../utils/resourceNavigation', () => ({
  navigateToResource: vi.fn(),
}));

import { GetSwarmNetworkContainers } from '../docker/swarmApi';
const getSwarmNetworkContainersMock = vi.mocked(GetSwarmNetworkContainers);

describe('NetworkConnectedContainersTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getSwarmNetworkContainersMock.mockImplementation(() => new Promise(() => {}));
    render(<NetworkConnectedContainersTable networkId="net-abc" />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows Containers (Tasks) header while loading', () => {
    getSwarmNetworkContainersMock.mockImplementation(() => new Promise(() => {}));
    render(<NetworkConnectedContainersTable networkId="net-abc" />);
    expect(screen.getByText('Containers (Tasks)')).toBeInTheDocument();
  });

  it('shows error when API call fails', async () => {
    getSwarmNetworkContainersMock.mockRejectedValue(new Error('Network error'));
    render(<NetworkConnectedContainersTable networkId="net-abc" />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load containers/)).toBeInTheDocument();
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no tasks', async () => {
    getSwarmNetworkContainersMock.mockResolvedValue([] as docker.SwarmTaskInfo[]);
    render(<NetworkConnectedContainersTable networkId="net-abc" />);
    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });
  });

  it('renders table columns when tasks exist', async () => {
    getSwarmNetworkContainersMock.mockResolvedValue([
      { id: 'task-1', serviceName: 'web', state: 'running', nodeName: 'node-1' } as docker.SwarmTaskInfo,
    ]);
    render(<NetworkConnectedContainersTable networkId="net-abc" />);
    await waitFor(() => {
      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('Task ID')).toBeInTheDocument();
      expect(screen.getByText('State')).toBeInTheDocument();
      expect(screen.getByText('Node')).toBeInTheDocument();
    });
  });

  it('renders service name in table', async () => {
    getSwarmNetworkContainersMock.mockResolvedValue([
      { id: 'task-abc123', serviceName: 'my-web-service', state: 'running', nodeName: 'worker-1' } as docker.SwarmTaskInfo,
    ]);
    render(<NetworkConnectedContainersTable networkId="net-abc" />);
    await waitFor(() => {
      expect(screen.getByText('my-web-service')).toBeInTheDocument();
    });
  });

  it('shows container count in title when tasks are present', async () => {
    getSwarmNetworkContainersMock.mockResolvedValue([
      { id: 'task-1', serviceName: 'svc-a', state: 'running' } as docker.SwarmTaskInfo,
      { id: 'task-2', serviceName: 'svc-b', state: 'running' } as docker.SwarmTaskInfo,
    ]);
    render(<NetworkConnectedContainersTable networkId="net-abc" />);
    await waitFor(() => {
      expect(screen.getByText('Containers (Tasks) (2)')).toBeInTheDocument();
    });
  });

  it('calls API with correct networkId', async () => {
    getSwarmNetworkContainersMock.mockResolvedValue([]);
    render(<NetworkConnectedContainersTable networkId="network-xyz" />);
    await waitFor(() => {
      expect(getSwarmNetworkContainersMock).toHaveBeenCalledWith('network-xyz');
    });
  });

  it('renders compact mode without Slot/Desired/Container ID/Error columns', async () => {
    getSwarmNetworkContainersMock.mockResolvedValue([
      { id: 'task-1', serviceName: 'web', state: 'running', nodeName: 'node-1' } as docker.SwarmTaskInfo,
    ]);
    render(<NetworkConnectedContainersTable networkId="net-abc" compact={true} />);
    await waitFor(() => {
      expect(screen.queryByText('Slot')).not.toBeInTheDocument();
      expect(screen.queryByText('Desired')).not.toBeInTheDocument();
    });
  });

  it('handles missing networkId gracefully', async () => {
    render(<NetworkConnectedContainersTable />);
    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });
    expect(getSwarmNetworkContainersMock).not.toHaveBeenCalled();
  });
});
