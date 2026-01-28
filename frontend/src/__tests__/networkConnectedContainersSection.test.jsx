import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NetworkConnectedContainersSection from '../docker/resources/networks/NetworkConnectedContainersSection';

// Mock swarmApi
vi.mock('../docker/swarmApi.js', () => ({
  GetSwarmNetworkContainers: vi.fn(),
}));

// Mock navigation
vi.mock('../utils/resourceNavigation', () => ({
  navigateToResource: vi.fn(),
}));

import { GetSwarmNetworkContainers } from '../docker/swarmApi.js';
import { navigateToResource } from '../utils/resourceNavigation';

describe('NetworkConnectedContainersSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      GetSwarmNetworkContainers.mockImplementation(() => new Promise(() => {}));

      render(<NetworkConnectedContainersSection networkId="net-abc123" />);

      expect(screen.getByText(/Loading/)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      GetSwarmNetworkContainers.mockRejectedValue(
        new Error('Network not found'),
      );

      render(<NetworkConnectedContainersSection networkId="net-abc123" />);

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to load containers/),
        ).toBeInTheDocument();
        expect(screen.getByText(/Network not found/)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows empty state when no containers connected', async () => {
      GetSwarmNetworkContainers.mockResolvedValue([]);

      render(<NetworkConnectedContainersSection networkId="net-abc123" />);

      await waitFor(() => {
        expect(screen.getByText('Containers (Tasks)')).toBeInTheDocument();
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    it('displays header', () => {
      GetSwarmNetworkContainers.mockResolvedValue([]);

      render(<NetworkConnectedContainersSection networkId="net-abc123" />);

      expect(screen.getByText('Containers (Tasks)')).toBeInTheDocument();
    });

    it('displays description text', () => {
      GetSwarmNetworkContainers.mockResolvedValue([]);

      render(<NetworkConnectedContainersSection networkId="net-abc123" />);

      expect(screen.getByText(/Swarm attaches tasks/)).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('navigates to task when clicked', async () => {
      GetSwarmNetworkContainers.mockResolvedValue([
        { id: 'task-123', serviceName: 'web-service', slot: 1 },
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
      GetSwarmNetworkContainers.mockResolvedValue([]);

      render(<NetworkConnectedContainersSection networkId="my-network-id" />);

      await waitFor(() => {
        expect(GetSwarmNetworkContainers).toHaveBeenCalledWith('my-network-id');
      });
    });

    it('re-fetches when networkId changes', async () => {
      GetSwarmNetworkContainers.mockResolvedValue([]);

      const { rerender } = render(
        <NetworkConnectedContainersSection networkId="net-1" />,
      );

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
