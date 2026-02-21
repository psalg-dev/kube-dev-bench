import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetDaemonSets: vi.fn(),
  DeleteResource: vi.fn(),
  GetDaemonSetLogs: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeDaemonSetStream: vi.fn(),
  onHolmesChatStream: vi.fn(),
  onHolmesContextProgress: vi.fn(),
  CancelHolmesStream: vi.fn(),
}));

vi.mock('../components/ResourceEventsTab', () => ({
  default: ({ kind, name }: { kind: string; name: string }) => (
    <div data-testid="resource-events-tab">{kind}/{name}</div>
  ),
}));

vi.mock('../layout/bottompanel/SummaryTabHeader', () => ({
  default: ({ name, actions }: { name: string; actions?: import('react').ReactNode }) => <div data-testid="summary-tab-header">{name}{actions}</div>,
}));

vi.mock('../components/ResourceActions', () => ({
  default: ({ resourceType }: { resourceType: string }) => (
    <div data-testid="resource-actions">{resourceType}</div>
  ),
}));

vi.mock('../QuickInfoSection', () => ({
  default: ({ resourceName }: { resourceName: string }) => (
    <div data-testid="quick-info-section">{resourceName}</div>
  ),
}));

vi.mock('../components/ResourcePodsTab', () => ({
  default: ({ resourceName }: { resourceName: string }) => (
    <div data-testid="resource-pods-tab">{resourceName}</div>
  ),
}));

vi.mock('../k8s/resources/daemonsets/DaemonSetNodeCoverageTab', () => ({
  default: ({ daemonSetName }: { daemonSetName: string }) => (
    <div data-testid="daemonset-node-coverage-tab">{daemonSetName}</div>
  ),
}));

vi.mock('../components/AggregateLogsTab', () => ({
  default: ({ title }: { title: string }) => (
    <div data-testid="aggregate-logs-tab">{title}</div>
  ),
}));

vi.mock('../layout/bottompanel/YamlTab', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="yaml-tab">{content}</div>
  ),
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: ({ kind, name }: { kind: string; name: string }) => (
    <div data-testid="holmes-bottom-panel">{kind}/{name}</div>
  ),
}));

import { renderDaemonSetPanelContent } from '../config/resourceConfigs/daemonsetConfig';

const mockRow: ResourceRow = {
  name: 'test-daemonset',
  namespace: 'kube-system',
  desired: 3,
  current: 3,
  age: '7d',
  image: 'fluentd:latest',
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

describe('daemonsetConfig renderDaemonSetPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick info', () => {
    render(<>{renderDaemonSetPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('summary-tab-header')).toHaveTextContent('test-daemonset');
    expect(screen.getByTestId('quick-info-section')).toHaveTextContent('test-daemonset');
  });

  it('renders resource-actions for daemonset in summary tab', () => {
    render(<>{renderDaemonSetPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-actions')).toHaveTextContent('daemonset');
  });

  it('renders pods tab', () => {
    render(<>{renderDaemonSetPanelContent(mockRow, 'pods', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-pods-tab')).toHaveTextContent('test-daemonset');
  });

  it('renders coverage tab', () => {
    render(<>{renderDaemonSetPanelContent(mockRow, 'coverage', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('daemonset-node-coverage-tab')).toHaveTextContent('test-daemonset');
  });

  it('renders logs tab', () => {
    render(<>{renderDaemonSetPanelContent(mockRow, 'logs', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('aggregate-logs-tab')).toHaveTextContent('DaemonSet Logs');
  });

  it('renders events tab', () => {
    render(<>{renderDaemonSetPanelContent(mockRow, 'events', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-events-tab')).toHaveTextContent('DaemonSet/test-daemonset');
  });

  it('renders yaml tab with daemonset content', () => {
    render(<>{renderDaemonSetPanelContent(mockRow, 'yaml', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('yaml-tab')).toHaveTextContent('DaemonSet');
    expect(screen.getByTestId('yaml-tab')).toHaveTextContent('test-daemonset');
  });

  it('renders holmes tab', () => {
    render(<>{renderDaemonSetPanelContent(mockRow, 'holmes', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toHaveTextContent('DaemonSet/test-daemonset');
  });

  it('returns null for unknown tab', () => {
    const result = renderDaemonSetPanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn());
    expect(result).toBeNull();
  });
});
