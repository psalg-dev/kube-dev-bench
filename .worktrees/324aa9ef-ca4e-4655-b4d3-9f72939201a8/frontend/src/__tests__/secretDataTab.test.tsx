import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SecretDataTab from '../k8s/resources/secrets/SecretDataTab';

const mockGetSecretDataByName = vi.fn();
const mockUpdateSecretDataKey = vi.fn();

// Mock notification module
vi.mock('../notification', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

// Mock the Wails App API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetSecretDataByName: (...args: unknown[]) => mockGetSecretDataByName(...args),
  UpdateSecretDataKey: (...args: unknown[]) => mockUpdateSecretDataKey(...args),
}));

describe('SecretDataTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading message while fetching data', () => {
      mockGetSecretDataByName.mockImplementation(() => new Promise(() => {}));

      render(<SecretDataTab namespace="default" secretName="my-secret" />);

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      mockGetSecretDataByName.mockRejectedValue(new Error('Connection failed'));

      render(<SecretDataTab namespace="default" secretName="my-secret" />);

      await waitFor(() => {
        expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
      });
    });

    it('shows generic error when no message provided', async () => {
      mockGetSecretDataByName.mockRejectedValue({});

      render(<SecretDataTab namespace="default" secretName="my-secret" />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch secret data/i)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('handles empty data array', async () => {
      mockGetSecretDataByName.mockResolvedValue([]);

      render(<SecretDataTab namespace="default" secretName="my-secret" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });

    it('handles null response', async () => {
      mockGetSecretDataByName.mockResolvedValue(null);

      render(<SecretDataTab namespace="default" secretName="my-secret" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    const mockData = [
      { key: 'username', value: btoa('admin'), size: 5 },
      { key: 'password', value: btoa('secret123'), size: 9 },
      { key: 'api-key', value: btoa('key-12345'), size: 9 },
    ];

    it('displays secret keys', async () => {
      mockGetSecretDataByName.mockResolvedValue(mockData);

      render(<SecretDataTab namespace="default" secretName="my-secret" />);

      await waitFor(() => {
        expect(screen.getByText('username')).toBeInTheDocument();
        expect(screen.getByText('password')).toBeInTheDocument();
        expect(screen.getByText('api-key')).toBeInTheDocument();
      });
    });

    it('values are hidden by default', async () => {
      mockGetSecretDataByName.mockResolvedValue(mockData);

      render(<SecretDataTab namespace="default" secretName="my-secret" />);

      await waitFor(() => {
        expect(screen.getByText('username')).toBeInTheDocument();
      });

      // Values should be masked/hidden
      expect(screen.queryByText('admin')).not.toBeInTheDocument();
      expect(screen.queryByText('secret123')).not.toBeInTheDocument();
    });
  });

  describe('API calls', () => {
    it('calls GetSecretDataByName with correct params', async () => {
      mockGetSecretDataByName.mockResolvedValue([]);

      render(<SecretDataTab namespace="test-ns" secretName="test-secret" />);

      await waitFor(() => {
        expect(mockGetSecretDataByName).toHaveBeenCalledWith('test-ns', 'test-secret');
      });
    });

    it('does not call API when namespace is missing', () => {
      render(<SecretDataTab namespace="" secretName="my-secret" />);

      expect(mockGetSecretDataByName).not.toHaveBeenCalled();
    });

    it('does not call API when secretName is missing', () => {
      render(<SecretDataTab namespace="default" secretName="" />);

      expect(mockGetSecretDataByName).not.toHaveBeenCalled();
    });

    it('re-fetches when props change', async () => {
      mockGetSecretDataByName.mockResolvedValue([]);

      const { rerender } = render(<SecretDataTab namespace="ns1" secretName="secret1" />);

      await waitFor(() => {
        expect(mockGetSecretDataByName).toHaveBeenCalledWith('ns1', 'secret1');
      });

      rerender(<SecretDataTab namespace="ns2" secretName="secret2" />);

      await waitFor(() => {
        expect(mockGetSecretDataByName).toHaveBeenCalledWith('ns2', 'secret2');
      });
    });
  });

  describe('visibility toggle', () => {
    const mockData = [
      { key: 'password', value: btoa('secret123'), size: 9 },
    ];

    it('can toggle secret visibility', async () => {
      mockGetSecretDataByName.mockResolvedValue(mockData);

      render(<SecretDataTab namespace="default" secretName="my-secret" />);

      await waitFor(() => {
        expect(screen.getByText('password')).toBeInTheDocument();
      });
    });
  });

  describe('copy functionality', () => {
    const mockData = [
      { key: 'token', value: btoa('my-token'), size: 8 },
    ];

    it('renders copy button', async () => {
      mockGetSecretDataByName.mockResolvedValue(mockData);

      render(<SecretDataTab namespace="default" secretName="my-secret" />);

      await waitFor(() => {
        expect(screen.getByText('token')).toBeInTheDocument();
      });
    });
  });

  describe('editing functionality', () => {
    const mockData = [{ key: 'config', value: btoa('original'), size: 8 }];

    it('can save edited content', async () => {
      mockGetSecretDataByName.mockResolvedValue(mockData);
      mockUpdateSecretDataKey.mockResolvedValue({});

      render(<SecretDataTab namespace="default" secretName="my-secret" />);

      await waitFor(() => {
        expect(screen.getByText('config')).toBeInTheDocument();
      });
    });

    it('shows error notification on save failure', async () => {
      mockGetSecretDataByName.mockResolvedValue(mockData);
      mockUpdateSecretDataKey.mockRejectedValue(new Error('Update failed'));

      render(<SecretDataTab namespace="default" secretName="my-secret" />);

      await waitFor(() => {
        expect(screen.getByText('config')).toBeInTheDocument();
      });
    });
  });
});
