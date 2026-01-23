import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { holmesApiMocks, notificationMocks } = vi.hoisted(() => {
  return {
    holmesApiMocks: {
      AnalyzePodLogs: vi.fn(),
    },
    notificationMocks: {
      showError: vi.fn(),
    },
  };
});

vi.mock('@codemirror/view', () => {
  class EditorView {
    constructor() {
      this.state = { doc: { length: 0 } };
      this.dispatch = vi.fn();
      this.destroy = vi.fn();
    }
  }
  EditorView.theme = () => ({});
  EditorView.lineWrapping = {};
  EditorView.editable = { of: () => ({}) };
  return { EditorView };
});

vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: () => ({ doc: { length: 0 } }),
    readOnly: { of: () => ({}) },
    allowMultipleSelections: { of: () => ({}) },
  },
}));

vi.mock('../../../wailsjs/runtime', () => ({
  EventsOn: vi.fn(),
  EventsOff: vi.fn(),
}));

vi.mock('../../../wailsjs/go/main/App', () => ({
  StreamPodLogs: vi.fn(),
  StopPodLogs: vi.fn(),
  GetPodLog: vi.fn(),
  StreamPodContainerLogs: vi.fn(),
  GetPodContainerLog: vi.fn(),
}));

vi.mock('../../holmes/holmesApi', () => holmesApiMocks);

vi.mock('../../holmes/HolmesResponseRenderer.jsx', () => ({
  default: function HolmesResponseRendererMock({ response }) {
    return <div>{response?.response || ''}</div>;
  },
}));

vi.mock('../../notification.js', () => notificationMocks);

import LogViewerTab from '../layout/bottompanel/LogViewerTab.jsx';

describe('LogViewerTab Holmes integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holmesApiMocks.AnalyzePodLogs.mockResolvedValue({ response: 'analysis result' });
  });

  it('triggers Holmes log analysis and renders response', async () => {
    render(<LogViewerTab podName="test-pod" namespace="default" embedded={true} />);

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
