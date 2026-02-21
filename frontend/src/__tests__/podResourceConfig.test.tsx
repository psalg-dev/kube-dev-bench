import './wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  podColumns,
  podTabs,
  renderPodPanelContent,
  podConfig,
} from '../config/resourceConfigs/podConfig';

vi.mock('../holmes/holmesApi', () => ({
  AnalyzePodStream: vi.fn(),
  CancelHolmesStream: vi.fn(),
  onHolmesChatStream: vi.fn(() => vi.fn()),
  onHolmesContextProgress: vi.fn(() => vi.fn()),
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: () => <div data-testid="holmes-bottom-panel" />,
}));

vi.mock('../k8s/resources/pods/PodSummaryTab', () => ({
  default: () => <div data-testid="pod-summary-tab" />,
}));

vi.mock('../layout/bottompanel/LogViewerTab', () => ({
  default: () => <div data-testid="log-viewer-tab" />,
}));

vi.mock('../k8s/resources/pods/PodEventsTab', () => ({
  default: () => <div data-testid="pod-events-tab" />,
}));

vi.mock('../k8s/resources/pods/PodYamlTab', () => ({
  default: () => <div data-testid="pod-yaml-tab" />,
}));

vi.mock('../layout/bottompanel/ConsoleTab', () => ({
  default: () => <div data-testid="console-tab" />,
}));

vi.mock('../k8s/resources/pods/PortForwardOutput', () => ({
  default: () => <div data-testid="portforward-output" />,
}));

vi.mock('../k8s/resources/pods/PodFilesTab', () => ({
  default: () => <div data-testid="pod-files-tab" />,
}));

vi.mock('../k8s/resources/pods/PodMountsTab', () => ({
  default: () => <div data-testid="pod-mounts-tab" />,
}));

vi.mock('../components/StatusBadge', () => ({
  default: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

const mockHolmesState: HolmesAnalysisState = {
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

const mockRow: ResourceRow = {
  name: 'my-pod',
  namespace: 'default',
  status: 'Running',
  restarts: 0,
  ports: [8080],
  startTime: '2024-01-01T00:00:00Z',
  labels: {},
};

describe('podConfig – columns', () => {
  it('contains expected column keys', () => {
    const keys = podColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('namespace');
    expect(keys).toContain('status');
    expect(keys).toContain('restarts');
  });

  it('has a label on every column', () => {
    for (const col of podColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('podConfig – tabs', () => {
  it('contains expected tab keys', () => {
    const keys = podTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('logs');
    expect(keys).toContain('events');
    expect(keys).toContain('yaml');
    expect(keys).toContain('console');
    expect(keys).toContain('portforward');
    expect(keys).toContain('files');
    expect(keys).toContain('mounts');
    expect(keys).toContain('holmes');
  });
});

describe('podConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(podConfig.resourceType).toBe('pod');
    expect(podConfig.resourceKind).toBe('Pod');
  });
});

describe('renderPodPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab', () => {
    const node = renderPodPanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('pod-summary-tab')).toBeInTheDocument();
  });

  it('renders logs tab', () => {
    const node = renderPodPanelContent(mockRow, 'logs', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('log-viewer-tab')).toBeInTheDocument();
  });

  it('renders events tab', () => {
    const node = renderPodPanelContent(mockRow, 'events', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('pod-events-tab')).toBeInTheDocument();
  });

  it('renders yaml tab', () => {
    const node = renderPodPanelContent(mockRow, 'yaml', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('pod-yaml-tab')).toBeInTheDocument();
  });

  it('renders console tab', () => {
    const node = renderPodPanelContent(mockRow, 'console', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('console-tab')).toBeInTheDocument();
  });

  it('renders portforward tab with fallback message when ports missing', () => {
    const node = renderPodPanelContent(mockRow, 'portforward', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByText(/Select local and remote ports/i)).toBeInTheDocument();
  });

  it('renders portforward tab with output when ports are provided', () => {
    const node = renderPodPanelContent(
      mockRow,
      'portforward',
      mockHolmesState,
      vi.fn(),
      vi.fn(),
      undefined,
      undefined,
      { forwardLocalPort: 8080, forwardRemotePort: 8080 },
    );
    render(<>{node}</>);
    expect(screen.getByTestId('portforward-output')).toBeInTheDocument();
  });

  it('renders files tab', () => {
    const node = renderPodPanelContent(mockRow, 'files', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('pod-files-tab')).toBeInTheDocument();
  });

  it('renders mounts tab', () => {
    const node = renderPodPanelContent(mockRow, 'mounts', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('pod-mounts-tab')).toBeInTheDocument();
  });

  it('renders holmes tab', () => {
    const node = renderPodPanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderPodPanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});
