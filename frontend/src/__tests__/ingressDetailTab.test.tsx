import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import IngressDetailTab from '../k8s/resources/ingresses/IngressDetailTab';
import type { app } from '../../wailsjs/go/models';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetIngressDetail: vi.fn(),
}));

import { GetIngressDetail } from '../../wailsjs/go/main/App';
const getIngressDetailMock = vi.mocked(GetIngressDetail);

const toDetail = (data: unknown) => data as app.IngressDetail;

describe('IngressDetailTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    getIngressDetailMock.mockImplementation(() => new Promise(() => {}));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error when API call fails', async () => {
    getIngressDetailMock.mockRejectedValue(new Error('Ingress error'));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/Error: Ingress error/)).toBeInTheDocument();
    });
  });

  it('renders Routing Rules header', async () => {
    getIngressDetailMock.mockResolvedValue(toDetail({ rules: [], tls: [] }));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('Routing Rules')).toBeInTheDocument();
    });
  });

  it('renders TLS Configuration header', async () => {
    getIngressDetailMock.mockResolvedValue(toDetail({ rules: [], tls: [] }));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('TLS Configuration')).toBeInTheDocument();
    });
  });

  it('shows no routing rules message when rules empty', async () => {
    getIngressDetailMock.mockResolvedValue(toDetail({ rules: [], tls: [] }));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/No routing rules defined/)).toBeInTheDocument();
    });
  });

  it('shows no TLS warning when tls empty', async () => {
    getIngressDetailMock.mockResolvedValue(toDetail({ rules: [], tls: [] }));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/No TLS configured/)).toBeInTheDocument();
    });
  });

  it('renders routing rules table with host', async () => {
    getIngressDetailMock.mockResolvedValue(toDetail({
      rules: [{ host: 'example.com', path: '/api', pathType: 'Prefix', serviceName: 'api-svc', servicePort: 80 }],
      tls: [],
    }));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeInTheDocument();
      expect(screen.getByText('api-svc')).toBeInTheDocument();
    });
  });

  it('renders TLS entries with secret name', async () => {
    getIngressDetailMock.mockResolvedValue(toDetail({
      rules: [],
      tls: [{ hosts: ['secure.example.com'], secretName: 'tls-secret' }],
    }));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('tls-secret')).toBeInTheDocument();
    });
  });

  it('does not call API when namespace is missing', () => {
    render(<IngressDetailTab ingressName="my-ingress" />);
    expect(getIngressDetailMock).not.toHaveBeenCalled();
  });

  it('calls API with correct arguments', async () => {
    getIngressDetailMock.mockResolvedValue(toDetail({ rules: [], tls: [] }));
    render(<IngressDetailTab namespace="test-ns" ingressName="test-ingress" />);
    await waitFor(() => {
      expect(getIngressDetailMock).toHaveBeenCalledWith('test-ns', 'test-ingress');
    });
  });
});
