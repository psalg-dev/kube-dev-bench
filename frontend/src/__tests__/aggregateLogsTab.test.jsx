import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AggregateLogsTab from '../components/AggregateLogsTab';

// Mock TextViewerTab
vi.mock('../layout/bottompanel/TextViewerTab', () => ({
  default: function TextViewerTabMock({ content, loading, error, loadingLabel }) {
    if (loading) return <div data-testid="loading">{loadingLabel}</div>;
    if (error) return <div data-testid="error">{error}</div>;
    return <div data-testid="content">{content}</div>;
  },
}));

describe('AggregateLogsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading state initially', async () => {
      const loadLogs = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<AggregateLogsTab title="Test Logs" loadLogs={loadLogs} />);

      expect(screen.getByTestId('loading')).toHaveTextContent('Loading Test Logs...');
    });
  });

  describe('error handling', () => {
    it('shows error when loadLogs is not a function', async () => {
      render(<AggregateLogsTab title="Logs" loadLogs={undefined} />);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Logs loader not configured');
      });
    });

    it('shows error message when loadLogs throws', async () => {
      const loadLogs = vi.fn().mockRejectedValue(new Error('Failed to fetch logs'));

      render(<AggregateLogsTab title="Logs" loadLogs={loadLogs} />);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Failed to fetch logs');
      });
    });

    it('shows error string when error is not Error object', async () => {
      const loadLogs = vi.fn().mockRejectedValue('Network error');

      render(<AggregateLogsTab title="Logs" loadLogs={loadLogs} />);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Network error');
      });
    });
  });

  describe('data display', () => {
    it('displays logs content when loaded successfully', async () => {
      const loadLogs = vi.fn().mockResolvedValue('Log line 1\nLog line 2\nLog line 3');

      render(<AggregateLogsTab title="App Logs" loadLogs={loadLogs} />);

      await waitFor(() => {
        expect(screen.getByTestId('content')).toBeInTheDocument();
      });
      // Verify the content contains the expected lines
      expect(screen.getByTestId('content').textContent).toContain('Log line 1');
    });

    it('displays title in header', async () => {
      const loadLogs = vi.fn().mockResolvedValue('logs');

      render(<AggregateLogsTab title="My Custom Title" loadLogs={loadLogs} />);

      expect(screen.getByText('My Custom Title')).toBeInTheDocument();
    });

    it('uses default title when not provided', async () => {
      const loadLogs = vi.fn().mockResolvedValue('logs');

      render(<AggregateLogsTab loadLogs={loadLogs} />);

      expect(screen.getByText('Logs')).toBeInTheDocument();
    });

    it('handles null result from loadLogs', async () => {
      const loadLogs = vi.fn().mockResolvedValue(null);

      render(<AggregateLogsTab title="Logs" loadLogs={loadLogs} />);

      await waitFor(() => {
        expect(screen.getByTestId('content')).toHaveTextContent('');
      });
    });

    it('handles undefined result from loadLogs', async () => {
      const loadLogs = vi.fn().mockResolvedValue(undefined);

      render(<AggregateLogsTab title="Logs" loadLogs={loadLogs} />);

      await waitFor(() => {
        expect(screen.getByTestId('content')).toHaveTextContent('');
      });
    });
  });

  describe('reloadKey behavior', () => {
    it('reloads logs when reloadKey changes', async () => {
      const loadLogs = vi.fn()
        .mockResolvedValueOnce('First load')
        .mockResolvedValueOnce('Second load');

      const { rerender } = render(
        <AggregateLogsTab title="Logs" loadLogs={loadLogs} reloadKey={1} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('content')).toHaveTextContent('First load');
      });

      rerender(<AggregateLogsTab title="Logs" loadLogs={loadLogs} reloadKey={2} />);

      await waitFor(() => {
        expect(screen.getByTestId('content')).toHaveTextContent('Second load');
      });

      expect(loadLogs).toHaveBeenCalledTimes(2);
    });
  });

  describe('API calls', () => {
    it('calls loadLogs on mount', async () => {
      const loadLogs = vi.fn().mockResolvedValue('logs');

      render(<AggregateLogsTab title="Logs" loadLogs={loadLogs} />);

      await waitFor(() => expect(loadLogs).toHaveBeenCalledTimes(1));
    });
  });
});
