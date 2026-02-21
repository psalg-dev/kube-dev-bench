import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn(() => () => {}),
  EventsOff: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeSecretStream: vi.fn(),
}));

vi.mock('../k8s/resources/secrets/SecretDataTab', () => ({
  default: ({ secretName }: { secretName: string }) => (
    <div data-testid="secret-data-tab">Data:{secretName}</div>
  ),
}));

vi.mock('../k8s/resources/secrets/SecretConsumersTab', () => ({
  default: ({ secretName }: { secretName: string }) => (
    <div data-testid="secret-consumers-tab">Consumers:{secretName}</div>
  ),
}));

vi.mock('../k8s/resources/secrets/SecretYamlTab', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="secret-yaml-tab">YAML:{name}</div>
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

import { renderSecretPanelContent, normalizeSecret } from '../config/resourceConfigs/secretConfig';
import type { ResourceRow } from '../types/resourceConfigs';

const makeRow = (overrides: Partial<ResourceRow> = {}): ResourceRow => ({
  name: 'test-secret',
  namespace: 'default',
  type: 'Opaque',
  keys: '3',
  size: '1.2 KiB',
  age: '10d',
  labels: { app: 'myapp' },
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

describe('secretConfig – renderSecretPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('summary tab renders header with secret name', () => {
    const result = renderSecretPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByText(/Header:test-secret/)).toBeInTheDocument();
  });

  it('summary tab renders SecretDataTab and events', () => {
    const result = renderSecretPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('secret-data-tab')).toBeInTheDocument();
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('summary tab renders with empty namespace', () => {
    const result = renderSecretPanelContent(makeRow({ namespace: '' }), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
  });

  it('summary tab renders with annotations in labels', () => {
    const result = renderSecretPanelContent(
      makeRow({ labels: { 'app.kubernetes.io/managed-by': 'helm' } }),
      'summary',
      defaultHolmesState,
      onAnalyze,
      onCancel
    );
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
  });

  it('data tab renders SecretDataTab', () => {
    const result = renderSecretPanelContent(makeRow(), 'data', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('secret-data-tab')).toBeInTheDocument();
    expect(screen.getByText(/Data:test-secret/)).toBeInTheDocument();
  });

  it('consumers tab renders SecretConsumersTab', () => {
    const result = renderSecretPanelContent(makeRow(), 'consumers', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('secret-consumers-tab')).toBeInTheDocument();
    expect(screen.getByText(/Consumers:test-secret/)).toBeInTheDocument();
  });

  it('events tab renders ResourceEventsTab', () => {
    const result = renderSecretPanelContent(makeRow(), 'events', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
    expect(screen.getByText(/Events:test-secret/)).toBeInTheDocument();
  });

  it('yaml tab renders SecretYamlTab', () => {
    const result = renderSecretPanelContent(makeRow(), 'yaml', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('secret-yaml-tab')).toBeInTheDocument();
    expect(screen.getByText(/YAML:test-secret/)).toBeInTheDocument();
  });

  it('holmes tab renders HolmesBottomPanel with Secret kind', () => {
    const result = renderSecretPanelContent(makeRow(), 'holmes', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
    expect(screen.getByText(/Holmes:Secret:test-secret/)).toBeInTheDocument();
  });

  it('holmes tab passes matching state when key matches', () => {
    const key = 'default/test-secret';
    const holmesState = { ...defaultHolmesState, key, loading: false, response: 'secret analysis' };
    const result = renderSecretPanelContent(makeRow(), 'holmes', holmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
  });

  it('holmes tab uses null response for non-matching key', () => {
    const holmesState = { ...defaultHolmesState, key: 'other/other', response: 'hidden' };
    const result = renderSecretPanelContent(makeRow(), 'holmes', holmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
  });

  it('unknown tab returns null', () => {
    const result = renderSecretPanelContent(makeRow(), 'nonexistent', defaultHolmesState, onAnalyze, onCancel);
    expect(result).toBeNull();
  });
});

describe('normalizeSecret', () => {
  it('normalizes camelCase fields', () => {
    const row = normalizeSecret({ name: 's1', namespace: 'prod', type: 'kubernetes.io/tls', keys: '2', size: '2 KiB', age: '5d' });
    expect(row.name).toBe('s1');
    expect(row.type).toBe('kubernetes.io/tls');
    expect(row.keys).toBe('2');
  });

  it('normalizes PascalCase fields', () => {
    const row = normalizeSecret({ Name: 's2', Namespace: 'staging', Type: 'Opaque', Keys: '4', Size: '1 KiB', Age: '7d' });
    expect(row.name).toBe('s2');
    expect(row.namespace).toBe('staging');
    expect(row.type).toBe('Opaque');
  });

  it('applies fallback defaults', () => {
    const row = normalizeSecret({ name: 's3', namespace: 'default' });
    expect(row.type).toBe('Opaque');
    expect(row.keys).toBe('-');
    expect(row.size).toBe('-');
    expect(row.age).toBe('-');
    expect(row.labels).toEqual({});
  });

  it('supports empty namespace', () => {
    const row = normalizeSecret({ name: 's4', namespace: '' });
    expect(row.namespace).toBe('');
  });
});
