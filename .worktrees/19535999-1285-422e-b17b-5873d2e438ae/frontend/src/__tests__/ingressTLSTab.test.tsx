import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import IngressTLSTab from '../k8s/resources/ingresses/IngressTLSTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetIngressTLSSummary: vi.fn(),
}));

import { GetIngressTLSSummary } from '../../wailsjs/go/main/App';
const getTLSMock = vi.mocked(GetIngressTLSSummary);

describe('IngressTLSTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getTLSMock.mockImplementation(() => new Promise(() => {}));
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows error when API fails', async () => {
    getTLSMock.mockRejectedValue(new Error('tls error'));
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/Error: tls error/i)).toBeInTheDocument();
    });
  });

  it('shows no TLS configured when list is empty', async () => {
    getTLSMock.mockResolvedValue([] as never);
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/No TLS configured/i)).toBeInTheDocument();
    });
  });

  it('renders column headers when TLS entries exist', async () => {
    getTLSMock.mockResolvedValue([
      { secretName: 'tls-secret', hosts: ['example.com'], notAfter: '2025-12-31T00:00:00Z', daysRemaining: 200 },
    ] as never);
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('Secret')).toBeInTheDocument();
      expect(screen.getByText('Hosts')).toBeInTheDocument();
      expect(screen.getByText('Expires')).toBeInTheDocument();
      expect(screen.getByText('Days')).toBeInTheDocument();
    });
  });

  it('renders TLS rows with secret name and hosts', async () => {
    getTLSMock.mockResolvedValue([
      { secretName: 'my-tls-cert', hosts: ['app.example.com'], notAfter: '2025-06-01T00:00:00Z', daysRemaining: 100 },
    ] as never);
    render(<IngressTLSTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('my-tls-cert')).toBeInTheDocument();
      expect(screen.getByText('app.example.com')).toBeInTheDocument();
    });
  });

  it('does not call API when props are missing', () => {
    render(<IngressTLSTab namespace="" ingressName="" />);
    expect(getTLSMock).not.toHaveBeenCalled();
  });
});
