import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetRunningPods: vi.fn(),
  DeletePod: vi.fn(),
  RestartPod: vi.fn(),
  GetPodLog: vi.fn(),
  GetPodContainers: vi.fn(),
  GetPodEvents: vi.fn(),
  GetPodSummary: vi.fn(),
  GetPodYAML: vi.fn(),
  GetPodMounts: vi.fn(),
  ListPortForwards: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzePodStream: vi.fn(),
  onHolmesChatStream: vi.fn(),
  onHolmesContextProgress: vi.fn(),
  CancelHolmesStream: vi.fn(),
}));

vi.mock('../k8s/resources/pods/PodSummaryTab', () => ({
  default: ({ podName }: { podName: string }) => (
    <div data-testid="pod-summary-tab">{podName}</div>
  ),
}));

vi.mock('../layout/bottompanel/LogViewerTab', () => ({
  default: ({ podName }: { podName: string }) => (
    <div data-testid="log-viewer-tab">{podName}</div>
  ),
}));

vi.mock('../k8s/resources/pods/PodEventsTab', () => ({
  default: ({ podName }: { podName: string }) => (
    <div data-testid="pod-events-tab">{podName}</div>
  ),
}));

vi.mock('../k8s/resources/pods/PodYamlTab', () => ({
  default: ({ podName }: { podName: string }) => (
    <div data-testid="pod-yaml-tab">{podName}</div>
  ),
}));

vi.mock('../layout/bottompanel/ConsoleTab', () => ({
  default: ({ podName }: { podName: string }) => (
    <div data-testid="console-tab">{podName}</div>
  ),
}));

vi.mock('../k8s/resources/pods/PortForwardOutput', () => ({
  default: ({ podName }: { podName: string }) => (
    <div data-testid="port-forward-output">{podName}</div>
  ),
}));

vi.mock('../k8s/resources/pods/PodFilesTab', () => ({
  default: ({ podName }: { podName: string }) => (
    <div data-testid="pod-files-tab">{podName}</div>
  ),
}));

vi.mock('../k8s/resources/pods/PodMountsTab', () => ({
  default: ({ podName }: { podName: string }) => (
    <div data-testid="pod-mounts-tab">{podName}</div>
  ),
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: ({ kind, name }: { kind: string; name: string }) => (
    <div data-testid="holmes-bottom-panel">{kind}/{name}</div>
  ),
}));

vi.mock('../components/StatusBadge', () => ({
  default: ({ status }: { status: string }) => <span>{status}</span>,
}));

import { renderPodPanelContent } from '../config/resourceConfigs/podConfig';

const mockRow: ResourceRow = {
  name: 'test-pod',
  namespace: 'default',
  status: 'Running',
  restarts: 0,
  startTime: '2d',
  ports: [8080],
  labels: {},
};

const holmesState: HolmesAnalysisState = {
  loading: false,
  response: null,
  error: null,
  key: null,
  streamId: null,
  streamingText: '',
  reasoningText: '',
  queryTimestamp: null,
  contextSteps: [],
  toolEvents: [],
};

describe('podConfig renderPodPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with pod summary component', () => {
    render(<>{renderPodPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('pod-summary-tab')).toHaveTextContent('test-pod');
  });

  it('renders logs tab with log viewer', () => {
    render(<>{renderPodPanelContent(mockRow, 'logs', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('log-viewer-tab')).toHaveTextContent('test-pod');
  });

  it('renders events tab', () => {
    render(<>{renderPodPanelContent(mockRow, 'events', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('pod-events-tab')).toHaveTextContent('test-pod');
  });

  it('renders yaml tab', () => {
    render(<>{renderPodPanelContent(mockRow, 'yaml', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('pod-yaml-tab')).toHaveTextContent('test-pod');
  });

  it('renders console tab', () => {
    render(<>{renderPodPanelContent(mockRow, 'console', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('console-tab')).toHaveTextContent('test-pod');
  });

  it('renders portforward tab with prompt when no ports selected', () => {
    render(<>{renderPodPanelContent(mockRow, 'portforward', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByText(/select local and remote ports/i)).toBeInTheDocument();
  });

  it('renders files tab', () => {
    render(<>{renderPodPanelContent(mockRow, 'files', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('pod-files-tab')).toHaveTextContent('test-pod');
  });

  it('renders mounts tab', () => {
    render(<>{renderPodPanelContent(mockRow, 'mounts', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('pod-mounts-tab')).toHaveTextContent('test-pod');
  });

  it('renders holmes tab', () => {
    render(<>{renderPodPanelContent(mockRow, 'holmes', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toHaveTextContent('Pod/test-pod');
  });

  it('returns null for unknown tab', () => {
    const result = renderPodPanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn());
    expect(result).toBeNull();
  });
});
