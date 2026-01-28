import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SecretUsedBySection from '../docker/resources/secrets/SecretUsedBySection';

// Mock swarmApi
vi.mock('../docker/swarmApi.js', () => ({
  GetSwarmSecretUsage: vi.fn(),
}));

// Mock navigation
vi.mock('../utils/resourceNavigation', () => ({
  navigateToResource: vi.fn(),
}));

import { GetSwarmSecretUsage } from '../docker/swarmApi.js';
import { navigateToResource } from '../utils/resourceNavigation';

describe('SecretUsedBySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      GetSwarmSecretUsage.mockImplementation(() => new Promise(() => {}));

      render(<SecretUsedBySection secretId="secret-abc123" />);

      expect(screen.getByText(/Loading/)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      GetSwarmSecretUsage.mockRejectedValue(new Error('Secret not found'));

      render(<SecretUsedBySection secretId="secret-abc123" />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load usage/)).toBeInTheDocument();
        expect(screen.getByText(/Secret not found/)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows empty state when no services use the secret', async () => {
      GetSwarmSecretUsage.mockResolvedValue([]);

      render(<SecretUsedBySection secretId="secret-abc123" />);

      await waitFor(() => {
        expect(screen.getByText('Used By')).toBeInTheDocument();
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    const mockServices = [
      { serviceId: 'svc-1', serviceName: 'web-service' },
      { serviceId: 'svc-2', serviceName: 'api-service' },
    ];

    it('displays list of services using the secret', async () => {
      GetSwarmSecretUsage.mockResolvedValue(mockServices);

      render(<SecretUsedBySection secretId="secret-abc123" />);

      await waitFor(() => {
        expect(screen.getByText('web-service')).toBeInTheDocument();
        expect(screen.getByText('api-service')).toBeInTheDocument();
      });
    });

    it('displays Used By header', async () => {
      GetSwarmSecretUsage.mockResolvedValue(mockServices);

      render(<SecretUsedBySection secretId="secret-abc123" />);

      expect(screen.getByText('Used By')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('navigates to service when clicked', async () => {
      GetSwarmSecretUsage.mockResolvedValue([
        { serviceId: 'svc-1', serviceName: 'web-service' },
      ]);

      render(<SecretUsedBySection secretId="secret-abc123" />);

      await waitFor(() => {
        expect(screen.getByText('web-service')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('web-service'));

      expect(navigateToResource).toHaveBeenCalledWith({
        resource: 'SwarmService',
        name: 'web-service',
      });
    });

    it('navigates to service on keyboard enter', async () => {
      GetSwarmSecretUsage.mockResolvedValue([
        { serviceId: 'svc-1', serviceName: 'web-service' },
      ]);

      render(<SecretUsedBySection secretId="secret-abc123" />);

      await waitFor(() => {
        expect(screen.getByText('web-service')).toBeInTheDocument();
      });

      fireEvent.keyDown(screen.getByText('web-service'), { key: 'Enter' });

      expect(navigateToResource).toHaveBeenCalled();
    });
  });

  describe('API calls', () => {
    it('calls API with correct secretId', async () => {
      GetSwarmSecretUsage.mockResolvedValue([]);

      render(<SecretUsedBySection secretId="my-secret-id" />);

      await waitFor(() => {
        expect(GetSwarmSecretUsage).toHaveBeenCalledWith('my-secret-id');
      });
    });

    it('re-fetches when secretId changes', async () => {
      GetSwarmSecretUsage.mockResolvedValue([]);

      const { rerender } = render(<SecretUsedBySection secretId="secret-1" />);

      await waitFor(() => {
        expect(GetSwarmSecretUsage).toHaveBeenCalledWith('secret-1');
      });

      rerender(<SecretUsedBySection secretId="secret-2" />);

      await waitFor(() => {
        expect(GetSwarmSecretUsage).toHaveBeenCalledWith('secret-2');
      });
    });
  });
});
