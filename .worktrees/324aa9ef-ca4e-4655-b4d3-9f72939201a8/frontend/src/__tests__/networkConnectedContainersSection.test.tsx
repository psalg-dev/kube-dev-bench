import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NetworkConnectedContainersSection from '../docker/resources/networks/NetworkConnectedContainersSection';
import type { docker } from '../../wailsjs/go/models';

// Mock swarmApi
vi.mock('../docker/swarmApi', () => ({
  GetSwarmNetworkContainers: vi.fn(),
}));

// Mock navigation
vi.mock('../utils/resourceNavigation', () => ({
  navigateToResource: vi.fn(),
}));

import { GetSwarmNetworkContainers } from '../docker/swarmApi';
import { navigateToResource } from '../utils/resourceNavigation';

const getSwarmNetworkContainersMock = vi.mocked(GetSwarmNetworkContainers);

describe('NetworkConnectedContainersSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      getSwarmNetworkContainersMock.mockImplementation(() => new Promise(() => {}));

      render(<NetworkConnectedContainersSection networkId="net-abc123" />);

      expect(screen.getByText(/Loading/)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      getSwarmNetworkContainersMock.mockRejectedValue(new Error('Network not found'));

      render(<NetworkConnectedContainersSection networkId="net-abc123" />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load containers/)).toBeInTheDocument();
        expect(screen.getByText(/Network not found/)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows empty state when no containers connected', async () => {
      getSwarmNetworkContainersMock.mockResolvedValue([]);

      render(<NetworkConnectedContainersSection networkId="net-abc123" />);

      await waitFor(() => {
        expect(screen.getByText('Containers (Tasks)')).toBeInTheDocument();
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    it('displays header', () => {
      getSwarmNetworkContainersMock.mockResolvedValue([]);

      render(<NetworkConnectedContainersSection networkId="net-abc123" />);

      return waitFor(() => {
        expect(screen.getByText('Containers (Tasks)')).toBeInTheDocument();
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });
    });

    it('displays description text', () => {
      getSwarmNetworkContainersMock.mockResolvedValue([]);

      render(<NetworkConnectedContainersSection networkId="net-abc123" />);

      return waitFor(() => {
        expect(screen.getByText(/Swarm attaches tasks/)).toBeInTheDocument();
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    it('navigates to task when clicked', async () => {
      getSwarmNetworkContainersMock.mockResolvedValue([
        { id: 'task-123', serviceName: 'web-service', slot: 1 } as docker.SwarmTaskInfo,
      ]);

      render(<NetworkConnectedContainersSection networkId="net-abc123" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });

      const taskItems = screen.getAllByRole('button');
      if (taskItems.length > 0) {
        fireEvent.click(taskItems[0]);
      }

      // Verify navigation was called
      expect(navigateToResource).toHaveBeenCalled();
    });
  });

  describe('API calls', () => {
    it('calls API with correct networkId', async () => {
      getSwarmNetworkContainersMock.mockResolvedValue([]);

      render(<NetworkConnectedContainersSection networkId="my-network-id" />);

      await waitFor(() => {
        expect(GetSwarmNetworkContainers).toHaveBeenCalledWith('my-network-id');
      });
    });

    it('re-fetches when networkId changes', async () => {
      getSwarmNetworkContainersMock.mockResolvedValue([]);

      const { rerender } = render(<NetworkConnectedContainersSection networkId="net-1" />);

      await waitFor(() => {
        expect(GetSwarmNetworkContainers).toHaveBeenCalledWith('net-1');
      });

      rerender(<NetworkConnectedContainersSection networkId="net-2" />);

      await waitFor(() => {
        expect(GetSwarmNetworkContainers).toHaveBeenCalledWith('net-2');
      });
    });
  });
});
