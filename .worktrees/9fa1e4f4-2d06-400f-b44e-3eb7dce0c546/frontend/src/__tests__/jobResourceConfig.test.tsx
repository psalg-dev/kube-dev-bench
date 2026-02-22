import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn(() => () => {}),
  EventsOff: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeJobStream: vi.fn(),
}));

vi.mock('../k8s/resources/jobs/JobPodsTab', () => ({
  default: ({ jobName }: { jobName: string }) => (
    <div data-testid="job-pods-tab">Pods:{jobName}</div>
  ),
}));

vi.mock('../k8s/resources/jobs/JobYamlTab', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="job-yaml-tab">YAML:{name}</div>
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

import { renderJobPanelContent, normalizeJob } from '../config/resourceConfigs/jobConfig';
import type { ResourceRow } from '../types/resourceConfigs';

const makeRow = (overrides: Partial<ResourceRow> = {}): ResourceRow => ({
  name: 'test-job',
  namespace: 'default',
  completions: 1,
  succeeded: 1,
  active: 0,
  failed: 0,
  age: '1h',
  duration: '5m',
  image: 'batch-worker:v1',
  labels: {},
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

describe('jobConfig – renderJobPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('summary tab renders header', () => {
    const result = renderJobPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByText(/Header:test-job/)).toBeInTheDocument();
  });

  it('summary tab renders logs and events', () => {
    const result = renderJobPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('aggregate-logs-tab')).toBeInTheDocument();
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('summary tab with failed job renders correctly', () => {
    const result = renderJobPanelContent(makeRow({ failed: 3, succeeded: 0, active: 0 }), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
  });

  it('pods tab renders JobPodsTab', () => {
    const result = renderJobPanelContent(makeRow(), 'pods', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('job-pods-tab')).toBeInTheDocument();
    expect(screen.getByText(/Pods:test-job/)).toBeInTheDocument();
  });

  it('logs tab renders AggregateLogsTab with Job title', () => {
    const result = renderJobPanelContent(makeRow(), 'logs', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('aggregate-logs-tab')).toBeInTheDocument();
    expect(screen.getByText(/Job Logs/)).toBeInTheDocument();
  });

  it('events tab renders ResourceEventsTab', () => {
    const result = renderJobPanelContent(makeRow(), 'events', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
    expect(screen.getByText(/Events:test-job/)).toBeInTheDocument();
  });

  it('yaml tab renders JobYamlTab', () => {
    const result = renderJobPanelContent(makeRow(), 'yaml', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('job-yaml-tab')).toBeInTheDocument();
    expect(screen.getByText(/YAML:test-job/)).toBeInTheDocument();
  });

  it('holmes tab renders HolmesBottomPanel with Job kind', () => {
    const result = renderJobPanelContent(makeRow(), 'holmes', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
    expect(screen.getByText(/Holmes:Job:test-job/)).toBeInTheDocument();
  });

  it('holmes tab with matching key forwards state', () => {
    const key = 'default/test-job';
    const holmesState = { ...defaultHolmesState, key, loading: false, response: 'job analysis' };
    const result = renderJobPanelContent(makeRow(), 'holmes', holmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
  });

  it('unknown tab returns null', () => {
    const result = renderJobPanelContent(makeRow(), 'unknown', defaultHolmesState, onAnalyze, onCancel);
    expect(result).toBeNull();
  });
});

describe('normalizeJob', () => {
  it('normalizes camelCase fields', () => {
    const row = normalizeJob({ name: 'j1', namespace: 'prod', completions: 3, succeeded: 3, active: 0, failed: 0, age: '1d', duration: '10m', image: 'task:v1' });
    expect(row.name).toBe('j1');
    expect(row.completions).toBe(3);
    expect(row.duration).toBe('10m');
  });

  it('normalizes PascalCase fields', () => {
    const row = normalizeJob({ Name: 'j2', Namespace: 'batch', Completions: 1, Succeeded: 1, Active: 0, Failed: 0, Age: '2h', Duration: '30s', Image: 'runner:latest' });
    expect(row.name).toBe('j2');
    expect(row.namespace).toBe('batch');
    expect(row.succeeded).toBe(1);
  });

  it('applies fallback defaults', () => {
    const row = normalizeJob({ name: 'j3', namespace: 'default' });
    expect(row.completions).toBe(0);
    expect(row.succeeded).toBe(0);
    expect(row.active).toBe(0);
    expect(row.failed).toBe(0);
    expect(row.age).toBe('-');
    expect(row.duration).toBe('-');
    expect(row.image).toBe('');
    expect(row.labels).toEqual({});
  });
});
