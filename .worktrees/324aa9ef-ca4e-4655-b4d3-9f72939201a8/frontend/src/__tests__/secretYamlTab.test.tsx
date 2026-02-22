import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SecretYamlTab from '../k8s/resources/secrets/SecretYamlTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetSecretYAML: vi.fn(),
}));

const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, writable: true });

import * as AppAPI from '../../wailsjs/go/main/App';

const getSecretYamlMock = vi.mocked(AppAPI.GetSecretYAML);

describe('SecretYamlTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      getSecretYamlMock.mockImplementation(() => new Promise(() => {}));

      render(<SecretYamlTab namespace="default" name="my-secret" />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('data display', () => {
    it('displays secret name in header', async () => {
      getSecretYamlMock.mockResolvedValue('');

      render(<SecretYamlTab namespace="default" name="test-secret" />);

      await waitFor(() => {
        expect(screen.getByText(/YAML for test-secret/)).toBeInTheDocument();
      });
    });

    it('displays action buttons', async () => {
      getSecretYamlMock.mockResolvedValue('');

      render(<SecretYamlTab namespace="default" name="my-secret" />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
        expect(screen.getByText('Copy')).toBeInTheDocument();
        expect(screen.getByText('Download')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      getSecretYamlMock.mockRejectedValue(new Error('Unauthorized'));

      render(<SecretYamlTab namespace="default" name="my-secret" />);

      await waitFor(() => {
        expect(screen.getByText(/Unauthorized/)).toBeInTheDocument();
      });
    });
  });

  describe('actions', () => {
    it('calls API on refresh button click', async () => {
      getSecretYamlMock.mockResolvedValue('data: secret');

      render(<SecretYamlTab namespace="default" name="my-secret" />);

      await waitFor(() => {
        expect(AppAPI.GetSecretYAML).toHaveBeenCalledWith('default', 'my-secret');
      });

      fireEvent.click(screen.getByText('Refresh'));

      await waitFor(() => {
        expect(AppAPI.GetSecretYAML).toHaveBeenCalledTimes(2);
      });
    });

    it('copies content to clipboard on copy button click', async () => {
      const mockYaml = 'apiVersion: v1\nkind: Secret';
      getSecretYamlMock.mockResolvedValue(mockYaml);

      render(<SecretYamlTab namespace="default" name="my-secret" />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Copy'));

      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockYaml);
    });
  });

  describe('API calls', () => {
    it('does not call API when namespace is missing', async () => {
      render(<SecretYamlTab namespace="" name="my-secret" />);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(AppAPI.GetSecretYAML).not.toHaveBeenCalled();
    });

    it('does not call API when name is missing', async () => {
      render(<SecretYamlTab namespace="default" name="" />);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(AppAPI.GetSecretYAML).not.toHaveBeenCalled();
    });

    it('re-fetches when props change', async () => {
      getSecretYamlMock.mockResolvedValue('yaml: content');

      const { rerender } = render(<SecretYamlTab namespace="ns1" name="secret-1" />);

      await waitFor(() => {
        expect(AppAPI.GetSecretYAML).toHaveBeenCalledWith('ns1', 'secret-1');
      });

      rerender(<SecretYamlTab namespace="ns2" name="secret-2" />);

      await waitFor(() => {
        expect(AppAPI.GetSecretYAML).toHaveBeenCalledWith('ns2', 'secret-2');
      });
    });
  });
});