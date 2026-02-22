import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn(() => () => {}),
  EventsOff: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeDaemonSetStream: vi.fn(),
}));

vi.mock('../components/ResourcePodsTab', () => ({
  default: ({ resourceName }: { resourceName: string }) => (
    <div data-testid="resource-pods-tab">Pods:{resourceName}</div>
  ),
}));

vi.mock('../k8s/resources/daemonsets/DaemonSetNodeCoverageTab', () => ({
  default: ({ daemonSetName }: { daemonSetName: string }) => (
    <div data-testid="ds-node-coverage-tab">NodeCoverage:{daemonSetName}</div>
  ),
}));

vi.mock('../components/AggregateLogsTab', () => ({
  default: ({ title }: { title: string }) => (
    <div data-testid="aggregate-logs-tab">LogsTab:{title}</div>
  ),
}));

vi.mock('../components/ResourceEventsTab', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="resource-events-tab">Events:{name}</div>
  ),
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: ({ kind, name }: { kind: string; name: string }) => (
    <div data-testid="holmes-panel">Holmes:{kind}:{name}</div>
  ),
}));

vi.mock('../layout/bottompanel/SummaryTabHeader', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="summary-tab-header">Header:{name}</div>
  ),
}));

vi.mock('../components/ResourceActions', () => ({
  default: ({ resourceType }: { resourceType: string }) => (
    <div data-testid="resource-actions">{resourceType}</div>
  ),
}));

vi.mock('../layout/bottompanel/YamlTab', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="yaml-tab">{content.substring(0, 30)}</div>
  ),
}));

import { renderDaemonSetPanelContent, normalizeDaemonSet } from '../config/resourceConfigs/daemonsetConfig';
import type { ResourceRow } from '../types/resourceConfigs';

const makeRow = (overrides: Partial<ResourceRow> = {}): ResourceRow => ({
  name: 'test-ds',
  namespace: 'kube-system',
  desired: 3,
  current: 3,
  age: '14d',
  image: 'calico/node:v3.20',
  labels: { app: 'calico' },
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

describe('daemonsetConfig – renderDaemonSetPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('summary tab renders header', () => {
    const result = renderDaemonSetPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByText(/Header:test-ds/)).toBeInTheDocument();
  });

  it('summary tab renders logs and events', () => {
    const result = renderDaemonSetPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('aggregate-logs-tab')).toBeInTheDocument();
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('pods tab renders ResourcePodsTab', () => {
    const result = renderDaemonSetPanelContent(makeRow(), 'pods', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('resource-pods-tab')).toBeInTheDocument();
    expect(screen.getByText(/Pods:test-ds/)).toBeInTheDocument();
  });

  it('coverage tab renders DaemonSetNodeCoverageTab', () => {
    const result = renderDaemonSetPanelContent(makeRow(), 'coverage', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('ds-node-coverage-tab')).toBeInTheDocument();
    expect(screen.getByText(/NodeCoverage:test-ds/)).toBeInTheDocument();
  });

  it('logs tab renders AggregateLogsTab with DaemonSet title', () => {
    const result = renderDaemonSetPanelContent(makeRow(), 'logs', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('aggregate-logs-tab')).toBeInTheDocument();
    expect(screen.getByText(/DaemonSet Logs/)).toBeInTheDocument();
  });

  it('events tab renders ResourceEventsTab', () => {
    const result = renderDaemonSetPanelContent(makeRow(), 'events', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
    expect(screen.getByText(/Events:test-ds/)).toBeInTheDocument();
  });

  it('yaml tab renders YamlTab', () => {
    const result = renderDaemonSetPanelContent(makeRow(), 'yaml', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('yaml-tab')).toBeInTheDocument();
  });

  it('holmes tab renders HolmesBottomPanel with DaemonSet kind', () => {
    const result = renderDaemonSetPanelContent(makeRow(), 'holmes', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
    expect(screen.getByText(/Holmes:DaemonSet:test-ds/)).toBeInTheDocument();
  });

  it('holmes tab with matching key passes holmesState data', () => {
    const key = 'kube-system/test-ds';
    const holmesState = { ...defaultHolmesState, key, loading: false, response: 'analysis' };
    const result = renderDaemonSetPanelContent(makeRow(), 'holmes', holmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
  });

  it('unknown tab returns null', () => {
    const result = renderDaemonSetPanelContent(makeRow(), 'unknown', defaultHolmesState, onAnalyze, onCancel);
    expect(result).toBeNull();
  });
});

describe('normalizeDaemonSet', () => {
  it('normalizes camelCase fields', () => {
    const row = normalizeDaemonSet({ name: 'ds1', namespace: 'kube-system', desired: 5, current: 4, age: '20d', image: 'fluentd:v1' });
    expect(row.name).toBe('ds1');
    expect(row.desired).toBe(5);
    expect(row.current).toBe(4);
  });

  it('normalizes PascalCase fields', () => {
    const row = normalizeDaemonSet({ Name: 'ds2', Namespace: 'monitoring', Desired: 3, Current: 3, Age: '5d', Image: 'node-exporter:v1' });
    expect(row.name).toBe('ds2');
    expect(row.namespace).toBe('monitoring');
  });

  it('applies fallback defaults', () => {
    const row = normalizeDaemonSet({ name: 'ds3', namespace: 'default' });
    expect(row.desired).toBe(0);
    expect(row.current).toBe(0);
    expect(row.age).toBe('-');
    expect(row.image).toBe('');
    expect(row.labels).toEqual({});
  });
});
