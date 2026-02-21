import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import NetworkInspectTab from '../docker/resources/networks/NetworkInspectTab';

const mockGetSwarmNetworkInspectJSON = vi.fn();

// Mock the swarm API
vi.mock('../docker/swarmApi', () => ({
  GetSwarmNetworkInspectJSON: (...args: unknown[]) => mockGetSwarmNetworkInspectJSON(...args),
}));

describe('NetworkInspectTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading message while fetching data', () => {
      mockGetSwarmNetworkInspectJSON.mockImplementation(() => new Promise(() => {}));

      render(<NetworkInspectTab networkId="network-123" />);

      expect(screen.getByText(/Loading network inspect/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      mockGetSwarmNetworkInspectJSON.mockRejectedValue(new Error('Network not found'));

      render(<NetworkInspectTab networkId="network-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Network not found/)).toBeInTheDocument();
      });
    });

    it('handles error without message property', async () => {
      mockGetSwarmNetworkInspectJSON.mockRejectedValue('Unknown error');

      render(<NetworkInspectTab networkId="network-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Unknown error/)).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    it('displays network inspect JSON when loaded', async () => {
      const mockJson = JSON.stringify({
        Name: 'my-network',
        Id: 'network-123',
        Driver: 'overlay',
      });
      mockGetSwarmNetworkInspectJSON.mockResolvedValue(mockJson);

      render(<NetworkInspectTab networkId="network-123" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });

    it('handles empty response', async () => {
      mockGetSwarmNetworkInspectJSON.mockResolvedValue('');

      render(<NetworkInspectTab networkId="network-123" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });

    it('handles null response', async () => {
      mockGetSwarmNetworkInspectJSON.mockResolvedValue(null);

      render(<NetworkInspectTab networkId="network-123" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('API calls', () => {
    it('calls GetSwarmNetworkInspectJSON with correct networkId', async () => {
      mockGetSwarmNetworkInspectJSON.mockResolvedValue('{}');

      render(<NetworkInspectTab networkId="my-network-id" />);

      await waitFor(() => {
        expect(mockGetSwarmNetworkInspectJSON).toHaveBeenCalledWith('my-network-id');
      });
    });

    it('re-fetches when networkId changes', async () => {
      mockGetSwarmNetworkInspectJSON.mockResolvedValue('{}');

      const { rerender } = render(<NetworkInspectTab networkId="network-1" />);

      await waitFor(() => {
        expect(mockGetSwarmNetworkInspectJSON).toHaveBeenCalledWith('network-1');
      });

      rerender(<NetworkInspectTab networkId="network-2" />);

      await waitFor(() => {
        expect(mockGetSwarmNetworkInspectJSON).toHaveBeenCalledWith('network-2');
      });
    });
  });
});
