import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ConfigInspectTab from '../docker/resources/configs/ConfigInspectTab';

// Mock the swarm API
vi.mock('../docker/swarmApi.js', () => ({
  GetSwarmConfigInspectJSON: vi.fn(),
}));

import * as SwarmAPI from '../docker/swarmApi.js';

describe('ConfigInspectTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading message while fetching data', () => {
      SwarmAPI.GetSwarmConfigInspectJSON.mockImplementation(() => new Promise(() => {}));
      
      render(<ConfigInspectTab configId="config-123" />);
      
      expect(screen.getByText(/Loading config inspect/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      SwarmAPI.GetSwarmConfigInspectJSON.mockRejectedValue(new Error('Config not found'));
      
      render(<ConfigInspectTab configId="config-123" />);
      
      await waitFor(() => {
        expect(screen.getByText(/Config not found/)).toBeInTheDocument();
      });
    });

    it('handles error without message property', async () => {
      SwarmAPI.GetSwarmConfigInspectJSON.mockRejectedValue('Unknown error');
      
      render(<ConfigInspectTab configId="config-123" />);
      
      await waitFor(() => {
        expect(screen.getByText(/Unknown error/)).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    it('displays config inspect JSON when loaded', async () => {
      const mockJson = JSON.stringify({ ID: 'config-123', Version: { Index: 1 } });
      SwarmAPI.GetSwarmConfigInspectJSON.mockResolvedValue(mockJson);
      
      render(<ConfigInspectTab configId="config-123" />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });

    it('handles empty response', async () => {
      SwarmAPI.GetSwarmConfigInspectJSON.mockResolvedValue('');
      
      render(<ConfigInspectTab configId="config-123" />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });

    it('handles null response', async () => {
      SwarmAPI.GetSwarmConfigInspectJSON.mockResolvedValue(null);
      
      render(<ConfigInspectTab configId="config-123" />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('API calls', () => {
    it('calls GetSwarmConfigInspectJSON with correct configId', async () => {
      SwarmAPI.GetSwarmConfigInspectJSON.mockResolvedValue('{}');
      
      render(<ConfigInspectTab configId="my-config-id" />);
      
      await waitFor(() => {
        expect(SwarmAPI.GetSwarmConfigInspectJSON).toHaveBeenCalledWith('my-config-id');
      });
    });

    it('re-fetches when configId changes', async () => {
      SwarmAPI.GetSwarmConfigInspectJSON.mockResolvedValue('{}');
      
      const { rerender } = render(<ConfigInspectTab configId="config-1" />);
      
      await waitFor(() => {
        expect(SwarmAPI.GetSwarmConfigInspectJSON).toHaveBeenCalledWith('config-1');
      });

      rerender(<ConfigInspectTab configId="config-2" />);
      
      await waitFor(() => {
        expect(SwarmAPI.GetSwarmConfigInspectJSON).toHaveBeenCalledWith('config-2');
      });
    });
  });
});
