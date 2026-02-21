import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import IngressBackendServicesTab from '../k8s/resources/ingresses/IngressBackendServicesTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetIngressDetail: vi.fn(),
  GetServiceSummary: vi.fn(),
}));

vi.mock('../utils/tableSorting', async () => {
  const actual = await vi.importActual('../utils/tableSorting');
  return actual;
});

import * as AppAPI from '../../wailsjs/go/main/App';
const getIngressDetailMock = vi.mocked(AppAPI.GetIngressDetail);
const getServiceSummaryMock = vi.mocked(AppAPI.GetServiceSummary);

describe('IngressBackendServicesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServiceSummaryMock.mockResolvedValue(undefined as never);
  });

  it('shows loading state initially', () => {
    getIngressDetailMock.mockImplementation(() => new Promise(() => {}));
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error when API call fails', async () => {
    getIngressDetailMock.mockRejectedValue(new Error('Ingress not found'));
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/Error: Ingress not found/)).toBeInTheDocument();
    });
  });

  it('shows no backend services when rules are empty', async () => {
    getIngressDetailMock.mockResolvedValue({ rules: [] } as never);
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/No backend services found/)).toBeInTheDocument();
    });
  });

  it('renders service table columns when services exist', async () => {
    getIngressDetailMock.mockResolvedValue({
      rules: [{ serviceName: 'my-svc', servicePort: 80 }],
    } as never);
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('Port')).toBeInTheDocument();
    });
  });

  it('renders service name in table', async () => {
    getIngressDetailMock.mockResolvedValue({
      rules: [{ serviceName: 'backend-service', servicePort: 8080 }],
    } as never);
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('backend-service')).toBeInTheDocument();
    });
  });

  it('shows footer disclaimer text', async () => {
    getIngressDetailMock.mockResolvedValue({
      rules: [{ serviceName: 'my-svc', servicePort: 80 }],
    } as never);
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/Services referenced by Ingress rules/)).toBeInTheDocument();
    });
  });

  it('does not call API when namespace is missing', () => {
    render(<IngressBackendServicesTab ingressName="my-ingress" />);
    expect(getIngressDetailMock).not.toHaveBeenCalled();
  });

  it('calls API with correct arguments', async () => {
    getIngressDetailMock.mockResolvedValue({ rules: [] } as never);
    render(<IngressBackendServicesTab namespace="test-ns" ingressName="test-ingress" />);
    await waitFor(() => {
      expect(getIngressDetailMock).toHaveBeenCalledWith('test-ns', 'test-ingress');
    });
  });
});
