import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetIngressDetail: vi.fn(),
}));

import * as AppAPI from '../../wailsjs/go/main/App';
import IngressDetailTab from '../k8s/resources/ingresses/IngressDetailTab';
import type { app } from '../../wailsjs/go/models';

const getDetailMock = vi.mocked(AppAPI.GetIngressDetail);
const toDetail = (d: unknown) => d as app.IngressDetail;

const mockDetail = {
  rules: [
    { host: 'example.com', path: '/', pathType: 'Prefix', serviceName: 'web-svc', servicePort: 80 },
    { host: 'api.example.com', path: '/v1', pathType: 'Exact', serviceName: 'api-svc', servicePort: 8080 },
  ],
  tls: [
    { hosts: ['example.com'], secretName: 'tls-secret' },
  ],
};

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
    getDetailMock.mockRejectedValue(new Error('detail fetch failed'));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/detail fetch failed/i)).toBeInTheDocument();
    });
  });

  it('renders Routing Rules section header', async () => {
    getDetailMock.mockResolvedValue(toDetail(mockDetail));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/Routing Rules/i)).toBeInTheDocument();
    });
  });

  it('renders TLS Configuration section header', async () => {
    getDetailMock.mockResolvedValue(toDetail(mockDetail));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/TLS Configuration/i)).toBeInTheDocument();
    });
  });

  it('renders routing rule host names', async () => {
    getDetailMock.mockResolvedValue(toDetail(mockDetail));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeInTheDocument();
      expect(screen.getByText('api.example.com')).toBeInTheDocument();
    });
  });

  it('renders service names from rules', async () => {
    getDetailMock.mockResolvedValue(toDetail(mockDetail));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('web-svc')).toBeInTheDocument();
      expect(screen.getByText('api-svc')).toBeInTheDocument();
    });
  });

  it('renders TLS secret name', async () => {
    getDetailMock.mockResolvedValue(toDetail(mockDetail));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText('tls-secret')).toBeInTheDocument();
    });
  });

  it('shows "No routing rules" when rules array is empty', async () => {
    getDetailMock.mockResolvedValue(toDetail({ rules: [], tls: [] }));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/No routing rules defined/i)).toBeInTheDocument();
    });
  });

  it('shows no TLS warning when tls is empty', async () => {
    getDetailMock.mockResolvedValue(toDetail({ rules: [], tls: [] }));
    render(<IngressDetailTab namespace="default" ingressName="my-ingress" />);
    await waitFor(() => {
      expect(screen.getByText(/No TLS configured/i)).toBeInTheDocument();
    });
  });

  it('calls GetIngressDetail with correct params', async () => {
    getDetailMock.mockResolvedValue(toDetail({ rules: [], tls: [] }));
    render(<IngressDetailTab namespace="test-ns" ingressName="test-ingress" />);
    await waitFor(() => {
      expect(AppAPI.GetIngressDetail).toHaveBeenCalledWith('test-ns', 'test-ingress');
    });
  });
});
