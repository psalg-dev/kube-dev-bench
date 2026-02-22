import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn(() => () => {}),
  EventsOff: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeCronJobStream: vi.fn(),
}));

vi.mock('../k8s/resources/cronjobs/CronJobHistoryTab', () => ({
  default: ({ cronJobName }: { cronJobName: string }) => (
    <div data-testid="cronjob-history-tab">History:{cronJobName}</div>
  ),
}));

vi.mock('../k8s/resources/cronjobs/CronJobActionsTab', () => ({
  default: ({ cronJobName }: { cronJobName: string }) => (
    <div data-testid="cronjob-actions-tab">Actions:{cronJobName}</div>
  ),
}));

vi.mock('../k8s/resources/cronjobs/CronJobNextRunsTab', () => ({
  default: ({ cronJobName }: { cronJobName: string }) => (
    <div data-testid="cronjob-nextruns-tab">NextRuns:{cronJobName}</div>
  ),
}));

vi.mock('../k8s/resources/cronjobs/CronJobYamlTab', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="cronjob-yaml-tab">YAML:{name}</div>
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

import { renderCronJobPanelContent, normalizeCronJob } from '../config/resourceConfigs/cronjobConfig';
import type { ResourceRow } from '../types/resourceConfigs';

const makeRow = (overrides: Partial<ResourceRow> = {}): ResourceRow => ({
  name: 'test-cj',
  namespace: 'default',
  schedule: '*/5 * * * *',
  suspend: false,
  nextRun: '2026-02-20T00:00:00Z',
  age: '3d',
  image: 'batch:v1',
  labels: { app: 'test-cj' },
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

describe('cronjobConfig – renderCronJobPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('summary tab renders header with cron job name', () => {
    const result = renderCronJobPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByText(/Header:test-cj/)).toBeInTheDocument();
  });

  it('summary tab renders events section', () => {
    const result = renderCronJobPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('summary tab renders with empty namespace', () => {
    const result = renderCronJobPanelContent(makeRow({ namespace: '' }), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
  });

  it('summary tab renders with annotations', () => {
    const result = renderCronJobPanelContent(
      makeRow({ labels: { 'app.kubernetes.io/name': 'cj', version: '1' } }),
      'summary',
      defaultHolmesState,
      onAnalyze,
      onCancel
    );
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
  });

  it('history tab renders CronJobHistoryTab', () => {
    const result = renderCronJobPanelContent(makeRow(), 'history', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('cronjob-history-tab')).toBeInTheDocument();
    expect(screen.getByText(/History:test-cj/)).toBeInTheDocument();
  });

  it('nextruns tab renders CronJobNextRunsTab', () => {
    const result = renderCronJobPanelContent(makeRow(), 'nextruns', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('cronjob-nextruns-tab')).toBeInTheDocument();
    expect(screen.getByText(/NextRuns:test-cj/)).toBeInTheDocument();
  });

  it('actions tab renders CronJobActionsTab', () => {
    const result = renderCronJobPanelContent(makeRow(), 'actions', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('cronjob-actions-tab')).toBeInTheDocument();
    expect(screen.getByText(/Actions:test-cj/)).toBeInTheDocument();
  });

  it('events tab renders ResourceEventsTab', () => {
    const result = renderCronJobPanelContent(makeRow(), 'events', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
    expect(screen.getByText(/Events:test-cj/)).toBeInTheDocument();
  });

  it('yaml tab renders CronJobYamlTab', () => {
    const result = renderCronJobPanelContent(makeRow(), 'yaml', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('cronjob-yaml-tab')).toBeInTheDocument();
    expect(screen.getByText(/YAML:test-cj/)).toBeInTheDocument();
  });

  it('holmes tab renders HolmesBottomPanel with CronJob kind', () => {
    const result = renderCronJobPanelContent(makeRow(), 'holmes', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
    expect(screen.getByText(/Holmes:CronJob:test-cj/)).toBeInTheDocument();
  });

  it('holmes tab passes matching state', () => {
    const key = 'default/test-cj';
    const holmesState = { ...defaultHolmesState, key, loading: false, response: 'cron analysis' };
    const result = renderCronJobPanelContent(makeRow(), 'holmes', holmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
  });

  it('holmes tab passes null response for non-matching key', () => {
    const holmesState = { ...defaultHolmesState, key: 'other/other', response: 'should-not-appear' };
    const result = renderCronJobPanelContent(makeRow(), 'holmes', holmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
  });

  it('unknown tab returns null', () => {
    const result = renderCronJobPanelContent(makeRow(), 'nonexistent', defaultHolmesState, onAnalyze, onCancel);
    expect(result).toBeNull();
  });
});

describe('normalizeCronJob', () => {
  it('normalizes camelCase fields', () => {
    const row = normalizeCronJob({ name: 'cj1', namespace: 'prod', schedule: '0 * * * *', suspend: false, nextRun: 'soon', age: '5d', image: 'runner:v1' });
    expect(row.name).toBe('cj1');
    expect(row.schedule).toBe('0 * * * *');
    expect(row.image).toBe('runner:v1');
  });

  it('normalizes PascalCase fields', () => {
    const row = normalizeCronJob({ Name: 'cj2', Namespace: 'staging', Schedule: '*/10 * * * *', Suspend: true, NextRun: 'later', Age: '2d', Image: 'app:v2' });
    expect(row.name).toBe('cj2');
    expect(row.namespace).toBe('staging');
    expect(row.suspend).toBe(true);
  });

  it('applies fallback defaults', () => {
    const row = normalizeCronJob({ name: 'cj3', namespace: 'default' });
    expect(row.schedule).toBe('');
    expect(row.suspend).toBe(false);
    expect(row.nextRun).toBe('-');
    expect(row.age).toBe('-');
    expect(row.image).toBe('');
    expect(row.labels).toEqual({});
  });

  it('supports suspended cron jobs', () => {
    const row = normalizeCronJob({ name: 'cj4', namespace: 'ns', suspend: true });
    expect(row.suspend).toBe(true);
  });
});
