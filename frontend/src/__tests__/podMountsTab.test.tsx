import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PodMountsTab from '../k8s/resources/pods/PodMountsTab';
describe('PodMountsTab', () => {
  let mockGetPodMounts: ReturnType<typeof vi.fn>;
  let mockGetSecretData: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetPodMounts = vi.fn();
    mockGetSecretData = vi.fn();

    (window as unknown as { go: unknown }).go = {
      main: {
        App: {
          GetPodMounts: mockGetPodMounts,
          GetSecretData: mockGetSecretData,
        },
      },
    } as unknown;
  });

  afterEach(() => {
    delete (window as unknown as { go?: unknown }).go;
  });

  describe('loading state', () => {
    it('shows loading state while fetching', () => {
      mockGetPodMounts.mockImplementation(() => new Promise(() => {}));

      render(<PodMountsTab podName="my-pod" />);

      expect(screen.getByText(/Loading/)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      mockGetPodMounts.mockRejectedValue(new Error('Connection failed'));

      render(<PodMountsTab podName="my-pod" />);

      await waitFor(() => {
        expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
      });
    });

    it('shows error when API is not available', async () => {
      delete (window as unknown as { go?: unknown }).go;

      render(<PodMountsTab podName="my-pod" />);

      await waitFor(() => {
        expect(screen.getByText(/API not available/)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('handles empty volumes array', async () => {
      mockGetPodMounts.mockResolvedValue({ volumes: [], containers: [] });

      render(<PodMountsTab podName="my-pod" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });
    });

    it('handles null response', async () => {
      mockGetPodMounts.mockResolvedValue(null);

      render(<PodMountsTab podName="my-pod" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    it('displays volume mounts', async () => {
      const mockData = {
        volumes: [
          { name: 'config-volume', type: 'ConfigMap', configMapName: 'my-config' },
          { name: 'secret-volume', type: 'Secret', secretName: 'my-secret' },
        ],
        containers: [
          {
            container: 'main-container',
            mounts: [
              { name: 'config-volume', mountPath: '/etc/config', readOnly: true },
              { name: 'secret-volume', mountPath: '/etc/secrets', readOnly: true },
            ],
          },
        ],
      };
      mockGetPodMounts.mockResolvedValue(mockData);

      render(<PodMountsTab podName="my-pod" />);

      await waitFor(() => {
        expect(screen.getAllByText('config-volume').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('secret-volume').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('displays container names', async () => {
      const mockData = {
        volumes: [{ name: 'data-volume', type: 'EmptyDir' }],
        containers: [
          {
            container: 'web-server',
            mounts: [{ name: 'data-volume', mountPath: '/data' }],
          },
          {
            container: 'sidecar',
            mounts: [{ name: 'data-volume', mountPath: '/shared' }],
          },
        ],
      };
      mockGetPodMounts.mockResolvedValue(mockData);

      render(<PodMountsTab podName="my-pod" />);

      await waitFor(() => {
        expect(screen.getByText('web-server')).toBeInTheDocument();
        expect(screen.getByText('sidecar')).toBeInTheDocument();
      });
    });

    it('displays volume types', async () => {
      const mockData = {
        volumes: [
          { name: 'config-vol', type: 'ConfigMap' },
          { name: 'secret-vol', type: 'Secret' },
          { name: 'pvc-vol', type: 'PersistentVolumeClaim' },
          { name: 'empty-vol', type: 'EmptyDir' },
        ],
        containers: [],
      };
      mockGetPodMounts.mockResolvedValue(mockData);

      render(<PodMountsTab podName="my-pod" />);

      await waitFor(() => {
        expect(screen.getByText('ConfigMap')).toBeInTheDocument();
        expect(screen.getByText('Secret')).toBeInTheDocument();
        expect(screen.getByText('PersistentVolumeClaim')).toBeInTheDocument();
        expect(screen.getByText('EmptyDir')).toBeInTheDocument();
      });
    });

    it('displays mount paths', async () => {
      const mockData = {
        volumes: [{ name: 'vol1', type: 'ConfigMap' }],
        containers: [
          {
            container: 'container1',
            mounts: [{ name: 'vol1', mountPath: '/etc/config/app' }],
          },
        ],
      };
      mockGetPodMounts.mockResolvedValue(mockData);

      render(<PodMountsTab podName="my-pod" />);

      await waitFor(() => {
        expect(screen.getByText('/etc/config/app')).toBeInTheDocument();
      });
    });
  });

  describe('API calls', () => {
    it('calls GetPodMounts with pod name', async () => {
      mockGetPodMounts.mockResolvedValue({ volumes: [], containers: [] });

      render(<PodMountsTab podName="nginx-pod-123" />);

      await waitFor(() => {
        expect(mockGetPodMounts).toHaveBeenCalledWith('nginx-pod-123');
      });
    });

    it('does not call API when podName is empty', () => {
      render(<PodMountsTab podName="" />);

      expect(mockGetPodMounts).not.toHaveBeenCalled();
    });

    it('does not call API when podName is undefined', () => {
      render(<PodMountsTab podName={undefined as unknown as string} />);

      expect(mockGetPodMounts).not.toHaveBeenCalled();
    });

    it('re-fetches when podName changes', async () => {
      mockGetPodMounts.mockResolvedValue({ volumes: [], containers: [] });

      const { rerender } = render(<PodMountsTab podName="pod-1" />);

      await waitFor(() => {
        expect(mockGetPodMounts).toHaveBeenCalledWith('pod-1');
      });

      rerender(<PodMountsTab podName="pod-2" />);

      await waitFor(() => {
        expect(mockGetPodMounts).toHaveBeenCalledWith('pod-2');
      });
    });
  });

  describe('secret volumes', () => {
    it('identifies secret volumes correctly', async () => {
      const mockData = {
        volumes: [
          { name: 'secret-vol', type: 'Secret', secretName: 'my-secret' },
        ],
        containers: [
          {
            container: 'app',
            mounts: [{ name: 'secret-vol', mountPath: '/secrets' }],
          },
        ],
      };
      mockGetPodMounts.mockResolvedValue(mockData);

      render(<PodMountsTab podName="my-pod" />);

      await waitFor(() => {
        expect(screen.getByText('Secret')).toBeInTheDocument();
      });
    });

    it('identifies projected secret volumes', async () => {
      const mockData = {
        volumes: [
          {
            name: 'projected-vol',
            type: 'Projected',
            projectedSecretNames: ['secret-1', 'secret-2'],
          },
        ],
        containers: [],
      };
      mockGetPodMounts.mockResolvedValue(mockData);

      render(<PodMountsTab podName="my-pod" />);

      // The component displays projected secrets as combined text: "secrets: secret-1, secret-2"
      await waitFor(() => {
        expect(screen.getByText('secrets: secret-1, secret-2')).toBeInTheDocument();
      });
    });
  });
});
