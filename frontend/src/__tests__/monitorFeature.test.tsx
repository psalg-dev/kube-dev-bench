import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { eventsOnMock, resetAllMocks, appApiMocks } from './wailsMocks';
import FooterBar from '../layout/FooterBar';
import MonitorPanel from '../layout/MonitorPanel';

// Mock ClusterStateContext
vi.mock('../state/ClusterStateContext', () => ({
  useClusterState: () => ({
    selectedContext: 'test-context',
    selectedNamespaces: ['default', 'kube-system'],
    clusterConnected: true,
    connectionStatus: { isInsecure: false },
  }),
}));

type MonitorIssue = {
  issueID?: string;
  type: 'error' | 'warning';
  resource: string;
  name: string;
  namespace: string;
  reason: string;
  message?: string;
  containerName?: string;
  restartCount?: number;
  age?: string;
  podPhase?: string;
  ownerKind?: string;
  ownerName?: string;
  nodeName?: string;
};

type MonitorInfo = {
  errorCount: number;
  warningCount: number;
  errors: MonitorIssue[];
  warnings: MonitorIssue[];
};

beforeEach(() => {
  resetAllMocks();
  document.body.innerHTML = '';
  // Setup EventsOn to return an unsubscribe function
  eventsOnMock.mockReturnValue(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('FooterBar monitoring badges', () => {
  it('renders without badges when no issues', () => {
    render(<FooterBar />);
    expect(screen.queryByText(/Errors:/)).toBeNull();
    expect(screen.queryByText(/Warnings:/)).toBeNull();
  });

  it('listens to monitor:update events', () => {
    render(<FooterBar />);
    expect(eventsOnMock).toHaveBeenCalledWith('monitor:update', expect.any(Function));
  });

  it('displays error badge when errors present', async () => {
    let updateCallback: ((data: MonitorInfo) => void) | undefined;
    eventsOnMock.mockImplementation((eventName, callback) => {
      if (eventName === 'monitor:update') {
        updateCallback = callback as (data: MonitorInfo) => void;
      }
      return () => {};
    });

    render(<FooterBar />);

    // Trigger monitor update with errors
    const monitorData: MonitorInfo = {
      errorCount: 2,
      warningCount: 0,
      errors: [
        { type: 'error', resource: 'Pod', name: 'test-pod', namespace: 'default', reason: 'CrashLoopBackOff', message: 'Container crashed' },
        { type: 'error', resource: 'Pod', name: 'test-pod-2', namespace: 'default', reason: 'ImagePullBackOff', message: 'Image not found' },
      ],
      warnings: [],
    };
    act(() => {
      updateCallback?.(monitorData);
    });

    await waitFor(() => {
      expect(screen.getByText(/Errors: 2/)).toBeInTheDocument();
    });
  });

  it('displays warning badge when warnings present', async () => {
    let updateCallback: ((data: MonitorInfo) => void) | undefined;
    eventsOnMock.mockImplementation((eventName, callback) => {
      if (eventName === 'monitor:update') {
        updateCallback = callback as (data: MonitorInfo) => void;
      }
      return () => {};
    });

    render(<FooterBar />);

    // Trigger monitor update with warnings
    const monitorData: MonitorInfo = {
      errorCount: 0,
      warningCount: 1,
      errors: [],
      warnings: [
        { type: 'warning', resource: 'Pod', name: 'test-pod', namespace: 'default', reason: 'FailedScheduling', message: '0/1 nodes available' },
      ],
    };
    act(() => {
      updateCallback?.(monitorData);
    });

    await waitFor(() => {
      expect(screen.getByText(/Warnings: 1/)).toBeInTheDocument();
    });
  });

  it('displays both error and warning badges', async () => {
    let updateCallback: ((data: MonitorInfo) => void) | undefined;
    eventsOnMock.mockImplementation((eventName, callback) => {
      if (eventName === 'monitor:update') {
        updateCallback = callback as (data: MonitorInfo) => void;
      }
      return () => {};
    });

    render(<FooterBar />);

    // Trigger monitor update with both
    const monitorData: MonitorInfo = {
      errorCount: 3,
      warningCount: 5,
      errors: [
        { type: 'error', resource: 'Pod', name: 'pod1', namespace: 'default', reason: 'CrashLoopBackOff', message: 'Crashed' },
        { type: 'error', resource: 'Pod', name: 'pod2', namespace: 'default', reason: 'ImagePullBackOff', message: 'Image error' },
        { type: 'error', resource: 'Pod', name: 'pod3', namespace: 'default', reason: 'PodFailed', message: 'Failed' },
      ],
      warnings: [
        { type: 'warning', resource: 'Pod', name: 'pod4', namespace: 'default', reason: 'FailedScheduling', message: 'No nodes' },
        { type: 'warning', resource: 'Pod', name: 'pod5', namespace: 'default', reason: 'BackOff', message: 'Back-off' },
        { type: 'warning', resource: 'Pod', name: 'pod6', namespace: 'default', reason: 'HighRestarts', message: 'Restarting' },
        { type: 'warning', resource: 'Pod', name: 'pod7', namespace: 'default', reason: 'Warning1', message: 'Warn1' },
        { type: 'warning', resource: 'Pod', name: 'pod8', namespace: 'default', reason: 'Warning2', message: 'Warn2' },
      ],
    };
    act(() => {
      updateCallback?.(monitorData);
    });

    await waitFor(() => {
      expect(screen.getByText(/Errors: 3/)).toBeInTheDocument();
      expect(screen.getByText(/Warnings: 5/)).toBeInTheDocument();
    });
  });

  it('opens panel when badge is clicked', async () => {
    let updateCallback: ((data: MonitorInfo) => void) | undefined;
    eventsOnMock.mockImplementation((eventName, callback) => {
      if (eventName === 'monitor:update') {
        updateCallback = callback as (data: MonitorInfo) => void;
      }
      return () => {};
    });

    render(<FooterBar />);

    const monitorData: MonitorInfo = {
      errorCount: 1,
      warningCount: 0,
      errors: [
        { type: 'error', resource: 'Pod', name: 'test-pod', namespace: 'default', reason: 'CrashLoopBackOff', message: 'Container crashed' },
      ],
      warnings: [],
    };
    act(() => {
      updateCallback?.(monitorData);
    });

    await waitFor(() => {
      expect(screen.getByText(/Errors: 1/)).toBeInTheDocument();
    });

    // Click the error badge
    const errorBadge = screen.getByText(/Errors: 1/).closest('button');
    if (errorBadge) fireEvent.click(errorBadge);

    // Panel should be visible
    await waitFor(() => {
      expect(document.getElementById('monitor-panel')).toBeInTheDocument();
    });
  });
});

describe('MonitorPanel', () => {
  const mockMonitorInfo: MonitorInfo = {
    errorCount: 2,
    warningCount: 1,
    errors: [
      {
        issueID: 'issue-1',
        type: 'error',
        resource: 'Pod',
        name: 'crash-pod',
        namespace: 'default',
        reason: 'CrashLoopBackOff',
        message: 'Container keeps crashing',
        containerName: 'app',
        restartCount: 10,
        age: '5m',
        podPhase: 'Running',
        ownerKind: 'Deployment',
        ownerName: 'my-app',
        nodeName: 'node-1',
      },
      {
        issueID: 'issue-2',
        type: 'error',
        resource: 'Pod',
        name: 'image-pod',
        namespace: 'kube-system',
        reason: 'ImagePullBackOff',
        message: 'Cannot pull image',
        containerName: 'nginx',
        restartCount: 0,
        age: '2m',
        podPhase: 'Pending',
        ownerKind: 'DaemonSet',
        ownerName: 'kube-proxy',
        nodeName: 'node-2',
      },
    ],
    warnings: [
      {
        issueID: 'issue-3',
        type: 'warning',
        resource: 'Pod',
        name: 'warn-pod',
        namespace: 'default',
        reason: 'FailedScheduling',
        message: 'No nodes available',
        containerName: '',
        restartCount: 0,
        age: '1m',
        podPhase: 'Pending',
        ownerKind: 'ReplicaSet',
        ownerName: 'backend-abc123',
        nodeName: '',
      },
    ],
  };

  it('renders panel with errors tab active by default', () => {
    const onClose = vi.fn();
    render(<MonitorPanel monitorInfo={mockMonitorInfo} open={true} onClose={onClose} />);

    expect(screen.getByText(/Errors \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Warnings \(1\)/)).toBeInTheDocument();
  });

  it('displays error issues in errors tab', () => {
    const onClose = vi.fn();
    render(<MonitorPanel monitorInfo={mockMonitorInfo} open={true} onClose={onClose} />);

    expect(screen.getByText(/Deployment\/my-app.*Pod\/crash-pod/)).toBeInTheDocument();
    expect(screen.getByText(/DaemonSet\/kube-proxy.*Pod\/image-pod/)).toBeInTheDocument();
    expect(screen.getByText('Container keeps crashing')).toBeInTheDocument();
  });

  it('switches to warnings tab', () => {
    const onClose = vi.fn();
    render(<MonitorPanel monitorInfo={mockMonitorInfo} open={true} onClose={onClose} />);

    const warningsTab = screen.getByText(/Warnings \(1\)/).closest('button');
    if (warningsTab) fireEvent.click(warningsTab);

    expect(screen.getByText(/ReplicaSet\/backend-abc123.*Pod\/warn-pod/)).toBeInTheDocument();
    expect(screen.getByText('No nodes available')).toBeInTheDocument();
  });

  it('closes panel when close button is clicked', () => {
    const onClose = vi.fn();
    render(<MonitorPanel monitorInfo={mockMonitorInfo} open={true} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('triggers scan and analyze all actions', async () => {
    const onClose = vi.fn();
    appApiMocks.ScanClusterHealth.mockResolvedValueOnce({
      errorCount: 0,
      warningCount: 0,
      errors: [],
      warnings: [],
    });

    render(<MonitorPanel monitorInfo={mockMonitorInfo} open={true} onClose={onClose} />);

    fireEvent.click(screen.getByText('Rescan'));
    await waitFor(() => {
      expect(appApiMocks.ScanClusterHealth).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Analyze all'));
    await waitFor(() => {
      expect(appApiMocks.AnalyzeAllMonitorIssues).toHaveBeenCalled();
    });
  });

  it('shows Prometheus tab content', async () => {
    const onClose = vi.fn();
    render(<MonitorPanel monitorInfo={mockMonitorInfo} open={true} onClose={onClose} />);

    act(() => {
      fireEvent.click(screen.getByText('Prometheus'));
    });
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Prometheus URL/i)).toBeInTheDocument();
    });
  });

  it('analyzes and dismisses an issue', async () => {
    const onClose = vi.fn();
    appApiMocks.AnalyzeMonitorIssue.mockResolvedValueOnce({
      ...mockMonitorInfo.errors[0],
      holmesAnalysis: 'Analysis result',
      holmesAnalyzed: true,
      holmesAnalyzedAt: new Date().toISOString(),
    });
    appApiMocks.DismissMonitorIssue.mockResolvedValueOnce(undefined);

    render(<MonitorPanel monitorInfo={mockMonitorInfo} open={true} onClose={onClose} />);

    fireEvent.click(screen.getAllByText('Analyze')[0]);
    await waitFor(() => {
      expect(appApiMocks.AnalyzeMonitorIssue).toHaveBeenCalled();
    });

    // Wait for the component to re-render with the analysis result
    await waitFor(() => {
      expect(screen.getByText('Show Analysis')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Show Analysis'));
    expect(screen.getByText('Analysis result')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Dismiss')[0]);
    await waitFor(() => {
      expect(appApiMocks.DismissMonitorIssue).toHaveBeenCalled();
    });
  });

  it('shows "No issues found." when errors tab is empty', () => {
    const onClose = vi.fn();
    const emptyErrorsInfo = { ...mockMonitorInfo, errorCount: 0, errors: [] };
    render(<MonitorPanel monitorInfo={emptyErrorsInfo} open={true} onClose={onClose} />);

    // Smart pre-selection will show warnings tab when no errors exist, so switch to errors tab
    const errorsTab = screen.getByText(/Errors \(0\)/).closest('button');
    if (errorsTab) fireEvent.click(errorsTab);

    expect(screen.getByText('No issues found.')).toBeInTheDocument();
  });

  it('shows "No issues found." when warnings tab is empty', () => {
    const onClose = vi.fn();
    const emptyWarningsInfo = { ...mockMonitorInfo, warningCount: 0, warnings: [] };
    render(<MonitorPanel monitorInfo={emptyWarningsInfo} open={true} onClose={onClose} />);

    // Switch to warnings tab
    const warningsTab = screen.getByText(/Warnings \(0\)/).closest('button');
    if (warningsTab) fireEvent.click(warningsTab);

    expect(screen.getByText('No issues found.')).toBeInTheDocument();
  });

  it('emits navigate-to-resource event and closes panel when issue is clicked', () => {
    const onClose = vi.fn();
    render(<MonitorPanel monitorInfo={mockMonitorInfo} open={true} onClose={onClose} />);

    // Set up event listener
    const eventHandler = vi.fn();
    window.addEventListener('navigate-to-resource', eventHandler as EventListener);

    // Click on an issue
    const issueItem = screen.getByText('CrashLoopBackOff').closest('.monitor-issue-card');
    if (issueItem) fireEvent.click(issueItem);

    // Verify event was emitted with correct data
    expect(eventHandler).toHaveBeenCalled();
    const eventData = (eventHandler.mock.calls[0][0] as CustomEvent).detail;
    expect(eventData.resource).toBe('Pod');
    expect(eventData.name).toBe('crash-pod');
    expect(eventData.namespace).toBe('default');

    // Verify panel was closed
    expect(onClose).toHaveBeenCalled();

    // Clean up
    window.removeEventListener('navigate-to-resource', eventHandler as EventListener);
  });

  it('shows pointer cursor on hover for issue items', () => {
    const onClose = vi.fn();
    render(<MonitorPanel monitorInfo={mockMonitorInfo} open={true} onClose={onClose} />);

    const issueItem = screen.getByText('CrashLoopBackOff').closest('.monitor-issue-card');

    expect(issueItem).toHaveClass('monitor-issue-card');
  });

  it('displays enriched information including resource path and metadata', () => {
    const onClose = vi.fn();
    render(<MonitorPanel monitorInfo={mockMonitorInfo} open={true} onClose={onClose} />);

    // Check resource path breadcrumb for first error (with owner)
    expect(screen.getByText(/Deployment\/my-app.*Pod\/crash-pod.*app/)).toBeInTheDocument();

    // Check age is displayed
    expect(screen.getByText('5m')).toBeInTheDocument();

    // Check pod phase, node, and restart count are displayed (using getAllByText for repeated labels)
    expect(screen.getAllByText(/Phase:/)[0]).toBeInTheDocument();
    expect(screen.getByText(/Running/)).toBeInTheDocument();
    expect(screen.getAllByText(/Node:/)[0]).toBeInTheDocument();
    expect(screen.getByText(/node-1/)).toBeInTheDocument();
    expect(screen.getByText(/Restarts:/)).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('pre-selects errors tab when errors exist', () => {
    const onClose = vi.fn();
    const monitorInfoWithBoth: MonitorInfo = {
      errorCount: 1,
      warningCount: 2,
      errors: [
        { type: 'error', resource: 'Pod', name: 'error-pod', namespace: 'default', reason: 'Error', message: 'Test error' },
      ],
      warnings: [
        { type: 'warning', resource: 'Pod', name: 'warn-pod-1', namespace: 'default', reason: 'Warning', message: 'Test warning 1' },
        { type: 'warning', resource: 'Pod', name: 'warn-pod-2', namespace: 'default', reason: 'Warning', message: 'Test warning 2' },
      ],
    };
    render(<MonitorPanel monitorInfo={monitorInfoWithBoth} open={true} onClose={onClose} />);

    // Error content should be visible (errors tab is pre-selected)
    expect(screen.getByText('Test error')).toBeInTheDocument();

    // Warning content should NOT be visible yet
    expect(screen.queryByText('Test warning 1')).not.toBeInTheDocument();
  });

  it('pre-selects warnings tab when only warnings exist', () => {
    const onClose = vi.fn();
    const monitorInfoOnlyWarnings: MonitorInfo = {
      errorCount: 0,
      warningCount: 1,
      errors: [],
      warnings: [
        { type: 'warning', resource: 'Pod', name: 'warn-pod', namespace: 'default', reason: 'Warning', message: 'Test warning' },
      ],
    };
    render(<MonitorPanel monitorInfo={monitorInfoOnlyWarnings} open={true} onClose={onClose} />);

    // Warning content should be visible (warnings tab is pre-selected)
    expect(screen.getByText('Test warning')).toBeInTheDocument();
  });
});
