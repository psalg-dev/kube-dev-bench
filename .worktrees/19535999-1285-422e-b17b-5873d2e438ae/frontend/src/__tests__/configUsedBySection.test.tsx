import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConfigUsedBySection from '../docker/resources/configs/ConfigUsedBySection';
import type { docker } from '../../wailsjs/go/models';

// Mock swarmApi
vi.mock('../docker/swarmApi', () => ({
  GetSwarmConfigUsage: vi.fn(),
}));

// Mock navigation
vi.mock('../utils/resourceNavigation', () => ({
  navigateToResource: vi.fn(),
}));

import { GetSwarmConfigUsage } from '../docker/swarmApi';
import { navigateToResource } from '../utils/resourceNavigation';

const getSwarmConfigUsageMock = vi.mocked(GetSwarmConfigUsage);
const toServiceRefs = (data: unknown) => data as docker.SwarmServiceRef[];

describe('ConfigUsedBySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      getSwarmConfigUsageMock.mockImplementation(() => new Promise(() => {}));

      render(<ConfigUsedBySection configId="config-abc123" />);

      expect(screen.getByText(/Loading/)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      getSwarmConfigUsageMock.mockRejectedValue(new Error('Config not found'));

      render(<ConfigUsedBySection configId="config-abc123" />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load usage/)).toBeInTheDocument();
        expect(screen.getByText(/Config not found/)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows empty state when no services use the config', async () => {
      getSwarmConfigUsageMock.mockResolvedValue(toServiceRefs([]));

      render(<ConfigUsedBySection configId="config-abc123" />);

      await waitFor(() => {
        // Should show the "Used By" header
        expect(screen.getByText('Used By')).toBeInTheDocument();
        // Should show empty content
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    const mockServices = [
      { serviceId: 'svc-1', serviceName: 'web-service' },
      { serviceId: 'svc-2', serviceName: 'api-service' },
    ];

    it('displays list of services using the config', async () => {
      getSwarmConfigUsageMock.mockResolvedValue(toServiceRefs(mockServices));

      render(<ConfigUsedBySection configId="config-abc123" />);

      await waitFor(() => {
        expect(screen.getByText('web-service')).toBeInTheDocument();
        expect(screen.getByText('api-service')).toBeInTheDocument();
      });
    });

    it('displays Used By header', async () => {
      getSwarmConfigUsageMock.mockResolvedValue(toServiceRefs(mockServices));

      render(<ConfigUsedBySection configId="config-abc123" />);

      await waitFor(() => {
        expect(screen.getByText('Used By')).toBeInTheDocument();
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    it('navigates to service when clicked', async () => {
      getSwarmConfigUsageMock.mockResolvedValue(toServiceRefs([
        { serviceId: 'svc-1', serviceName: 'web-service' },
      ]));

      render(<ConfigUsedBySection configId="config-abc123" />);

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
      getSwarmConfigUsageMock.mockResolvedValue(toServiceRefs([
        { serviceId: 'svc-1', serviceName: 'web-service' },
      ]));

      render(<ConfigUsedBySection configId="config-abc123" />);

      await waitFor(() => {
        expect(screen.getByText('web-service')).toBeInTheDocument();
      });

      fireEvent.keyDown(screen.getByText('web-service'), { key: 'Enter' });

      expect(navigateToResource).toHaveBeenCalled();
    });
  });

  describe('API calls', () => {
    it('calls API with correct configId', async () => {
      getSwarmConfigUsageMock.mockResolvedValue(toServiceRefs([]));

      render(<ConfigUsedBySection configId="my-config-id" />);

      await waitFor(() => {
        expect(GetSwarmConfigUsage).toHaveBeenCalledWith('my-config-id');
      });
    });

    it('re-fetches when configId changes', async () => {
      getSwarmConfigUsageMock.mockResolvedValue(toServiceRefs([]));

      const { rerender } = render(<ConfigUsedBySection configId="config-1" />);

      await waitFor(() => {
        expect(GetSwarmConfigUsage).toHaveBeenCalledWith('config-1');
      });

      rerender(<ConfigUsedBySection configId="config-2" />);

      await waitFor(() => {
        expect(GetSwarmConfigUsage).toHaveBeenCalledWith('config-2');
      });
    });
  });
});

