import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock the Wails runtime (EventsOn, EventsOff used by LogViewerTab)
vi.mock('../../../wailsjs/runtime', () => ({
  EventsOn: vi.fn(),
  EventsOff: vi.fn(),
}));

// Mock the Wails API calls
const mockGetPodSummary = vi.fn();
const mockGetPodEvents = vi.fn();
const mockGetPodEventsLegacy = vi.fn();

vi.mock('../../../wailsjs/go/main/App', () => ({
  GetPodSummary: (...args) => mockGetPodSummary(...args),
  GetPodEvents: (...args) => mockGetPodEvents(...args),
  GetPodEventsLegacy: (...args) => mockGetPodEventsLegacy(...args),
  DeletePod: vi.fn(),
}));

// Mock LogViewerTab since it has complex dependencies
vi.mock('../../layout/bottompanel/LogViewerTab', () => ({
  default: ({ podName, embedded }) => (
    <div data-testid="log-viewer">
      LogViewer for {podName} {embedded ? '(embedded)' : ''}
    </div>
  ),
}));

// Mock SummaryTabHeader
vi.mock('../../layout/bottompanel/SummaryTabHeader.jsx', () => ({
  default: ({ name, labels: _labels, actions }) => (
    <div data-testid="summary-header">
      <span data-testid="header-name">{name}</span>
      {actions && <div data-testid="header-actions">{actions}</div>}
    </div>
  ),
}));

// Mock ResourceActions
vi.mock('../../components/ResourceActions.jsx', () => ({
  default: ({ resourceType, name, namespace, disabled }) => (
    <div data-testid="resource-actions">
      {resourceType}: {name} in {namespace} {disabled ? '(disabled)' : '(enabled)'}
    </div>
  ),
}));

import PodSummaryTab from '../../k8s/resources/pods/PodSummaryTab.jsx';

describe('PodSummaryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('shows loading indicator while fetching data', async () => {
      // Never resolve the promise to keep loading state
      mockGetPodSummary.mockImplementation(() => new Promise(() => {}));
      mockGetPodEventsLegacy.mockImplementation(() => new Promise(() => {}));

      render(<PodSummaryTab podName="test-pod" />);

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });
  });

  describe('Data display', () => {
    const mockPodData = {
      name: 'example-pod',
      namespace: 'test-namespace',
      status: 'Running',
      created: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      labels: { app: 'myapp', tier: 'frontend' },
      ports: ['80/TCP', '443/TCP'],
    };

    beforeEach(() => {
      mockGetPodSummary.mockResolvedValue(mockPodData);
      mockGetPodEvents.mockResolvedValue([]);
      mockGetPodEventsLegacy.mockResolvedValue([]);
    });

    it('displays pod status', async () => {
      render(<PodSummaryTab podName="example-pod" />);

      await waitFor(() => {
        expect(screen.getByText('Running')).toBeInTheDocument();
      });
    });

    it('displays pod namespace', async () => {
      render(<PodSummaryTab podName="example-pod" />);

      await waitFor(() => {
        expect(screen.getByText('test-namespace')).toBeInTheDocument();
      });
    });

    it('displays pod labels', async () => {
      render(<PodSummaryTab podName="example-pod" />);

      await waitFor(() => {
        expect(screen.getByText('app=myapp')).toBeInTheDocument();
        expect(screen.getByText('tier=frontend')).toBeInTheDocument();
      });
    });

    it('displays pod ports', async () => {
      render(<PodSummaryTab podName="example-pod" />);

      await waitFor(() => {
        expect(screen.getByText('80/TCP')).toBeInTheDocument();
        expect(screen.getByText('443/TCP')).toBeInTheDocument();
      });
    });

    it('displays pod name in quick info', async () => {
      render(<PodSummaryTab podName="example-pod" />);

      await waitFor(() => {
        // Pod name should appear in quick info section
        expect(screen.getByText('example-pod')).toBeInTheDocument();
      });
    });

    it('renders the log viewer component', async () => {
      render(<PodSummaryTab podName="example-pod" />);

      await waitFor(() => {
        expect(screen.getByTestId('log-viewer')).toBeInTheDocument();
        expect(screen.getByText(/LogViewer for example-pod/)).toBeInTheDocument();
      });
    });

    it('calls GetPodSummary with pod name', async () => {
      render(<PodSummaryTab podName="test-pod" />);

      await waitFor(() => {
        expect(mockGetPodSummary).toHaveBeenCalledWith('test-pod');
      });
    });
  });

  describe('Events display', () => {
    const mockEvents = [
      {
        type: 'Normal',
        reason: 'Scheduled',
        message: 'Successfully assigned test-namespace/example-pod to node-1',
        lastTimestamp: new Date().toISOString(),
        count: 1,
        source: 'default-scheduler',
      },
      {
        type: 'Warning',
        reason: 'BackOff',
        message: 'Back-off pulling image',
        lastTimestamp: new Date(Date.now() - 60000).toISOString(),
        count: 5,
      },
    ];

    beforeEach(() => {
      mockGetPodSummary.mockResolvedValue({ name: 'example-pod', namespace: 'test' });
      mockGetPodEvents.mockResolvedValue(mockEvents);
      mockGetPodEventsLegacy.mockResolvedValue(mockEvents);
    });

    it('displays events section header', async () => {
      render(<PodSummaryTab podName="example-pod" />);

      await waitFor(() => {
        expect(screen.getByText('Events')).toBeInTheDocument();
      });
    });

    it('displays event reasons', async () => {
      render(<PodSummaryTab podName="example-pod" />);

      await waitFor(() => {
        expect(screen.getByText('Scheduled')).toBeInTheDocument();
        expect(screen.getByText('BackOff')).toBeInTheDocument();
      });
    });

    it('displays event messages', async () => {
      render(<PodSummaryTab podName="example-pod" />);

      await waitFor(() => {
        expect(screen.getByText(/Successfully assigned/)).toBeInTheDocument();
        expect(screen.getByText(/Back-off pulling image/)).toBeInTheDocument();
      });
    });

    it('displays event counts', async () => {
      render(<PodSummaryTab podName="example-pod" />);

      await waitFor(() => {
        expect(screen.getByText('Count: 1')).toBeInTheDocument();
        expect(screen.getByText('Count: 5')).toBeInTheDocument();
      });
    });

    it('displays event types', async () => {
      render(<PodSummaryTab podName="example-pod" />);

      await waitFor(() => {
        expect(screen.getByText('Normal')).toBeInTheDocument();
        expect(screen.getByText('Warning')).toBeInTheDocument();
      });
    });

    it('hides events section when no events', async () => {
      mockGetPodEvents.mockResolvedValue([]);
      mockGetPodEventsLegacy.mockResolvedValue([]);

      render(<PodSummaryTab podName="example-pod" />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('test')).toBeInTheDocument(); // namespace
      });

      // Events section should not be visible when there are no events
      expect(screen.queryByText('Events')).not.toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('displays error message when summary fetch fails', async () => {
      mockGetPodSummary.mockRejectedValue(new Error('Failed to fetch pod'));
      mockGetPodEventsLegacy.mockResolvedValue([]);

      render(<PodSummaryTab podName="example-pod" />);

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
        expect(screen.getByText(/Failed to fetch pod/)).toBeInTheDocument();
      });
    });

    it('hides events section when events fetch fails', async () => {
      mockGetPodSummary.mockResolvedValue({ name: 'example-pod', namespace: 'test' });
      mockGetPodEvents.mockRejectedValue(new Error('Events error'));
      mockGetPodEventsLegacy.mockRejectedValue(new Error('Events error'));

      render(<PodSummaryTab podName="example-pod" />);

      // Wait for summary data to load
      await waitFor(() => {
        expect(screen.getByText('test')).toBeInTheDocument(); // namespace
      });

      // Events section should not be visible when fetch fails (no events loaded)
      expect(screen.queryByText('Events')).not.toBeInTheDocument();
    });
  });

  describe('No pod name', () => {
    it('does not fetch when podName is empty', async () => {
      render(<PodSummaryTab podName="" />);

      // Wait a bit to ensure no calls were made
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockGetPodSummary).not.toHaveBeenCalled();
    });

    it('does not fetch when podName is undefined', async () => {
      render(<PodSummaryTab podName={undefined} />);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockGetPodSummary).not.toHaveBeenCalled();
    });
  });

  describe('Status colors', () => {
    it('displays Running status with styling', async () => {
      mockGetPodSummary.mockResolvedValue({ name: 'pod', namespace: 'ns', status: 'Running' });
      mockGetPodEventsLegacy.mockResolvedValue([]);

      render(<PodSummaryTab podName="pod" />);

      await waitFor(() => {
        const statusElement = screen.getByText('Running');
        expect(statusElement).toBeInTheDocument();
        // Verify element has inline style applied (color is set)
        expect(statusElement).toHaveAttribute('style');
      });
    });

    it('displays Pending status with styling', async () => {
      mockGetPodSummary.mockResolvedValue({ name: 'pod', namespace: 'ns', status: 'Pending' });
      mockGetPodEventsLegacy.mockResolvedValue([]);

      render(<PodSummaryTab podName="pod" />);

      await waitFor(() => {
        const statusElement = screen.getByText('Pending');
        expect(statusElement).toBeInTheDocument();
        // Verify element has inline style applied (color is set)
        expect(statusElement).toHaveAttribute('style');
      });
    });

    it('displays Failed status with styling', async () => {
      mockGetPodSummary.mockResolvedValue({ name: 'pod', namespace: 'ns', status: 'Failed' });
      mockGetPodEventsLegacy.mockResolvedValue([]);

      render(<PodSummaryTab podName="pod" />);

      await waitFor(() => {
        const statusElement = screen.getByText('Failed');
        expect(statusElement).toBeInTheDocument();
        // Verify element has inline style applied (color is set)
        expect(statusElement).toHaveAttribute('style');
      });
    });
  });

  describe('ResourceActions integration', () => {
    it('passes pod data to ResourceActions', async () => {
      mockGetPodSummary.mockResolvedValue({ name: 'example-pod', namespace: 'test-ns' });
      mockGetPodEventsLegacy.mockResolvedValue([]);

      render(<PodSummaryTab podName="example-pod" />);

      await waitFor(() => {
        expect(screen.getByTestId('resource-actions')).toBeInTheDocument();
        expect(screen.getByText(/Pod: example-pod in test-ns/)).toBeInTheDocument();
      });
    });

    it('disables ResourceActions when no data', async () => {
      mockGetPodSummary.mockResolvedValue(null);
      mockGetPodEventsLegacy.mockResolvedValue([]);

      render(<PodSummaryTab podName="example-pod" />);

      await waitFor(() => {
        expect(screen.getByTestId('resource-actions')).toHaveTextContent('(disabled)');
      });
    });
  });
});
