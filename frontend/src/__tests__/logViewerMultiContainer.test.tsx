import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { holmesApiMocks } = vi.hoisted(() => ({
  holmesApiMocks: {
    AnalyzePodLogs: vi.fn(),
    AskHolmesStream: vi.fn(),
    CancelHolmesStream: vi.fn(),
    onHolmesChatStream: vi.fn(() => vi.fn()),
  },
}));

const { appMocks } = vi.hoisted(() => ({
  appMocks: {
    StreamPodLogs: vi.fn(),
    StopPodLogs: vi.fn(),
    GetPodLog: vi.fn(),
    StreamPodContainerLogs: vi.fn(),
    GetPodContainerLog: vi.fn(),
    GetPodContainers: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@codemirror/view', () => {
  class EditorView {
    static theme = () => ({});
    static lineWrapping = {};
    static editable = { of: () => ({}) };
    state = { doc: { length: 0 } };
    dispatch = vi.fn();
    destroy = vi.fn();
    dom = document.createElement('div');
  }
  const Decoration = {
    mark: () => ({}),
  };
  const ViewPlugin = {
    fromClass: () => ({}),
  };
  return { EditorView, Decoration, ViewPlugin };
});

vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: () => ({ doc: { length: 0 } }),
    readOnly: { of: () => ({}) },
    allowMultipleSelections: { of: () => ({}) },
  },
  RangeSetBuilder: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    finish: vi.fn().mockReturnValue({}),
  })),
}));

vi.mock('../../wailsjs/runtime', () => ({
  EventsOn: vi.fn(() => vi.fn()),
  EventsOff: vi.fn(),
}));

vi.mock('../../wailsjs/go/main/App', () => appMocks);

vi.mock('../holmes/holmesApi', () => holmesApiMocks);

vi.mock('../holmes/HolmesResponseRenderer', () => ({
  default: function HolmesResponseRendererMock({ response }: { response?: { response?: string } }) {
    return <div>{response?.response || ''}</div>;
  },
}));

vi.mock('../notification', () => ({
  showError: vi.fn(),
}));

import LogViewerTab from '../layout/bottompanel/LogViewerTab';

describe('LogViewerTab – multi-container support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appMocks.GetPodContainers.mockResolvedValue([]);
    holmesApiMocks.onHolmesChatStream.mockReturnValue(vi.fn());
  });

  it('does not show container selector for single-container pod', async () => {
    appMocks.GetPodContainers.mockResolvedValue(['app']);

    render(<LogViewerTab podName="single-pod" namespace="default" embedded={true} />);

    // Wait for GetPodContainers to resolve
    await waitFor(() => {
      expect(appMocks.GetPodContainers).toHaveBeenCalledWith('single-pod');
    });

    // Container selector should NOT be displayed for single container
    expect(screen.queryByLabelText('Container filter')).not.toBeInTheDocument();
  });

  it('shows container selector for multi-container pod', async () => {
    appMocks.GetPodContainers.mockResolvedValue(['app', 'sidecar']);

    render(<LogViewerTab podName="multi-pod" namespace="default" embedded={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Container filter')).toBeInTheDocument();
    });

    const select = screen.getByLabelText('Container filter') as HTMLSelectElement;
    expect(select.value).toBe(''); // "All containers" is default

    // Verify options
    const options = Array.from(select.options);
    expect(options).toHaveLength(3); // "All containers" + 2 containers
    expect(options[0].textContent).toBe('All containers');
    expect(options[1].textContent).toBe('app');
    expect(options[2].textContent).toBe('sidecar');
  });

  it('streams all containers by default for multi-container pod', async () => {
    appMocks.GetPodContainers.mockResolvedValue(['app', 'sidecar']);

    render(<LogViewerTab podName="multi-pod" namespace="default" embedded={true} />);

    await waitFor(() => {
      expect(appMocks.StreamPodLogs).toHaveBeenCalledWith('multi-pod');
    });

    // Should NOT use StreamPodContainerLogs when streaming all
    expect(appMocks.StreamPodContainerLogs).not.toHaveBeenCalled();
  });

  it('switches to specific container when selected', async () => {
    appMocks.GetPodContainers.mockResolvedValue(['app', 'sidecar']);

    render(<LogViewerTab podName="multi-pod" namespace="default" embedded={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Container filter')).toBeInTheDocument();
    });

    // Select a specific container
    fireEvent.change(screen.getByLabelText('Container filter'), { target: { value: 'sidecar' } });

    await waitFor(() => {
      expect(appMocks.StreamPodContainerLogs).toHaveBeenCalledWith('multi-pod', 'sidecar');
    });
  });

  it('switches back to all containers when "All containers" is selected', async () => {
    appMocks.GetPodContainers.mockResolvedValue(['app', 'sidecar']);

    render(<LogViewerTab podName="multi-pod" namespace="default" embedded={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Container filter')).toBeInTheDocument();
    });

    // Select specific container first
    fireEvent.change(screen.getByLabelText('Container filter'), { target: { value: 'sidecar' } });

    await waitFor(() => {
      expect(appMocks.StreamPodContainerLogs).toHaveBeenCalledWith('multi-pod', 'sidecar');
    });

    // Switch back to all containers
    vi.clearAllMocks();
    appMocks.GetPodContainers.mockResolvedValue(['app', 'sidecar']);
    fireEvent.change(screen.getByLabelText('Container filter'), { target: { value: '' } });

    await waitFor(() => {
      expect(appMocks.StreamPodLogs).toHaveBeenCalledWith('multi-pod');
    });
  });

  it('resets container selection when pod changes', async () => {
    appMocks.GetPodContainers.mockResolvedValue(['app', 'sidecar']);

    const { rerender } = render(
      <LogViewerTab podName="pod-1" namespace="default" embedded={true} />
    );

    await waitFor(() => {
      expect(appMocks.GetPodContainers).toHaveBeenCalledWith('pod-1');
    });

    // Rerender with a different pod
    appMocks.GetPodContainers.mockResolvedValue(['main']);
    rerender(<LogViewerTab podName="pod-2" namespace="default" embedded={true} />);

    await waitFor(() => {
      expect(appMocks.GetPodContainers).toHaveBeenCalledWith('pod-2');
    });

    // Single container pod should not show selector
    await waitFor(() => {
      expect(screen.queryByLabelText('Container filter')).not.toBeInTheDocument();
    });
  });

  it('shows container info in header for non-embedded multi-container pod', async () => {
    appMocks.GetPodContainers.mockResolvedValue(['app', 'sidecar']);

    render(<LogViewerTab podName="multi-pod" namespace="default" embedded={false} />);

    await waitFor(() => {
      expect(screen.getByText(/multi-pod.*all containers/i)).toBeInTheDocument();
    });
  });

  it('handles GetPodContainers failure gracefully', async () => {
    appMocks.GetPodContainers.mockRejectedValue(new Error('network error'));

    render(<LogViewerTab podName="error-pod" namespace="default" embedded={true} />);

    // Should still render the log viewer without errors
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/filter logs/i)).toBeInTheDocument();
    });

    // Should not show container selector
    expect(screen.queryByLabelText('Container filter')).not.toBeInTheDocument();
  });

  it('does not fetch containers when no podName', async () => {
    render(<LogViewerTab namespace="default" embedded={true} />);

    // GetPodContainers should not be called
    expect(appMocks.GetPodContainers).not.toHaveBeenCalled();
  });
});
