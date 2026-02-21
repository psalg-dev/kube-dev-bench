import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn(() => () => {}),
  EventsOff: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzePodStream: vi.fn(),
}));

vi.mock('../k8s/resources/pods/PodSummaryTab', () => ({
  default: ({ podName }: { podName: string }) => (
    <div data-testid="pod-summary-tab">PodSummary:{podName}</div>
  ),
}));

vi.mock('../layout/bottompanel/LogViewerTab', () => ({
  default: ({ podName }: { podName: string }) => (
    <div data-testid="log-viewer-tab">Logs:{podName}</div>
  ),
}));

vi.mock('../k8s/resources/pods/PodEventsTab', () => ({
  default: ({ podName }: { podName: string }) => (
    <div data-testid="pod-events-tab">Events:{podName}</div>
  ),
}));

vi.mock('../k8s/resources/pods/PodYamlTab', () => ({
  default: ({ podName }: { podName: string }) => (
    <div data-testid="pod-yaml-tab">YAML:{podName}</div>
  ),
}));

vi.mock('../layout/bottompanel/ConsoleTab', () => ({
  default: ({ podName }: { podName: string }) => (
    <div data-testid="console-tab">Console:{podName}</div>
  ),
}));

vi.mock('../k8s/resources/pods/PortForwardOutput', () => ({
  default: ({ podName }: { podName: string }) => (
    <div data-testid="portforward-output">PortForward:{podName}</div>
  ),
}));

vi.mock('../k8s/resources/pods/PodFilesTab', () => ({
  default: ({ podName }: { podName: string }) => (
    <div data-testid="pod-files-tab">Files:{podName}</div>
  ),
}));

vi.mock('../k8s/resources/pods/PodMountsTab', () => ({
  default: ({ podName }: { podName: string }) => (
    <div data-testid="pod-mounts-tab">Mounts:{podName}</div>
  ),
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: ({ kind, name }: { kind: string; name: string }) => (
    <div data-testid="holmes-panel">Holmes:{kind}:{name}</div>
  ),
}));

vi.mock('../components/StatusBadge', () => ({
  default: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

import { renderPodPanelContent, normalizePod } from '../config/resourceConfigs/podConfig';
import type { ResourceRow } from '../types/resourceConfigs';

const makeRow = (overrides: Partial<ResourceRow> = {}): ResourceRow => ({
  name: 'test-pod',
  namespace: 'default',
  status: 'Running',
  restarts: 0,
  ports: [8080, 443],
  startTime: null,
  ...overrides,
});

const defaultHolmesState = {
  key: '',
  loading: false,
  response: null,
  error: null,
  streamId: null,
  queryTimestamp: null,
  streamingText: '',
  reasoningText: '',
  toolEvents: [],
  contextSteps: [],
};

const onAnalyze = vi.fn();
const onCancel = vi.fn();

describe('podConfig – renderPodPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('summary tab renders PodSummaryTab', () => {
    const result = renderPodPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('pod-summary-tab')).toBeInTheDocument();
    expect(screen.getByText(/PodSummary:test-pod/)).toBeInTheDocument();
  });

  it('logs tab renders LogViewerTab', () => {
    const result = renderPodPanelContent(makeRow(), 'logs', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('log-viewer-tab')).toBeInTheDocument();
    expect(screen.getByText(/Logs:test-pod/)).toBeInTheDocument();
  });

  it('events tab renders PodEventsTab', () => {
    const result = renderPodPanelContent(makeRow(), 'events', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('pod-events-tab')).toBeInTheDocument();
    expect(screen.getByText(/Events:test-pod/)).toBeInTheDocument();
  });

  it('yaml tab renders PodYamlTab', () => {
    const result = renderPodPanelContent(makeRow(), 'yaml', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('pod-yaml-tab')).toBeInTheDocument();
    expect(screen.getByText(/YAML:test-pod/)).toBeInTheDocument();
  });

  it('console tab renders ConsoleTab', () => {
    const result = renderPodPanelContent(makeRow(), 'console', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('console-tab')).toBeInTheDocument();
  });

  it('portforward tab shows placeholder when no ports configured', () => {
    const result = renderPodPanelContent(makeRow(), 'portforward', defaultHolmesState, onAnalyze, onCancel, undefined, undefined, undefined);
    render(result as React.ReactElement);
    expect(screen.getByText(/Select local and remote ports/i)).toBeInTheDocument();
  });

  it('portforward tab renders PortForwardOutput when ports are provided', () => {
    const result = renderPodPanelContent(
      makeRow(),
      'portforward',
      defaultHolmesState,
      onAnalyze,
      onCancel,
      undefined,
      undefined,
      { forwardLocalPort: 8080, forwardRemotePort: 8080 }
    );
    render(result as React.ReactElement);
    expect(screen.getByTestId('portforward-output')).toBeInTheDocument();
    expect(screen.getByText(/PortForward:test-pod/)).toBeInTheDocument();
  });

  it('files tab renders PodFilesTab', () => {
    const result = renderPodPanelContent(makeRow(), 'files', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('pod-files-tab')).toBeInTheDocument();
    expect(screen.getByText(/Files:test-pod/)).toBeInTheDocument();
  });

  it('mounts tab renders PodMountsTab', () => {
    const result = renderPodPanelContent(makeRow(), 'mounts', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('pod-mounts-tab')).toBeInTheDocument();
    expect(screen.getByText(/Mounts:test-pod/)).toBeInTheDocument();
  });

  it('holmes tab renders HolmesBottomPanel with Pod kind', () => {
    const result = renderPodPanelContent(makeRow(), 'holmes', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
    expect(screen.getByText(/Holmes:Pod:test-pod/)).toBeInTheDocument();
  });

  it('holmes tab with matching key forwards holmesState', () => {
    const key = 'default/test-pod';
    const holmesState = { ...defaultHolmesState, key, loading: true };
    const result = renderPodPanelContent(makeRow(), 'holmes', holmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
  });

  it('unknown tab returns null', () => {
    const result = renderPodPanelContent(makeRow(), 'unknown', defaultHolmesState, onAnalyze, onCancel);
    expect(result).toBeNull();
  });
});

describe('normalizePod', () => {
  it('normalizes camelCase fields', () => {
    const row = normalizePod({ name: 'pod1', namespace: 'prod', restarts: 2, status: 'Running', ports: [80], startTime: '2024-01-01T00:00:00Z' });
    expect(row.name).toBe('pod1');
    expect(row.namespace).toBe('prod');
    expect(row.restarts).toBe(2);
    expect(row.status).toBe('Running');
  });

  it('normalizes PascalCase fields', () => {
    const row = normalizePod({ Name: 'pod2', Namespace: 'staging', Restarts: 0, Status: 'Pending', Ports: [443] });
    expect(row.name).toBe('pod2');
    expect(row.namespace).toBe('staging');
    expect(row.status).toBe('Pending');
  });

  it('applies fallback defaults', () => {
    const row = normalizePod({ name: 'pod3' });
    expect(row.restarts).toBe(0);
    expect(row.status).toBe('-');
    expect(row.ports).toEqual([]);
    expect(row.startTime).toBeNull();
  });

  it('uses fallbackNamespace when namespace is absent', () => {
    const row = normalizePod({ name: 'pod4' }, 'fallback-ns');
    expect(row.namespace).toBe('fallback-ns');
  });

  it('handles null input gracefully', () => {
    const row = normalizePod(null, 'ns');
    expect(row.namespace).toBe('ns');
    expect(row.restarts).toBe(0);
  });
});
