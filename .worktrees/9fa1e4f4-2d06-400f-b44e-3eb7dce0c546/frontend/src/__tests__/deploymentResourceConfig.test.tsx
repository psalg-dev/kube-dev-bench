import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn(() => () => {}),
  EventsOff: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeDeploymentStream: vi.fn(),
}));

vi.mock('../k8s/resources/deployments/DeploymentPodsTab', () => ({
  default: ({ deploymentName }: { deploymentName: string }) => (
    <div data-testid="deployment-pods-tab">Pods:{deploymentName}</div>
  ),
}));

vi.mock('../k8s/resources/deployments/DeploymentRolloutTab', () => ({
  default: ({ deploymentName }: { deploymentName: string }) => (
    <div data-testid="deployment-rollout-tab">Rollout:{deploymentName}</div>
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
    <div data-testid="yaml-tab">{content.substring(0, 40)}</div>
  ),
}));

import { renderDeploymentPanelContent, normalizeDeployment } from '../config/resourceConfigs/deploymentConfig';
import type { ResourceRow } from '../types/resourceConfigs';

const makeRow = (overrides: Partial<ResourceRow> = {}): ResourceRow => ({
  name: 'test-deploy',
  namespace: 'default',
  replicas: 3,
  ready: 3,
  available: 3,
  age: '2d',
  image: 'nginx:1.21',
  labels: { app: 'web' },
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

describe('deploymentConfig – renderDeploymentPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('summary tab renders header with deployment name', () => {
    const result = renderDeploymentPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByText(/Header:test-deploy/)).toBeInTheDocument();
  });

  it('summary tab renders logs and events side-by-side', () => {
    const result = renderDeploymentPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('aggregate-logs-tab')).toBeInTheDocument();
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('summary tab with empty namespace still renders', () => {
    const result = renderDeploymentPanelContent(makeRow({ namespace: '' }), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
  });

  it('summary tab with annotations in labels renders correctly', () => {
    const result = renderDeploymentPanelContent(
      makeRow({ labels: { 'app.kubernetes.io/name': 'web', 'version': '1.0' } }),
      'summary',
      defaultHolmesState,
      onAnalyze,
      onCancel
    );
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
  });

  it('pods tab renders DeploymentPodsTab', () => {
    const result = renderDeploymentPanelContent(makeRow(), 'pods', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('deployment-pods-tab')).toBeInTheDocument();
    expect(screen.getByText(/Pods:test-deploy/)).toBeInTheDocument();
  });

  it('rollout tab renders DeploymentRolloutTab', () => {
    const result = renderDeploymentPanelContent(makeRow(), 'rollout', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('deployment-rollout-tab')).toBeInTheDocument();
    expect(screen.getByText(/Rollout:test-deploy/)).toBeInTheDocument();
  });

  it('logs tab renders AggregateLogsTab with Deployment title', () => {
    const result = renderDeploymentPanelContent(makeRow(), 'logs', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('aggregate-logs-tab')).toBeInTheDocument();
    expect(screen.getByText(/Deployment Logs/)).toBeInTheDocument();
  });

  it('events tab renders ResourceEventsTab', () => {
    const result = renderDeploymentPanelContent(makeRow(), 'events', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
    expect(screen.getByText(/Events:test-deploy/)).toBeInTheDocument();
  });

  it('yaml tab renders YamlTab with deployment content', () => {
    const result = renderDeploymentPanelContent(makeRow(), 'yaml', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('yaml-tab')).toBeInTheDocument();
    expect(screen.getByText(/apiVersion: apps\/v1/)).toBeInTheDocument();
  });

  it('yaml tab with empty namespace renders correctly', () => {
    const result = renderDeploymentPanelContent(makeRow({ namespace: '' }), 'yaml', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('yaml-tab')).toBeInTheDocument();
  });

  it('holmes tab renders HolmesBottomPanel with Deployment kind', () => {
    const result = renderDeploymentPanelContent(makeRow(), 'holmes', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
    expect(screen.getByText(/Holmes:Deployment:test-deploy/)).toBeInTheDocument();
  });

  it('holmes tab passes response when key matches', () => {
    const key = 'default/test-deploy';
    const holmesState = { ...defaultHolmesState, key, response: 'analysis text', loading: false };
    const result = renderDeploymentPanelContent(makeRow(), 'holmes', holmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
  });

  it('holmes tab passes null response when key does not match', () => {
    const holmesState = { ...defaultHolmesState, key: 'other/other', response: 'should-not-appear' };
    const result = renderDeploymentPanelContent(makeRow(), 'holmes', holmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
  });

  it('unknown tab returns null', () => {
    const result = renderDeploymentPanelContent(makeRow(), 'nonexistent', defaultHolmesState, onAnalyze, onCancel);
    expect(result).toBeNull();
  });
});

describe('normalizeDeployment', () => {
  it('normalizes camelCase fields', () => {
    const row = normalizeDeployment({ name: 'd1', namespace: 'prod', replicas: 5, ready: 5, available: 5, age: '30d', image: 'app:v2' });
    expect(row.name).toBe('d1');
    expect(row.replicas).toBe(5);
    expect(row.image).toBe('app:v2');
  });

  it('normalizes PascalCase fields', () => {
    const row = normalizeDeployment({ Name: 'd2', Namespace: 'staging', Replicas: 2, Ready: 1, Available: 1, Age: '5d', Image: 'svc:v1' });
    expect(row.name).toBe('d2');
    expect(row.namespace).toBe('staging');
    expect(row.replicas).toBe(2);
  });

  it('applies fallback defaults', () => {
    const row = normalizeDeployment({ name: 'd3', namespace: 'default' });
    expect(row.replicas).toBe(0);
    expect(row.ready).toBe(0);
    expect(row.available).toBe(0);
    expect(row.age).toBe('-');
    expect(row.image).toBe('');
    expect(row.labels).toEqual({});
  });

  it('supports empty namespace', () => {
    const row = normalizeDeployment({ name: 'd4', namespace: '' });
    expect(row.namespace).toBe('');
  });
});
