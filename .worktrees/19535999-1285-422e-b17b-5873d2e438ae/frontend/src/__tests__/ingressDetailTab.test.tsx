import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import IngressDetailTab from '../k8s/resources/ingresses/IngressDetailTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetIngressDetail: vi.fn(),
}));

import { GetIngressDetail } from '../../wailsjs/go/main/App';
const getDetailMock = vi.mocked(GetIngressDetail);

describe('IngressDetailTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getDetailMock.mockImplementation(() => new Promise(() => {}));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows error when API fails', async () => {
    getDetailMock.mockRejectedValue(new Error('ingress error'));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/Error: ingress error/i)).toBeInTheDocument();
    });
  });

  it('renders Routing Rules heading', async () => {
    getDetailMock.mockResolvedValue({ rules: [], tls: [] } as never);
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('Routing Rules')).toBeInTheDocument();
    });
  });

  it('shows no routing rules message when rules are empty', async () => {
    getDetailMock.mockResolvedValue({ rules: [], tls: [] } as never);
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/No routing rules defined/i)).toBeInTheDocument();
    });
  });

  it('renders rules table column headers when rules exist', async () => {
    getDetailMock.mockResolvedValue({
      rules: [{ host: 'example.com', path: '/api', pathType: 'Prefix', serviceName: 'backend', servicePort: 8080 }],
      tls: [],
    } as never);
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('Host')).toBeInTheDocument();
      expect(screen.getByText('Path')).toBeInTheDocument();
      expect(screen.getByText('Service')).toBeInTheDocument();
    });
  });

  it('renders rule rows', async () => {
    getDetailMock.mockResolvedValue({
      rules: [{ host: 'app.example.com', path: '/api', pathType: 'Prefix', serviceName: 'api-service', servicePort: 3000 }],
      tls: [],
    } as never);
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('app.example.com')).toBeInTheDocument();
      expect(screen.getByText('api-service')).toBeInTheDocument();
    });
  });

  it('shows no TLS warning when tls is empty', async () => {
    getDetailMock.mockResolvedValue({ rules: [], tls: [] } as never);
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/No TLS configured/i)).toBeInTheDocument();
    });
  });

  it('renders TLS table when tls entries exist', async () => {
    getDetailMock.mockResolvedValue({
      rules: [],
      tls: [{ hosts: ['secure.example.com'], secretName: 'tls-secret' }],
    } as never);
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('tls-secret')).toBeInTheDocument();
    });
  });

  it('does not call API when props are missing', () => {
    render(<IngressDetailTab namespace="" ingressName="" />);
    expect(getDetailMock).not.toHaveBeenCalled();
  });
});
