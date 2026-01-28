import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ServiceEndpointsTab from '../k8s/resources/services/ServiceEndpointsTab';

// Mock the Wails App API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetServiceEndpoints: vi.fn(),
}));

// Import after mocking
import * as AppAPI from '../../wailsjs/go/main/App';

describe('ServiceEndpointsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading message while fetching data', () => {
      AppAPI.GetServiceEndpoints.mockImplementation(() => new Promise(() => {}));
      
      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);
      
      expect(screen.getByText(/Loading endpoints/)).toBeInTheDocument();
    });

    it('shows spinner during loading', () => {
      AppAPI.GetServiceEndpoints.mockImplementation(() => new Promise(() => {}));
      
      const { container } = render(
        <ServiceEndpointsTab namespace="default" serviceName="my-service" />
      );
      
      expect(container.querySelector('.spinner')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      AppAPI.GetServiceEndpoints.mockRejectedValue(new Error('Connection failed'));
      
      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);
      
      await waitFor(() => {
        expect(screen.getByText('Connection failed')).toBeInTheDocument();
      });
    });

    it('shows error icon', async () => {
      AppAPI.GetServiceEndpoints.mockRejectedValue(new Error('Error'));
      
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
      AppAPI.GetServiceEndpoints.mockResolvedValue([]);
      
      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);
      
      await waitFor(() => {
        expect(screen.getByText('No Endpoints')).toBeInTheDocument();
      });
    });

    it('shows helpful hint in empty state', async () => {
      AppAPI.GetServiceEndpoints.mockResolvedValue([]);
      
      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);
      
      await waitFor(() => {
        expect(screen.getByText(/no backing pods/i)).toBeInTheDocument();
      });
    });

    it('shows empty icon', async () => {
      AppAPI.GetServiceEndpoints.mockResolvedValue([]);
      
      const { container } = render(
        <ServiceEndpointsTab namespace="default" serviceName="my-service" />
      );
      
      await waitFor(() => {
        expect(container.querySelector('.empty-icon')).toBeInTheDocument();
      });
    });

    it('handles null response', async () => {
      AppAPI.GetServiceEndpoints.mockResolvedValue(null);
      
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
      AppAPI.GetServiceEndpoints.mockResolvedValue(mockEndpoints);
      
      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);
      
      await waitFor(() => {
        expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
        expect(screen.getByText('10.0.0.2')).toBeInTheDocument();
        expect(screen.getByText('10.0.0.3')).toBeInTheDocument();
      });
    });

    it('displays pod names', async () => {
      AppAPI.GetServiceEndpoints.mockResolvedValue(mockEndpoints);
      
      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);
      
      await waitFor(() => {
        expect(screen.getByText('pod-1')).toBeInTheDocument();
        expect(screen.getByText('pod-2')).toBeInTheDocument();
        expect(screen.getByText('pod-3')).toBeInTheDocument();
      });
    });

    it('displays node names', async () => {
      AppAPI.GetServiceEndpoints.mockResolvedValue(mockEndpoints);
      
      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);
      
      await waitFor(() => {
        expect(screen.getAllByText('node-1')).toHaveLength(2);
        expect(screen.getByText('node-2')).toBeInTheDocument();
      });
    });

    it('displays port and protocol', async () => {
      AppAPI.GetServiceEndpoints.mockResolvedValue(mockEndpoints);
      
      render(<ServiceEndpointsTab namespace="default" serviceName="my-service" />);
      
      await waitFor(() => {
        expect(screen.getAllByText('8080')).toHaveLength(3);
        expect(screen.getAllByText('TCP')).toHaveLength(3);
      });
    });
  });

  describe('API calls', () => {
    it('calls GetServiceEndpoints with correct parameters', async () => {
      AppAPI.GetServiceEndpoints.mockResolvedValue([]);
      
      render(<ServiceEndpointsTab namespace="prod" serviceName="api-gateway" />);
      
      await waitFor(() => {
        expect(AppAPI.GetServiceEndpoints).toHaveBeenCalledWith('prod', 'api-gateway');
      });
    });

    it('sets empty endpoints when namespace is missing', async () => {
      render(<ServiceEndpointsTab namespace="" serviceName="my-service" />);
      
      await waitFor(() => {
        expect(AppAPI.GetServiceEndpoints).not.toHaveBeenCalled();
      });
    });

    it('sets empty endpoints when serviceName is missing', async () => {
      render(<ServiceEndpointsTab namespace="default" serviceName="" />);
      
      await waitFor(() => {
        expect(AppAPI.GetServiceEndpoints).not.toHaveBeenCalled();
      });
    });

    it('re-fetches when serviceName changes', async () => {
      AppAPI.GetServiceEndpoints.mockResolvedValue([]);
      
      const { rerender } = render(
        <ServiceEndpointsTab namespace="default" serviceName="service1" />
      );
      
      await waitFor(() => {
        expect(AppAPI.GetServiceEndpoints).toHaveBeenCalledWith('default', 'service1');
      });
      
      rerender(<ServiceEndpointsTab namespace="default" serviceName="service2" />);
      
      await waitFor(() => {
        expect(AppAPI.GetServiceEndpoints).toHaveBeenCalledWith('default', 'service2');
      });
    });

    it('cancels pending request on unmount', async () => {
      let resolvePromise;
      AppAPI.GetServiceEndpoints.mockImplementation(() => 
        new Promise((resolve) => { resolvePromise = resolve; })
      );
      
      const { unmount } = render(
        <ServiceEndpointsTab namespace="default" serviceName="my-service" />
      );
      
      unmount();
      
      // Resolve after unmount - should not cause errors
      resolvePromise([{ ip: '10.0.0.1', port: 80, ready: true }]);
    });
  });
});
