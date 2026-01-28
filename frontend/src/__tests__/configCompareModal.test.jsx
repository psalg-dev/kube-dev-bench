import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConfigCompareModal from '../docker/resources/configs/ConfigCompareModal.jsx';

// Mock the swarmApi
vi.mock('../docker/swarmApi.js', () => ({
  GetSwarmConfigData: vi.fn(),
}));

// Mock TextViewerTab
vi.mock('../layout/bottompanel/TextViewerTab.jsx', () => ({
  default: ({ content, loading, error, loadingLabel }) => (
    <div data-testid="text-viewer">
      {loading && <div>{loadingLabel}</div>}
      {error && <div data-testid="error">{error}</div>}
      {!loading && !error && <div data-testid="content">{content}</div>}
    </div>
  ),
}));

import { GetSwarmConfigData } from '../docker/swarmApi.js';

describe('ConfigCompareModal', () => {
  const mockConfigs = [
    { id: 'config-1', name: 'config-one' },
    { id: 'config-2', name: 'config-two' },
    { id: 'config-3', name: 'config-three' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    GetSwarmConfigData.mockResolvedValue('config content');
  });

  describe('rendering', () => {
    it('does not render when open is false', () => {
      const { container } = render(
        <ConfigCompareModal
          open={false}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={mockConfigs}
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders when open is true', async () => {
      render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={mockConfigs}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Compare configs/i)).toBeInTheDocument();
      });
    });

    it('displays the base config name in header', async () => {
      render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={mockConfigs}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/config-one/)).toBeInTheDocument();
      });
    });

    it('shows Close button', async () => {
      render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={mockConfigs}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Close')).toBeInTheDocument();
      });
    });

    it('displays "Compare against:" label', async () => {
      render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={mockConfigs}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Compare against:')).toBeInTheDocument();
      });
    });
  });

  describe('config selection dropdown', () => {
    it('renders a select dropdown', async () => {
      render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={mockConfigs}
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('shows placeholder option', async () => {
      render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={mockConfigs}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('(select a config)')).toBeInTheDocument();
      });
    });

    it('filters out the base config from options', async () => {
      render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={mockConfigs}
        />,
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        const options = select.querySelectorAll('option');
        // Should have placeholder + 2 other configs (not config-1)
        expect(options.length).toBe(3);
        expect(screen.getByText('config-two')).toBeInTheDocument();
        expect(screen.getByText('config-three')).toBeInTheDocument();
      });
    });

    it('loads other config data when selected', async () => {
      GetSwarmConfigData.mockResolvedValue('base config content');

      render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={mockConfigs}
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      GetSwarmConfigData.mockResolvedValue('other config content');

      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'config-2' },
      });

      await waitFor(() => {
        // Should have called API for both base and other config
        expect(GetSwarmConfigData).toHaveBeenCalledWith('config-1');
        expect(GetSwarmConfigData).toHaveBeenCalledWith('config-2');
      });
    });

    it('shows diff hint when a config is selected', async () => {
      GetSwarmConfigData.mockResolvedValue('config content');

      render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={mockConfigs}
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'config-2' },
      });

      await waitFor(() => {
        expect(screen.getByText(/showing unified diff/i)).toBeInTheDocument();
      });
    });
  });

  describe('button interactions', () => {
    it('calls onClose when Close button clicked', async () => {
      const onClose = vi.fn();

      render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={mockConfigs}
          onClose={onClose}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Close')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close'));

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when clicking overlay', async () => {
      const onClose = vi.fn();

      const { container } = render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={mockConfigs}
          onClose={onClose}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Close')).toBeInTheDocument();
      });

      // Click the overlay (outermost div)
      fireEvent.click(container.firstChild);

      expect(onClose).toHaveBeenCalled();
    });

    it('does not call onClose when clicking modal content', async () => {
      const onClose = vi.fn();

      render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={mockConfigs}
          onClose={onClose}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Close')).toBeInTheDocument();
      });

      // Click on modal text content
      fireEvent.click(screen.getByText(/Compare configs/i));

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('loading and error states', () => {
    it('shows loading state while fetching base config', async () => {
      let resolvePromise;
      GetSwarmConfigData.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          }),
      );

      render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={mockConfigs}
        />,
      );

      expect(screen.getByText('Loading config data...')).toBeInTheDocument();

      // Resolve the promise
      resolvePromise('config content');

      await waitFor(() => {
        expect(
          screen.queryByText('Loading config data...'),
        ).not.toBeInTheDocument();
      });
    });

    it('shows error when API call fails', async () => {
      GetSwarmConfigData.mockRejectedValue(new Error('Failed to load'));

      render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={mockConfigs}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Failed to load');
      });
    });
  });

  describe('initial content', () => {
    it('shows instruction message when no config selected', async () => {
      GetSwarmConfigData.mockResolvedValue('base config content');

      render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={mockConfigs}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('content')).toHaveTextContent(
          'Select a config to compare.',
        );
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty configs array', async () => {
      GetSwarmConfigData.mockResolvedValue('config content');

      render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={[]}
        />,
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        const options = select.querySelectorAll('option');
        // Only placeholder option
        expect(options.length).toBe(1);
      });
    });

    it('handles null configs', async () => {
      GetSwarmConfigData.mockResolvedValue('config content');

      render(
        <ConfigCompareModal
          open={true}
          baseConfigId="config-1"
          baseConfigName="config-one"
          configs={null}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Compare configs/i)).toBeInTheDocument();
      });
    });
  });
});
