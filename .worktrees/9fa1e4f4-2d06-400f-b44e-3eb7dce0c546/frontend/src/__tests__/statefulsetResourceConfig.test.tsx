import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn(() => () => {}),
  EventsOff: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeStatefulSetStream: vi.fn(),
}));

vi.mock('../components/ResourcePodsTab', () => ({
  default: ({ resourceName }: { resourceName: string }) => (
    <div data-testid="resource-pods-tab">Pods:{resourceName}</div>
  ),
}));

vi.mock('../k8s/resources/statefulsets/StatefulSetPVCsTab', () => ({
  default: ({ statefulSetName }: { statefulSetName: string }) => (
    <div data-testid="ss-pvcs-tab">PVCs:{statefulSetName}</div>
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

import { renderStatefulSetPanelContent, normalizeStatefulSet } from '../config/resourceConfigs/statefulsetConfig';
import type { ResourceRow } from '../types/resourceConfigs';

const makeRow = (overrides: Partial<ResourceRow> = {}): ResourceRow => ({
  name: 'test-ss',
  namespace: 'default',
  replicas: 3,
  ready: 2,
  age: '7d',
  image: 'nginx:1.21',
  labels: { app: 'test-ss' },
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

describe('statefulsetConfig – renderStatefulSetPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('summary tab renders header', () => {
    const result = renderStatefulSetPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByText(/Header:test-ss/)).toBeInTheDocument();
  });

  it('summary tab renders logs and events', () => {
    const result = renderStatefulSetPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('aggregate-logs-tab')).toBeInTheDocument();
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('pods tab renders ResourcePodsTab', () => {
    const result = renderStatefulSetPanelContent(makeRow(), 'pods', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('resource-pods-tab')).toBeInTheDocument();
    expect(screen.getByText(/Pods:test-ss/)).toBeInTheDocument();
  });

  it('pvcs tab renders StatefulSetPVCsTab', () => {
    const result = renderStatefulSetPanelContent(makeRow(), 'pvcs', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('ss-pvcs-tab')).toBeInTheDocument();
    expect(screen.getByText(/PVCs:test-ss/)).toBeInTheDocument();
  });

  it('logs tab renders AggregateLogsTab with StatefulSet title', () => {
    const result = renderStatefulSetPanelContent(makeRow(), 'logs', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('aggregate-logs-tab')).toBeInTheDocument();
    expect(screen.getByText(/StatefulSet Logs/)).toBeInTheDocument();
  });

  it('events tab renders ResourceEventsTab', () => {
    const result = renderStatefulSetPanelContent(makeRow(), 'events', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
    expect(screen.getByText(/Events:test-ss/)).toBeInTheDocument();
  });

  it('yaml tab renders YamlTab with content containing name', () => {
    const result = renderStatefulSetPanelContent(makeRow(), 'yaml', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('yaml-tab')).toBeInTheDocument();
  });

  it('holmes tab renders HolmesBottomPanel with correct kind', () => {
    const result = renderStatefulSetPanelContent(makeRow(), 'holmes', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
    expect(screen.getByText(/Holmes:StatefulSet:test-ss/)).toBeInTheDocument();
  });

  it('holmes tab passes matching state', () => {
    const key = 'default/test-ss';
    const holmesState = { ...defaultHolmesState, key, loading: false, response: 'analysis result' };
    const result = renderStatefulSetPanelContent(makeRow(), 'holmes', holmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
  });

  it('unknown tab returns null', () => {
    const result = renderStatefulSetPanelContent(makeRow(), 'unknown', defaultHolmesState, onAnalyze, onCancel);
    expect(result).toBeNull();
  });
});

describe('normalizeStatefulSet', () => {
  it('normalizes camelCase fields', () => {
    const row = normalizeStatefulSet({ name: 'ss1', namespace: 'prod', replicas: 5, ready: 4, age: '10d', image: 'redis:6' });
    expect(row.name).toBe('ss1');
    expect(row.replicas).toBe(5);
    expect(row.image).toBe('redis:6');
  });

  it('normalizes PascalCase fields', () => {
    const row = normalizeStatefulSet({ Name: 'ss2', Namespace: 'staging', Replicas: 2, Ready: 2, Age: '1d', Image: 'mongo:5' });
    expect(row.name).toBe('ss2');
    expect(row.namespace).toBe('staging');
    expect(row.ready).toBe(2);
  });

  it('applies fallback defaults', () => {
    const row = normalizeStatefulSet({ name: 'ss3', namespace: 'default' });
    expect(row.replicas).toBe(0);
    expect(row.ready).toBe(0);
    expect(row.age).toBe('-');
    expect(row.image).toBe('');
    expect(row.labels).toEqual({});
  });
});
