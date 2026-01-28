import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ConfigDataTab from '../docker/resources/configs/ConfigDataTab';

// Mock the swarm API
vi.mock('../docker/swarmApi.js', () => ({
  GetSwarmConfigData: vi.fn(),
}));

import * as SwarmAPI from '../docker/swarmApi.js';

describe('ConfigDataTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading message while fetching data', () => {
      SwarmAPI.GetSwarmConfigData.mockImplementation(
        () => new Promise(() => {}),
      );

      render(<ConfigDataTab configId="config-123" configName="my-config" />);

      expect(screen.getByText(/Loading config data/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when API call fails', async () => {
      SwarmAPI.GetSwarmConfigData.mockRejectedValue(new Error('Access denied'));

      render(<ConfigDataTab configId="config-123" configName="my-config" />);

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to load config data/),
        ).toBeInTheDocument();
        expect(screen.getByText(/Access denied/)).toBeInTheDocument();
      });
    });
  });

  describe('data display', () => {
    it('displays config content when loaded', async () => {
      SwarmAPI.GetSwarmConfigData.mockResolvedValue(
        'server {\n  listen 80;\n}',
      );

      render(<ConfigDataTab configId="config-123" configName="nginx.conf" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });

    it('displays empty message for empty config', async () => {
      SwarmAPI.GetSwarmConfigData.mockResolvedValue('');

      render(<ConfigDataTab configId="config-123" configName="empty.conf" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });
    });

    it('detects template variables in config', async () => {
      SwarmAPI.GetSwarmConfigData.mockResolvedValue(
        'host: {{ .Env.HOST }}\nport: {{ .Env.PORT }}',
      );

      render(<ConfigDataTab configId="config-123" configName="app.conf" />);

      await waitFor(() => {
        expect(
          screen.getByText(/Detected template variables/),
        ).toBeInTheDocument();
        expect(screen.getByText('.Env.HOST')).toBeInTheDocument();
        expect(screen.getByText('.Env.PORT')).toBeInTheDocument();
      });
    });

    it('does not show template section when no variables found', async () => {
      SwarmAPI.GetSwarmConfigData.mockResolvedValue(
        'plain text content without variables',
      );

      render(<ConfigDataTab configId="config-123" configName="static.conf" />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
      });

      expect(
        screen.queryByText(/Detected template variables/),
      ).not.toBeInTheDocument();
    });
  });

  describe('API calls', () => {
    it('calls GetSwarmConfigData with correct configId', async () => {
      SwarmAPI.GetSwarmConfigData.mockResolvedValue('content');

      render(
        <ConfigDataTab configId="my-config-id" configName="config.yaml" />,
      );

      await waitFor(() => {
        expect(SwarmAPI.GetSwarmConfigData).toHaveBeenCalledWith(
          'my-config-id',
        );
      });
    });

    it('re-fetches when configId changes', async () => {
      SwarmAPI.GetSwarmConfigData.mockResolvedValue('content');

      const { rerender } = render(
        <ConfigDataTab configId="config-1" configName="config.yaml" />,
      );

      await waitFor(() => {
        expect(SwarmAPI.GetSwarmConfigData).toHaveBeenCalledWith('config-1');
      });

      rerender(<ConfigDataTab configId="config-2" configName="config.yaml" />);

      await waitFor(() => {
        expect(SwarmAPI.GetSwarmConfigData).toHaveBeenCalledWith('config-2');
      });
    });
  });
});
