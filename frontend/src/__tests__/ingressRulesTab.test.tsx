import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockGetIngressDetail = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  GetIngressDetail: (...args: unknown[]) => mockGetIngressDetail(...args),
}));

import IngressRulesTab from '../k8s/resources/ingresses/IngressRulesTab';

describe('IngressRulesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockGetIngressDetail.mockReturnValue(new Promise(() => {}));

    render(
      <IngressRulesTab
        namespace="default"
        ingressName="test-ingress"
        hosts={[]}
      />
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders rules from API response', async () => {
    const mockDetail = {
      rules: [
        {
          host: 'api.example.com',
          paths: [
            { path: '/v1', pathType: 'Prefix', backend: { serviceName: 'api-v1', servicePort: 8080 } },
            { path: '/v2', pathType: 'Prefix', backend: { serviceName: 'api-v2', servicePort: 8080 } },
          ],
        },
      ],
    };

    mockGetIngressDetail.mockResolvedValue(mockDetail);

    render(
      <IngressRulesTab
        namespace="default"
        ingressName="api-ingress"
        hosts={['api.example.com']}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/api\.example\.com/)).toBeInTheDocument();
    });

    expect(screen.getByText('/v1')).toBeInTheDocument();
    expect(screen.getByText('/v2')).toBeInTheDocument();
    expect(screen.getByText('api-v1')).toBeInTheDocument();
    expect(screen.getByText('api-v2')).toBeInTheDocument();
  });

  it('shows error state when API call fails', async () => {
    mockGetIngressDetail.mockRejectedValue(new Error('Network error'));

    render(
      <IngressRulesTab
        namespace="default"
        ingressName="basic-ingress"
        hosts={['app.example.com', 'www.example.com']}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('renders empty state when no rules', async () => {
    mockGetIngressDetail.mockResolvedValue({ rules: [] });

    render(
      <IngressRulesTab
        namespace="default"
        ingressName="empty-ingress"
        hosts={[]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/no rules/i)).toBeInTheDocument();
    });
  });

  it('displays path type badges', async () => {
    const mockDetail = {
      rules: [
        {
          host: 'test.com',
          paths: [
            { path: '/exact', pathType: 'Exact', backend: { serviceName: 'exact-svc', servicePort: 80 } },
            { path: '/prefix', pathType: 'Prefix', backend: { serviceName: 'prefix-svc', servicePort: 80 } },
          ],
        },
      ],
    };

    mockGetIngressDetail.mockResolvedValue(mockDetail);

    render(
      <IngressRulesTab
        namespace="default"
        ingressName="mixed-ingress"
        hosts={['test.com']}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Exact')).toBeInTheDocument();
    });

    expect(screen.getByText('Prefix')).toBeInTheDocument();
  });

  it('displays TLS configuration when present', async () => {
    const mockDetail = {
      rules: [
        {
          host: 'secure.example.com',
          paths: [
            { path: '/', pathType: 'Prefix', backend: { serviceName: 'secure-svc', servicePort: 443 } },
          ],
        },
      ],
      tls: [
        {
          hosts: ['secure.example.com'],
          secretName: 'tls-secret',
        },
      ],
    };

    mockGetIngressDetail.mockResolvedValue(mockDetail);

    render(
      <IngressRulesTab
        namespace="default"
        ingressName="tls-ingress"
        hosts={['secure.example.com']}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/tls configuration/i)).toBeInTheDocument();
    });

    expect(screen.getByText('tls-secret')).toBeInTheDocument();
  });

  it('calls API with correct parameters', async () => {
    mockGetIngressDetail.mockResolvedValue({ rules: [] });

    render(
      <IngressRulesTab
        namespace="my-namespace"
        ingressName="my-ingress"
        hosts={[]}
      />
    );

    await waitFor(() => {
      expect(mockGetIngressDetail).toHaveBeenCalledWith('my-namespace', 'my-ingress');
    });
  });

  it('shows rule count in header', async () => {
    const mockDetail = {
      rules: [
        { host: 'a.com', paths: [{ path: '/', pathType: 'Prefix', backend: { serviceName: 'a', servicePort: 80 } }] },
        { host: 'b.com', paths: [{ path: '/', pathType: 'Prefix', backend: { serviceName: 'b', servicePort: 80 } }] },
        { host: 'c.com', paths: [{ path: '/', pathType: 'Prefix', backend: { serviceName: 'c', servicePort: 80 } }] },
      ],
    };

    mockGetIngressDetail.mockResolvedValue(mockDetail);

    render(
      <IngressRulesTab
        namespace="default"
        ingressName="multi-host-ingress"
        hosts={['a.com', 'b.com', 'c.com']}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/3 rule/i)).toBeInTheDocument();
    });
  });

  it('handles multiple paths per host', async () => {
    const mockDetail = {
      rules: [
        {
          host: 'api.test.com',
          paths: [
            { path: '/users', pathType: 'Prefix', backend: { serviceName: 'users-svc', servicePort: 8080 } },
            { path: '/orders', pathType: 'Prefix', backend: { serviceName: 'orders-svc', servicePort: 8081 } },
            { path: '/products', pathType: 'Prefix', backend: { serviceName: 'products-svc', servicePort: 8082 } },
          ],
        },
      ],
    };

    mockGetIngressDetail.mockResolvedValue(mockDetail);

    render(
      <IngressRulesTab
        namespace="default"
        ingressName="multi-path-ingress"
        hosts={['api.test.com']}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('/users')).toBeInTheDocument();
    });

    expect(screen.getByText('/orders')).toBeInTheDocument();
    expect(screen.getByText('/products')).toBeInTheDocument();
    expect(screen.getByText('users-svc')).toBeInTheDocument();
    expect(screen.getByText('orders-svc')).toBeInTheDocument();
    expect(screen.getByText('products-svc')).toBeInTheDocument();
  });
});
