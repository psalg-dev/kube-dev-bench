import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import IngressBackendServicesTab from '../k8s/resources/ingresses/IngressBackendServicesTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetIngressDetail: vi.fn(),
  GetServiceSummary: vi.fn().mockResolvedValue({}),
}));

import * as AppAPI from '../../wailsjs/go/main/App';
const getDetailMock = vi.mocked(AppAPI.GetIngressDetail);

describe('IngressBackendServicesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AppAPI.GetServiceSummary).mockResolvedValue({} as never);
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
      expect(screen.getByText(/Error: network error/i)).toBeInTheDocument();
    });
  });

  it('shows no backend services message when rules are empty', async () => {
    getDetailMock.mockResolvedValue({ rules: [] } as never);
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/No backend services found/i)).toBeInTheDocument();
    });
  });

  it('renders table column headers when services exist', async () => {
    getDetailMock.mockResolvedValue({
      rules: [{ serviceName: 'my-svc', servicePort: 80 }],
    } as never);
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('Port')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('ClusterIP')).toBeInTheDocument();
    });
  });

  it('renders service rows from ingress rules', async () => {
    getDetailMock.mockResolvedValue({
      rules: [{ serviceName: 'backend-svc', servicePort: 8080 }],
    } as never);
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('backend-svc')).toBeInTheDocument();
      expect(screen.getByText('8080')).toBeInTheDocument();
    });
  });

  it('shows footnote about best-effort service details', async () => {
    getDetailMock.mockResolvedValue({
      rules: [{ serviceName: 'svc1', servicePort: 443 }],
    } as never);
    render(<IngressBackendServicesTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/Services referenced by Ingress rules/i)).toBeInTheDocument();
    });
  });
});
