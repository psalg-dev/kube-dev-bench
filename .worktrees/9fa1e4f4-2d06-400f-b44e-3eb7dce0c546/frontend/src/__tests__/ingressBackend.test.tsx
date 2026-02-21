import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetIngressDetail: vi.fn(),
  GetServiceSummary: vi.fn(() => Promise.resolve({})),
}));

import * as AppAPI from '../../wailsjs/go/main/App';
import IngressBackendServicesTab from '../k8s/resources/ingresses/IngressBackendServicesTab';

const getDetailMock = vi.mocked(AppAPI.GetIngressDetail);

const mockDetail = {
  rules: [
    { serviceName: 'backend-svc', servicePort: 80 },
    { serviceName: 'api-svc', servicePort: 8080 },
  ],
};

describe('IngressBackendServicesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getDetailMock.mockImplementation(() => new Promise(() => {}));
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows error when API fails', async () => {
    getDetailMock.mockRejectedValue(new Error('network error'));
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('shows no services message when rules are empty', async () => {
    getDetailMock.mockResolvedValue({ rules: [] });
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/No backend services found/i)).toBeInTheDocument();
    });
  });

  it('renders backend service names from rules', async () => {
    getDetailMock.mockResolvedValue(mockDetail);
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('backend-svc')).toBeInTheDocument();
      expect(screen.getByText('api-svc')).toBeInTheDocument();
    });
  });

  it('renders table headers: Service, Port, Type, ClusterIP', async () => {
    getDetailMock.mockResolvedValue(mockDetail);
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('Port')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('ClusterIP')).toBeInTheDocument();
    });
  });

  it('shows footer note about services', async () => {
    getDetailMock.mockResolvedValue(mockDetail);
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/Services referenced by Ingress rules/i)).toBeInTheDocument();
    });
  });

  it('calls GetIngressDetail with correct params', async () => {
    getDetailMock.mockResolvedValue({ rules: [] });
    render(<IngressBackendServicesTab namespace="test-ns" ingressName="test-ingress" />);
    await waitFor(() => {
      expect(AppAPI.GetIngressDetail).toHaveBeenCalledWith('test-ns', 'test-ingress');
    });
  });

  it('renders port values', async () => {
    getDetailMock.mockResolvedValue(mockDetail);
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('80')).toBeInTheDocument();
      expect(screen.getByText('8080')).toBeInTheDocument();
    });
  });
});
