import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ConfigDataTab from '../docker/resources/configs/ConfigDataTab';

const mockGetSwarmConfigData = vi.fn();

// Mock the swarm API
vi.mock('../docker/swarmApi', () => ({
  GetSwarmConfigData: (...args: unknown[]) => mockGetSwarmConfigData(...args),
}));

describe('ConfigDataTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading message while fetching data', () => {
      mockGetSwarmConfigData.mockImplementation(() => new Promise(() => {}));

      render(<ConfigDataTab configId="config-123" configName="my-config" />);

      expect(screen.getByText(/Loading config data/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      mockGetSwarmConfigData.mockRejectedValue(new Error('Access denied'));

      render(<ConfigDataTab configId="config-123" configName="my-config" />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load config data/)).toBeInTheDocument();
        expect(screen.getByText(/Access denied/)).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    it('displays config content when loaded', async () => {
      mockGetSwarmConfigData.mockResolvedValue('server {\n  listen 80;\n}');

      render(<ConfigDataTab configId="config-123" configName="nginx.conf" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });

    it('displays empty message for empty config', async () => {
      mockGetSwarmConfigData.mockResolvedValue('');

      render(<ConfigDataTab configId="config-123" configName="empty.conf" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });

    it('detects template variables in config', async () => {
      mockGetSwarmConfigData.mockResolvedValue('host: {{ .Env.HOST }}\nport: {{ .Env.PORT }}');

      render(<ConfigDataTab configId="config-123" configName="app.conf" />);

      await waitFor(() => {
        expect(screen.getByText(/Detected template variables/)).toBeInTheDocument();
        expect(screen.getByText('.Env.HOST')).toBeInTheDocument();
        expect(screen.getByText('.Env.PORT')).toBeInTheDocument();
      });
    });

    it('does not show template section when no variables found', async () => {
      mockGetSwarmConfigData.mockResolvedValue('plain text content without variables');

      render(<ConfigDataTab configId="config-123" configName="static.conf" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      expect(screen.queryByText(/Detected template variables/)).not.toBeInTheDocument();
    });
  });

  describe('API calls', () => {
    it('calls GetSwarmConfigData with correct configId', async () => {
      mockGetSwarmConfigData.mockResolvedValue('content');

      render(<ConfigDataTab configId="my-config-id" configName="config.yaml" />);

      await waitFor(() => {
        expect(mockGetSwarmConfigData).toHaveBeenCalledWith('my-config-id');
      });
    });

    it('re-fetches when configId changes', async () => {
      mockGetSwarmConfigData.mockResolvedValue('content');

      const { rerender } = render(<ConfigDataTab configId="config-1" configName="config.yaml" />);

      await waitFor(() => {
        expect(mockGetSwarmConfigData).toHaveBeenCalledWith('config-1');
      });

      rerender(<ConfigDataTab configId="config-2" configName="config.yaml" />);

      await waitFor(() => {
        expect(mockGetSwarmConfigData).toHaveBeenCalledWith('config-2');
      });
    });
  });
});
