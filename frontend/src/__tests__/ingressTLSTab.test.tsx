import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import IngressTLSTab from '../k8s/resources/ingresses/IngressTLSTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetIngressTLSSummary: vi.fn(),
}));

import { GetIngressTLSSummary } from '../../wailsjs/go/main/App';
const getTLSSummaryMock = vi.mocked(GetIngressTLSSummary);

describe('IngressTLSTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getTLSSummaryMock.mockImplementation(() => new Promise(() => {}));
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error when API call fails', async () => {
    getTLSSummaryMock.mockRejectedValue(new Error('TLS fetch error'));
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/Error: TLS fetch error/)).toBeInTheDocument();
    });
  });

  it('shows no TLS configured when result is empty', async () => {
    getTLSSummaryMock.mockResolvedValue([] as never);
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/No TLS configured/)).toBeInTheDocument();
    });
  });

  it('renders table columns when TLS entries exist', async () => {
    getTLSSummaryMock.mockResolvedValue([
      { secretName: 'my-cert', hosts: ['example.com'], notAfter: '2025-12-31', daysRemaining: 300 },
    ] as never);
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('Secret')).toBeInTheDocument();
      expect(screen.getByText('Hosts')).toBeInTheDocument();
      expect(screen.getByText('Expires')).toBeInTheDocument();
      expect(screen.getByText('Days')).toBeInTheDocument();
    });
  });

  it('renders TLS secret name in table', async () => {
    getTLSSummaryMock.mockResolvedValue([
      { secretName: 'tls-secret-prod', hosts: ['prod.example.com'], notAfter: '2025-12-31', daysRemaining: 300 },
    ] as never);
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('tls-secret-prod')).toBeInTheDocument();
    });
  });

  it('renders TLS hosts', async () => {
    getTLSSummaryMock.mockResolvedValue([
      { secretName: 'my-cert', hosts: ['api.example.com'], notAfter: '2025-12-31', daysRemaining: 100 },
    ] as never);
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('api.example.com')).toBeInTheDocument();
    });
  });

  it('does not call API when namespace is missing', () => {
    render(<IngressTLSTab ingressName="my-ingress" />);
    expect(getTLSSummaryMock).not.toHaveBeenCalled();
  });

  it('calls API with correct arguments', async () => {
    getTLSSummaryMock.mockResolvedValue([] as never);
    render(<IngressTLSTab namespace="test-ns" ingressName="test-ingress" />);
    await waitFor(() => {
      expect(getTLSSummaryMock).toHaveBeenCalledWith('test-ns', 'test-ingress');
    });
  });

  it('shows days remaining for cert', async () => {
    getTLSSummaryMock.mockResolvedValue([
      { secretName: 'my-cert', hosts: ['example.com'], notAfter: '2025-12-31', daysRemaining: 42 },
    ] as never);
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });
});
