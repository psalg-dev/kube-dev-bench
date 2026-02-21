import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NetworkConnectedServicesSection from '../docker/resources/networks/NetworkConnectedServicesSection';

// Mock swarmApi
vi.mock('../docker/swarmApi', () => ({
  GetSwarmNetworkServices: vi.fn(),
}));

// Mock navigation
vi.mock('../utils/resourceNavigation', () => ({
  navigateToResource: vi.fn(),
}));

import { GetSwarmNetworkServices } from '../docker/swarmApi';
import { navigateToResource } from '../utils/resourceNavigation';

const getSwarmNetworkServicesMock = vi.mocked(GetSwarmNetworkServices);

describe('NetworkConnectedServicesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      getSwarmNetworkServicesMock.mockImplementation(() => new Promise(() => {}));

      render(<NetworkConnectedServicesSection networkId="net-abc123" />);

      expect(screen.getByText(/Loading/)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      getSwarmNetworkServicesMock.mockRejectedValue(new Error('Network not found'));

      render(<NetworkConnectedServicesSection networkId="net-abc123" />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load services/)).toBeInTheDocument();
        expect(screen.getByText(/Network not found/)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows empty state when no services connected', async () => {
      getSwarmNetworkServicesMock.mockResolvedValue([]);

      render(<NetworkConnectedServicesSection networkId="net-abc123" />);

      await waitFor(() => {
        expect(screen.getByText('Connected Services')).toBeInTheDocument();
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    const mockServices = [
      { serviceId: 'svc-1', serviceName: 'web-service' },
      { serviceId: 'svc-2', serviceName: 'api-service' },
    ];

    it('displays list of connected services', async () => {
      getSwarmNetworkServicesMock.mockResolvedValue(mockServices);

      render(<NetworkConnectedServicesSection networkId="net-abc123" />);

      await waitFor(() => {
        expect(screen.getByText('web-service')).toBeInTheDocument();
        expect(screen.getByText('api-service')).toBeInTheDocument();
      });
    });

    it('displays Connected Services header', async () => {
      getSwarmNetworkServicesMock.mockResolvedValue(mockServices);

      render(<NetworkConnectedServicesSection networkId="net-abc123" />);

      await waitFor(() => {
        expect(screen.getByText('Connected Services')).toBeInTheDocument();
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    it('navigates to service when clicked', async () => {
      getSwarmNetworkServicesMock.mockResolvedValue([
        { serviceId: 'svc-1', serviceName: 'web-service' },
      ]);

      render(<NetworkConnectedServicesSection networkId="net-abc123" />);

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
      getSwarmNetworkServicesMock.mockResolvedValue([
        { serviceId: 'svc-1', serviceName: 'web-service' },
      ]);

      render(<NetworkConnectedServicesSection networkId="net-abc123" />);

      await waitFor(() => {
        expect(screen.getByText('web-service')).toBeInTheDocument();
      });

      fireEvent.keyDown(screen.getByText('web-service'), { key: 'Enter' });

      expect(navigateToResource).toHaveBeenCalled();
    });
  });

  describe('API calls', () => {
    it('calls API with correct networkId', async () => {
      getSwarmNetworkServicesMock.mockResolvedValue([]);

      render(<NetworkConnectedServicesSection networkId="my-network-id" />);

      await waitFor(() => {
        expect(GetSwarmNetworkServices).toHaveBeenCalledWith('my-network-id');
      });
    });

    it('re-fetches when networkId changes', async () => {
      getSwarmNetworkServicesMock.mockResolvedValue([]);

      const { rerender } = render(<NetworkConnectedServicesSection networkId="net-1" />);

      await waitFor(() => {
        expect(GetSwarmNetworkServices).toHaveBeenCalledWith('net-1');
      });

      rerender(<NetworkConnectedServicesSection networkId="net-2" />);

      await waitFor(() => {
        expect(GetSwarmNetworkServices).toHaveBeenCalledWith('net-2');
      });
    });
  });
});
