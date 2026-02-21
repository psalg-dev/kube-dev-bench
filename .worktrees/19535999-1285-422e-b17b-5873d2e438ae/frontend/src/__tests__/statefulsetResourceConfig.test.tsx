import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetStatefulSets: vi.fn(),
  DeleteResource: vi.fn(),
  RestartStatefulSet: vi.fn(),
  GetStatefulSetLogs: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeStatefulSetStream: vi.fn(),
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

vi.mock('../k8s/resources/statefulsets/StatefulSetPVCsTab', () => ({
  default: ({ statefulSetName }: { statefulSetName: string }) => (
    <div data-testid="statefulset-pvcs-tab">{statefulSetName}</div>
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

import { renderStatefulSetPanelContent } from '../config/resourceConfigs/statefulsetConfig';

const mockRow: ResourceRow = {
  name: 'test-statefulset',
  namespace: 'default',
  replicas: 3,
  ready: 3,
  age: '10d',
  image: 'nginx:latest',
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

describe('statefulsetConfig renderStatefulSetPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick info', () => {
    render(<>{renderStatefulSetPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('summary-tab-header')).toHaveTextContent('test-statefulset');
    expect(screen.getByTestId('quick-info-section')).toHaveTextContent('test-statefulset');
  });

  it('renders resource-actions for statefulset in summary tab', () => {
    render(<>{renderStatefulSetPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-actions')).toHaveTextContent('statefulset');
  });

  it('renders pods tab', () => {
    render(<>{renderStatefulSetPanelContent(mockRow, 'pods', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-pods-tab')).toHaveTextContent('test-statefulset');
  });

  it('renders pvcs tab', () => {
    render(<>{renderStatefulSetPanelContent(mockRow, 'pvcs', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('statefulset-pvcs-tab')).toHaveTextContent('test-statefulset');
  });

  it('renders logs tab', () => {
    render(<>{renderStatefulSetPanelContent(mockRow, 'logs', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('aggregate-logs-tab')).toHaveTextContent('StatefulSet Logs');
  });

  it('renders events tab', () => {
    render(<>{renderStatefulSetPanelContent(mockRow, 'events', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-events-tab')).toHaveTextContent('StatefulSet/test-statefulset');
  });

  it('renders yaml tab with statefulset content', () => {
    render(<>{renderStatefulSetPanelContent(mockRow, 'yaml', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('yaml-tab')).toHaveTextContent('StatefulSet');
    expect(screen.getByTestId('yaml-tab')).toHaveTextContent('test-statefulset');
  });

  it('renders holmes tab', () => {
    render(<>{renderStatefulSetPanelContent(mockRow, 'holmes', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toHaveTextContent('StatefulSet/test-statefulset');
  });

  it('returns null for unknown tab', () => {
    const result = renderStatefulSetPanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn());
    expect(result).toBeNull();
  });
});
