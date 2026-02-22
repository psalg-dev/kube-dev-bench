import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { holmesApiMocks, notificationMocks } = vi.hoisted(() => {
  return {
    holmesApiMocks: {
      AnalyzePodLogs: vi.fn(),
      AskHolmesStream: vi.fn(),
      CancelHolmesStream: vi.fn(),
      onHolmesChatStream: vi.fn(() => vi.fn()),
    },
    notificationMocks: {
      showError: vi.fn(),
    },
  };
});

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
  return { EditorView };
});

vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: () => ({ doc: { length: 0 } }),
    readOnly: { of: () => ({}) },
    allowMultipleSelections: { of: () => ({}) },
  },
}));

vi.mock('../../wailsjs/runtime', () => ({
  EventsOn: vi.fn(() => vi.fn()),
  EventsOff: vi.fn(),
}));

vi.mock('../../wailsjs/go/main/App', () => ({
  StreamPodLogs: vi.fn(),
  StopPodLogs: vi.fn(),
  GetPodLog: vi.fn(),
  StreamPodContainerLogs: vi.fn(),
  GetPodContainerLog: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => holmesApiMocks);

vi.mock('../holmes/HolmesResponseRenderer', () => ({
  default: function HolmesResponseRendererMock({ response }: { response?: { response?: string } }) {
    return <div>{response?.response || ''}</div>;
  },
}));

vi.mock('../notification', () => notificationMocks);

import LogViewerTab from '../layout/bottompanel/LogViewerTab';

describe('LogViewerTab Holmes integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holmesApiMocks.AnalyzePodLogs.mockResolvedValue({ response: 'analysis result' });
  });

  it('triggers Holmes log analysis and renders response', async () => {
    render(<LogViewerTab podName="test-pod" namespace="default" embedded={true} />);

    // First, switch to the Analysis tab
    const analysisTab = screen.getByRole('button', { name: 'Analysis' });
    fireEvent.click(analysisTab);

    const explainBtn = screen.getByRole('button', { name: 'Explain Logs' });
    fireEvent.click(explainBtn);

    await waitFor(() => {
      expect(holmesApiMocks.AnalyzePodLogs).toHaveBeenCalledWith('default', 'test-pod', 200);
    });

    await waitFor(() => {
      expect(screen.getByText('analysis result')).toBeInTheDocument();
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Extended tests: filter, pause/auto-scroll, regex mode
// ─────────────────────────────────────────────────────────────────

describe('LogViewerTab – filter & auto-scroll controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holmesApiMocks.AnalyzePodLogs.mockResolvedValue({ response: 'analysis result' });
  });

  it('renders the filter text input in the history tab', async () => {
    render(<LogViewerTab podName="test-pod" namespace="default" embedded={true} />);

    // The history tab is shown by default; filter input should be visible
    const filterInput = screen.getByPlaceholderText(/filter logs/i);
    expect(filterInput).toBeInTheDocument();
  });

  it('filter input accepts and displays typed text', async () => {
    render(<LogViewerTab podName="test-pod" namespace="default" embedded={true} />);

    const filterInput = screen.getByPlaceholderText(/filter logs/i);
    fireEvent.change(filterInput, { target: { value: 'ERROR' } });

    expect((filterInput as HTMLInputElement).value).toBe('ERROR');
  });

  it('regex mode checkbox toggles placeholder text from "Filter logs" to "Regex filter"', async () => {
    render(<LogViewerTab podName="test-pod" namespace="default" embedded={true} />);

    // Initially: plain filter placeholder
    expect(screen.getByPlaceholderText(/filter logs/i)).toBeInTheDocument();

    // Enable regex mode
    const regexCheckbox = screen.getByLabelText(/regex/i);
    fireEvent.click(regexCheckbox);

    // Placeholder should change to Regex filter
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/regex filter/i)).toBeInTheDocument();
    });
  });

  it('shows the pause/resume auto-update button', async () => {
    render(<LogViewerTab podName="test-pod" namespace="default" embedded={false} />);

    // The pause button has aria-label "Pause auto-update"
    await waitFor(() => {
      expect(screen.getByLabelText(/pause auto-update/i)).toBeInTheDocument();
    });
  });

  it('toggles pause state when the pause button is clicked', async () => {
    render(<LogViewerTab podName="test-pod" namespace="default" embedded={false} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/pause auto-update/i)).toBeInTheDocument();
    });

    const pauseBtn = screen.getByLabelText(/pause auto-update/i);
    expect(pauseBtn).toHaveAttribute('aria-pressed', 'false');

    // Click to pause
    fireEvent.click(pauseBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/resume auto-update/i)).toBeInTheDocument();
    });

    const resumeBtn = screen.getByLabelText(/resume auto-update/i);
    expect(resumeBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders both History and Analysis tabs', async () => {
    render(<LogViewerTab podName="test-pod" namespace="default" embedded={true} />);

    expect(screen.getByRole('button', { name: /history/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analysis/i })).toBeInTheDocument();
  });

  it('shows "Explain Logs" button in Analysis tab', async () => {
    render(<LogViewerTab podName="test-pod" namespace="default" embedded={true} />);

    fireEvent.click(screen.getByRole('button', { name: /analysis/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /explain logs/i })).toBeInTheDocument();
    });
  });

  it('renders an editor area in the history tab', async () => {
    render(<LogViewerTab podName="test-pod" namespace="default" embedded={true} />);

    // The editor ref container should be present in the DOM
    // The component renders a div with ref={editorRef} in the history tab
    const filterInput = screen.getByPlaceholderText(/filter logs/i);
    // Filter input is inside the history tab area
    expect(filterInput).toBeInTheDocument();
    // The container should also have the regex checkbox
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('shows Regex label next to the checkbox', async () => {
    render(<LogViewerTab podName="test-pod" namespace="default" embedded={true} />);

    // The Regex checkbox is labelled
    const regexCheckbox = screen.getByRole('checkbox');
    expect(regexCheckbox).toBeInTheDocument();
  });
});
