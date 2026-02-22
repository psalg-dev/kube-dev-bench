import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetIngressTLSSummary: vi.fn(),
}));

import * as AppAPI from '../../wailsjs/go/main/App';
import IngressTLSTab from '../k8s/resources/ingresses/IngressTLSTab';

const getTLSSummaryMock = vi.mocked(AppAPI.GetIngressTLSSummary);

const mockTLSItems = [
  {
    secretName: 'tls-secret',
    hosts: ['example.com', 'www.example.com'],
    notAfter: '2025-12-31T00:00:00Z',
    daysRemaining: 120,
  },
  {
    secretName: 'other-tls',
    hosts: ['api.example.com'],
    notAfter: '2025-02-01T00:00:00Z',
    daysRemaining: 10,
  },
];

describe('IngressTLSTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getTLSSummaryMock.mockImplementation(() => new Promise(() => {}));
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows error when API fails', async () => {
    getTLSSummaryMock.mockRejectedValue(new Error('tls fetch error'));
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/tls fetch error/i)).toBeInTheDocument();
    });
  });

  it('shows no TLS message when empty', async () => {
    getTLSSummaryMock.mockResolvedValue([]);
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/No TLS configured/i)).toBeInTheDocument();
    });
  });

  it('renders TLS secret names', async () => {
    getTLSSummaryMock.mockResolvedValue(mockTLSItems);
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('tls-secret')).toBeInTheDocument();
      expect(screen.getByText('other-tls')).toBeInTheDocument();
    });
  });

  it('renders host names', async () => {
    getTLSSummaryMock.mockResolvedValue(mockTLSItems);
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/example\.com/)).toBeInTheDocument();
    });
  });

  it('renders table headers: Secret, Hosts, Expires, Days', async () => {
    getTLSSummaryMock.mockResolvedValue(mockTLSItems);
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('Secret')).toBeInTheDocument();
      expect(screen.getByText('Hosts')).toBeInTheDocument();
      expect(screen.getByText('Expires')).toBeInTheDocument();
      expect(screen.getByText('Days')).toBeInTheDocument();
    });
  });

  it('renders days remaining values', async () => {
    getTLSSummaryMock.mockResolvedValue(mockTLSItems);
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('120')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('calls GetIngressTLSSummary with correct params', async () => {
    getTLSSummaryMock.mockResolvedValue([]);
    render(<IngressTLSTab namespace="test-ns" ingressName="test-ingress" />);
    await waitFor(() => {
      expect(AppAPI.GetIngressTLSSummary).toHaveBeenCalledWith('test-ns', 'test-ingress');
    });
  });
});
