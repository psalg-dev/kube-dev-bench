import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SecretInspectTab from '../docker/resources/secrets/SecretInspectTab';

// Mock the swarm API
vi.mock('../docker/swarmApi', () => ({
  GetSwarmSecretInspectJSON: vi.fn(),
}));

import * as SwarmAPI from '../docker/swarmApi';

const getInspectMock = SwarmAPI.GetSwarmSecretInspectJSON as ReturnType<typeof vi.fn>;

describe('SecretInspectTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading message while fetching data', () => {
      getInspectMock.mockImplementation(() => new Promise(() => {}));

      render(<SecretInspectTab secretId="secret-123" />);

      expect(screen.getByText(/Loading secret inspect/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      getInspectMock.mockRejectedValue(new Error('Secret not found'));

      render(<SecretInspectTab secretId="secret-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Secret not found/)).toBeInTheDocument();
      });
    });

    it('handles error without message property', async () => {
      getInspectMock.mockRejectedValue('Unknown error');

      render(<SecretInspectTab secretId="secret-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Unknown error/)).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    it('displays secret inspect JSON when loaded', async () => {
      const mockJson = JSON.stringify({ ID: 'secret-123', Version: { Index: 1 } });
      getInspectMock.mockResolvedValue(mockJson);

      render(<SecretInspectTab secretId="secret-123" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });

    it('handles empty response', async () => {
      getInspectMock.mockResolvedValue('');

      render(<SecretInspectTab secretId="secret-123" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });

    it('handles null response', async () => {
      getInspectMock.mockResolvedValue(null);

      render(<SecretInspectTab secretId="secret-123" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('API calls', () => {
    it('calls GetSwarmSecretInspectJSON with correct secretId', async () => {
      getInspectMock.mockResolvedValue('{}');

      render(<SecretInspectTab secretId="my-secret-id" />);

      await waitFor(() => {
        expect(getInspectMock).toHaveBeenCalledWith('my-secret-id');
      });
    });

    it('re-fetches when secretId changes', async () => {
      getInspectMock.mockResolvedValue('{}');

      const { rerender } = render(<SecretInspectTab secretId="secret-1" />);

      await waitFor(() => {
        expect(getInspectMock).toHaveBeenCalledWith('secret-1');
      });

      rerender(<SecretInspectTab secretId="secret-2" />);

      await waitFor(() => {
        expect(getInspectMock).toHaveBeenCalledWith('secret-2');
      });
    });
  });
});
