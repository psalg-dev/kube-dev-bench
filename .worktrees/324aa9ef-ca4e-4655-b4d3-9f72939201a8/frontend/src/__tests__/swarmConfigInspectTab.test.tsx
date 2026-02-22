import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ConfigInspectTab from '../docker/resources/configs/ConfigInspectTab';

const mockGetSwarmConfigInspectJSON = vi.fn();

// Mock the swarm API
vi.mock('../docker/swarmApi', () => ({
  GetSwarmConfigInspectJSON: (...args: unknown[]) => mockGetSwarmConfigInspectJSON(...args),
}));

describe('ConfigInspectTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading message while fetching data', () => {
      mockGetSwarmConfigInspectJSON.mockImplementation(() => new Promise(() => {}));

      render(<ConfigInspectTab configId="config-123" />);

      expect(screen.getByText(/Loading config inspect/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      mockGetSwarmConfigInspectJSON.mockRejectedValue(new Error('Config not found'));

      render(<ConfigInspectTab configId="config-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Config not found/)).toBeInTheDocument();
      });
    });

    it('handles error without message property', async () => {
      mockGetSwarmConfigInspectJSON.mockRejectedValue('Unknown error');

      render(<ConfigInspectTab configId="config-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Unknown error/)).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    it('displays config inspect JSON when loaded', async () => {
      const mockJson = JSON.stringify({ ID: 'config-123', Version: { Index: 1 } });
      mockGetSwarmConfigInspectJSON.mockResolvedValue(mockJson);

      render(<ConfigInspectTab configId="config-123" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });

    it('handles empty response', async () => {
      mockGetSwarmConfigInspectJSON.mockResolvedValue('');

      render(<ConfigInspectTab configId="config-123" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });

    it('handles null response', async () => {
      mockGetSwarmConfigInspectJSON.mockResolvedValue(null);

      render(<ConfigInspectTab configId="config-123" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('API calls', () => {
    it('calls GetSwarmConfigInspectJSON with correct configId', async () => {
      mockGetSwarmConfigInspectJSON.mockResolvedValue('{}');

      render(<ConfigInspectTab configId="my-config-id" />);

      await waitFor(() => {
        expect(mockGetSwarmConfigInspectJSON).toHaveBeenCalledWith('my-config-id');
      });
    });

    it('re-fetches when configId changes', async () => {
      mockGetSwarmConfigInspectJSON.mockResolvedValue('{}');

      const { rerender } = render(<ConfigInspectTab configId="config-1" />);

      await waitFor(() => {
        expect(mockGetSwarmConfigInspectJSON).toHaveBeenCalledWith('config-1');
      });

      rerender(<ConfigInspectTab configId="config-2" />);

      await waitFor(() => {
        expect(mockGetSwarmConfigInspectJSON).toHaveBeenCalledWith('config-2');
      });
    });
  });
});
