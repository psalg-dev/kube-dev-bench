import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ServiceYamlTab from '../k8s/resources/services/ServiceYamlTab';

// Mock the Wails App API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetServiceYAML: vi.fn(),
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

describe('ServiceYamlTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      AppAPI.GetServiceYAML.mockImplementation(() => new Promise(() => {}));

      render(<ServiceYamlTab namespace="default" name="my-service" />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('data display', () => {
    it('displays service name in header', async () => {
      AppAPI.GetServiceYAML.mockResolvedValue('');

      render(<ServiceYamlTab namespace="default" name="api-service" />);

      expect(screen.getByText(/YAML for api-service/)).toBeInTheDocument();
    });

    it('displays action buttons', async () => {
      AppAPI.GetServiceYAML.mockResolvedValue('');

      render(<ServiceYamlTab namespace="default" name="my-service" />);

      expect(screen.getByText('Refresh')).toBeInTheDocument();
      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      AppAPI.GetServiceYAML.mockRejectedValue(new Error('Service not found'));

      render(<ServiceYamlTab namespace="default" name="my-service" />);

      await waitFor(() => {
        expect(screen.getByText(/Service not found/)).toBeInTheDocument();
      });
    });
  });

  describe('actions', () => {
    it('calls API on refresh button click', async () => {
      AppAPI.GetServiceYAML.mockResolvedValue('ports: []');

      render(<ServiceYamlTab namespace="default" name="my-service" />);

      await waitFor(() => {
        expect(AppAPI.GetServiceYAML).toHaveBeenCalledWith(
          'default',
          'my-service',
        );
      });

      fireEvent.click(screen.getByText('Refresh'));

      await waitFor(() => {
        expect(AppAPI.GetServiceYAML).toHaveBeenCalledTimes(2);
      });
    });

    it('copies content to clipboard on copy button click', async () => {
      const mockYaml = 'apiVersion: v1\nkind: Service';
      AppAPI.GetServiceYAML.mockResolvedValue(mockYaml);

      render(<ServiceYamlTab namespace="default" name="my-service" />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Copy'));

      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockYaml);
    });
  });

  describe('API calls', () => {
    it('does not call API when namespace is missing', async () => {
      render(<ServiceYamlTab namespace="" name="my-service" />);

      await new Promise((r) => setTimeout(r, 50));

      expect(AppAPI.GetServiceYAML).not.toHaveBeenCalled();
    });

    it('does not call API when name is missing', async () => {
      render(<ServiceYamlTab namespace="default" name="" />);

      await new Promise((r) => setTimeout(r, 50));

      expect(AppAPI.GetServiceYAML).not.toHaveBeenCalled();
    });

    it('re-fetches when props change', async () => {
      AppAPI.GetServiceYAML.mockResolvedValue('yaml: content');

      const { rerender } = render(
        <ServiceYamlTab namespace="ns1" name="svc-1" />,
      );

      await waitFor(() => {
        expect(AppAPI.GetServiceYAML).toHaveBeenCalledWith('ns1', 'svc-1');
      });

      rerender(<ServiceYamlTab namespace="ns2" name="svc-2" />);

      await waitFor(() => {
        expect(AppAPI.GetServiceYAML).toHaveBeenCalledWith('ns2', 'svc-2');
      });
    });
  });
});
