import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConfigMapYamlTab from '../k8s/resources/configmaps/ConfigMapYamlTab';

// Mock the Wails App API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetConfigMapYAML: vi.fn(),
}));

// Mock clipboard
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
});

import * as AppAPI from '../../wailsjs/go/main/App';

describe('ConfigMapYamlTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      AppAPI.GetConfigMapYAML.mockImplementation(() => new Promise(() => {}));

      render(<ConfigMapYamlTab namespace="default" name="my-configmap" />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('data display', () => {
    it('displays configmap name in header', async () => {
      AppAPI.GetConfigMapYAML.mockResolvedValue('');

      render(<ConfigMapYamlTab namespace="default" name="test-config" />);

      expect(screen.getByText(/YAML for test-config/)).toBeInTheDocument();
    });

    it('displays action buttons', async () => {
      AppAPI.GetConfigMapYAML.mockResolvedValue('');

      render(<ConfigMapYamlTab namespace="default" name="my-config" />);

      expect(screen.getByText('Refresh')).toBeInTheDocument();
      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      AppAPI.GetConfigMapYAML.mockRejectedValue(new Error('Not found'));

      render(<ConfigMapYamlTab namespace="default" name="my-config" />);

      await waitFor(() => {
        expect(screen.getByText(/Not found/)).toBeInTheDocument();
      });
    });
  });

  describe('actions', () => {
    it('calls API on refresh button click', async () => {
      AppAPI.GetConfigMapYAML.mockResolvedValue('data: value');

      render(<ConfigMapYamlTab namespace="default" name="my-config" />);

      await waitFor(() => {
        expect(AppAPI.GetConfigMapYAML).toHaveBeenCalledWith(
          'default',
          'my-config',
        );
      });

      fireEvent.click(screen.getByText('Refresh'));

      await waitFor(() => {
        expect(AppAPI.GetConfigMapYAML).toHaveBeenCalledTimes(2);
      });
    });

    it('copies content to clipboard on copy button click', async () => {
      const mockYaml = 'apiVersion: v1\nkind: ConfigMap';
      AppAPI.GetConfigMapYAML.mockResolvedValue(mockYaml);

      render(<ConfigMapYamlTab namespace="default" name="my-config" />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Copy'));

      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockYaml);
    });
  });

  describe('API calls', () => {
    it('does not call API when namespace is missing', async () => {
      render(<ConfigMapYamlTab namespace="" name="my-config" />);

      await new Promise((r) => setTimeout(r, 50));

      expect(AppAPI.GetConfigMapYAML).not.toHaveBeenCalled();
    });

    it('does not call API when name is missing', async () => {
      render(<ConfigMapYamlTab namespace="default" name="" />);

      await new Promise((r) => setTimeout(r, 50));

      expect(AppAPI.GetConfigMapYAML).not.toHaveBeenCalled();
    });

    it('re-fetches when props change', async () => {
      AppAPI.GetConfigMapYAML.mockResolvedValue('yaml: content');

      const { rerender } = render(
        <ConfigMapYamlTab namespace="ns1" name="config-1" />,
      );

      await waitFor(() => {
        expect(AppAPI.GetConfigMapYAML).toHaveBeenCalledWith('ns1', 'config-1');
      });

      rerender(<ConfigMapYamlTab namespace="ns2" name="config-2" />);

      await waitFor(() => {
        expect(AppAPI.GetConfigMapYAML).toHaveBeenCalledWith('ns2', 'config-2');
      });
    });
  });
});
