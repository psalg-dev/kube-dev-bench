import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import NetworkConnectedContainersTable from '../docker/resources/networks/NetworkConnectedContainersTable';

vi.mock('../docker/swarmApi', () => ({
  GetSwarmNetworkContainers: vi.fn(),
}));

vi.mock('../utils/resourceNavigation', () => ({
  navigateToResource: vi.fn(),
}));

import { GetSwarmNetworkContainers } from '../docker/swarmApi';
const getContainersMock = vi.mocked(GetSwarmNetworkContainers);

describe('NetworkConnectedContainersTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state when networkId is provided', () => {
    getContainersMock.mockImplementation(() => new Promise(() => {}));
    render(<NetworkConnectedContainersTable networkId="net123" />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows empty state when networkId is not provided', async () => {
    render(<NetworkConnectedContainersTable networkId="" />);
    await waitFor(() => {
      expect(screen.getByText(/Containers \(Tasks\)/i)).toBeInTheDocument();
    });
  });

  it('shows error when API fails', async () => {
    getContainersMock.mockRejectedValue(new Error('network error'));
    render(<NetworkConnectedContainersTable networkId="net123" />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load containers: network error/i)).toBeInTheDocument();
    });
  });

  it('renders column headers when tasks exist', async () => {
    getContainersMock.mockResolvedValue([
      { id: 'task1', serviceName: 'my-service', state: 'running', desiredState: 'running', nodeId: 'node1', nodeName: 'node-1', containerId: 'cont123', slot: 1 },
    ] as never);
    render(<NetworkConnectedContainersTable networkId="net123" />);
    await waitFor(() => {
      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('Task ID')).toBeInTheDocument();
      expect(screen.getByText('State')).toBeInTheDocument();
      expect(screen.getByText('Node')).toBeInTheDocument();
    });
  });

  it('renders task rows', async () => {
    getContainersMock.mockResolvedValue([
      { id: 'abc123def456', serviceName: 'web-service', state: 'running', desiredState: 'running', nodeId: 'node1', nodeName: 'worker-1', containerId: 'cont456', slot: 1 },
    ] as never);
    render(<NetworkConnectedContainersTable networkId="net123" />);
    await waitFor(() => {
      expect(screen.getByText('web-service')).toBeInTheDocument();
    });
  });

  it('shows containers count in header when tasks exist', async () => {
    getContainersMock.mockResolvedValue([
      { id: 'task1', serviceName: 'svc1', state: 'running', desiredState: 'running', nodeId: 'n1', nodeName: 'node-1', containerId: 'c1', slot: 1 },
      { id: 'task2', serviceName: 'svc2', state: 'running', desiredState: 'running', nodeId: 'n2', nodeName: 'node-2', containerId: 'c2', slot: 1 },
    ] as never);
    render(<NetworkConnectedContainersTable networkId="net123" />);
    await waitFor(() => {
      expect(screen.getByText(/Containers \(Tasks\) \(2\)/i)).toBeInTheDocument();
    });
  });

  it('renders compact mode with fewer columns', async () => {
    getContainersMock.mockResolvedValue([
      { id: 'task1', serviceName: 'my-svc', state: 'running', desiredState: 'running', nodeId: 'n1', nodeName: 'node-1', containerId: 'c1', slot: 1 },
    ] as never);
    render(<NetworkConnectedContainersTable networkId="net123" compact={true} />);
    await waitFor(() => {
      expect(screen.getByText('Service')).toBeInTheDocument();
      // In compact mode, 'Slot' column should not be present
      expect(screen.queryByText('Slot')).not.toBeInTheDocument();
    });
  });
});
