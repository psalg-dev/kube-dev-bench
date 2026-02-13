import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ServiceEndpointsTab from '../k8s/resources/services/ServiceEndpointsTab';

const mockGetServiceEndpoints = vi.fn();

// Mock the Wails App API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetServiceEndpoints: (...args: unknown[]) => mockGetServiceEndpoints(...args),
}));

describe('ServiceEndpointsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading message while fetching data', () => {
      mockGetServiceEndpoints.mockImplementation(() => new Promise(() => {}));

      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);

      expect(screen.getByText(/Loading endpoints/)).toBeInTheDocument();
    });

    it('shows spinner during loading', () => {
      mockGetServiceEndpoints.mockImplementation(() => new Promise(() => {}));

      const { container } = render(
        <ServiceEndpointsTab namespace="default" serviceName="my-service" />
      );

      expect(container.querySelector('.spinner')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      mockGetServiceEndpoints.mockRejectedValue(new Error('Connection failed'));

      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);

      await waitFor(() => {
        expect(screen.getByText('Connection failed')).toBeInTheDocument();
      });
    });

    it('shows error icon', async () => {
      mockGetServiceEndpoints.mockRejectedValue(new Error('Error'));

      const { container } = render(
        <ServiceEndpointsTab namespace="default" serviceName="my-service" />
      );

      await waitFor(() => {
        expect(container.querySelector('.error-icon')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('displays message when no endpoints exist', async () => {
      mockGetServiceEndpoints.mockResolvedValue([]);

      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);

      await waitFor(() => {
        expect(screen.getByText('No Endpoints')).toBeInTheDocument();
      });
    });

    it('shows helpful hint in empty state', async () => {
      mockGetServiceEndpoints.mockResolvedValue([]);

      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);

      await waitFor(() => {
        expect(screen.getByText(/no backing pods/i)).toBeInTheDocument();
      });
    });

    it('shows empty icon', async () => {
      mockGetServiceEndpoints.mockResolvedValue([]);

      const { container } = render(
        <ServiceEndpointsTab namespace="default" serviceName="my-service" />
      );

      await waitFor(() => {
        expect(container.querySelector('.empty-icon')).toBeInTheDocument();
      });
    });

    it('handles null response', async () => {
      mockGetServiceEndpoints.mockResolvedValue(null);

      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);

      await waitFor(() => {
        expect(screen.getByText('No Endpoints')).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    const mockEndpoints = [
      { ip: '10.0.0.1', port: 8080, protocol: 'TCP', podName: 'pod-1', nodeName: 'node-1', ready: true },
      { ip: '10.0.0.2', port: 8080, protocol: 'TCP', podName: 'pod-2', nodeName: 'node-2', ready: true },
      { ip: '10.0.0.3', port: 8080, protocol: 'TCP', podName: 'pod-3', nodeName: 'node-1', ready: false },
    ];

    it('displays endpoints in a table', async () => {
      mockGetServiceEndpoints.mockResolvedValue(mockEndpoints);

      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);

      await waitFor(() => {
        expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
        expect(screen.getByText('10.0.0.2')).toBeInTheDocument();
        expect(screen.getByText('10.0.0.3')).toBeInTheDocument();
      });
    });

    it('displays pod names', async () => {
      mockGetServiceEndpoints.mockResolvedValue(mockEndpoints);

      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);

      await waitFor(() => {
        expect(screen.getByText('pod-1')).toBeInTheDocument();
        expect(screen.getByText('pod-2')).toBeInTheDocument();
        expect(screen.getByText('pod-3')).toBeInTheDocument();
      });
    });

    it('displays node names', async () => {
      mockGetServiceEndpoints.mockResolvedValue(mockEndpoints);

      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);

      await waitFor(() => {
        expect(screen.getAllByText('node-1')).toHaveLength(2);
        expect(screen.getByText('node-2')).toBeInTheDocument();
      });
    });

    it('displays port and protocol', async () => {
      mockGetServiceEndpoints.mockResolvedValue(mockEndpoints);

      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);

      await waitFor(() => {
        expect(screen.getAllByText('8080')).toHaveLength(3);
        expect(screen.getAllByText('TCP')).toHaveLength(3);
      });
    });
  });

  describe('API calls', () => {
    it('calls GetServiceEndpoints with correct parameters', async () => {
      mockGetServiceEndpoints.mockResolvedValue([]);

      render(<ServiceEndpointsTab namespace="prod" serviceName="api-gateway" />);

      await waitFor(() => {
        expect(mockGetServiceEndpoints).toHaveBeenCalledWith('prod', 'api-gateway');
      });
    });

    it('sets empty endpoints when namespace is missing', async () => {
      render(<ServiceEndpointsTab namespace="" serviceName="my-service" />);

      await waitFor(() => {
        expect(mockGetServiceEndpoints).not.toHaveBeenCalled();
      });
    });

    it('sets empty endpoints when serviceName is missing', async () => {
      render(<ServiceEndpointsTab namespace="default" serviceName="" />);

      await waitFor(() => {
        expect(mockGetServiceEndpoints).not.toHaveBeenCalled();
      });
    });

    it('re-fetches when serviceName changes', async () => {
      mockGetServiceEndpoints.mockResolvedValue([]);

      const { rerender } = render(
        <ServiceEndpointsTab namespace="default" serviceName="service1" />
      );

      await waitFor(() => {
        expect(mockGetServiceEndpoints).toHaveBeenCalledWith('default', 'service1');
      });

      rerender(<ServiceEndpointsTab namespace="default" serviceName="service2" />);

      await waitFor(() => {
        expect(mockGetServiceEndpoints).toHaveBeenCalledWith('default', 'service2');
      });
    });

    it('cancels pending request on unmount', async () => {
      let resolvePromise: ((_value: unknown) => void) | undefined;
      mockGetServiceEndpoints.mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );

      const { unmount } = render(
        <ServiceEndpointsTab namespace="default" serviceName="my-service" />
      );

      unmount();

      // Resolve after unmount - should not cause errors
      if (resolvePromise) {
        resolvePromise([{ ip: '10.0.0.1', port: 80, ready: true }]);
      }
    });
  });
});
