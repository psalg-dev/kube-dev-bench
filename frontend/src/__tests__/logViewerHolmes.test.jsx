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

vi.mock('../components/CodeMirrorEditor', () => ({
  default: ({ value }) => (
    <textarea data-testid="code-mirror-editor" value={value} readOnly />
  ),
  EditorLoading: () => null,
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

vi.mock('../holmes/HolmesResponseRenderer.jsx', () => ({
  default: function HolmesResponseRendererMock({ response }) {
    return <div>{response?.response || ''}</div>;
  },
}));

vi.mock('../notification.js', () => notificationMocks);

import LogViewerTab from '../layout/bottompanel/LogViewerTab.jsx';

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
