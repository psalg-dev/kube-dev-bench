import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn(() => () => {}),
  EventsOff: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeIngressStream: vi.fn(),
}));

vi.mock('../k8s/resources/ingresses/IngressRulesTab', () => ({
  default: ({ ingressName }: { ingressName: string }) => (
    <div data-testid="ingress-rules-tab">Rules:{ingressName}</div>
  ),
}));

vi.mock('../k8s/resources/ingresses/IngressTLSTab', () => ({
  default: ({ ingressName }: { ingressName: string }) => (
    <div data-testid="ingress-tls-tab">TLS:{ingressName}</div>
  ),
}));

vi.mock('../k8s/resources/ingresses/IngressBackendServicesTab', () => ({
  default: ({ ingressName }: { ingressName: string }) => (
    <div data-testid="ingress-services-tab">Services:{ingressName}</div>
  ),
}));

vi.mock('../k8s/resources/ingresses/IngressYamlTab', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="ingress-yaml-tab">YAML:{name}</div>
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

vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
}));

import { renderIngressPanelContent, normalizeIngress } from '../config/resourceConfigs/ingressConfig';
import type { ResourceRow } from '../types/resourceConfigs';

const makeRow = (overrides: Partial<ResourceRow> = {}): ResourceRow => ({
  name: 'test-ingress',
  namespace: 'default',
  class: 'nginx',
  hosts: ['example.com', 'api.example.com'],
  address: '192.168.1.1',
  ports: '80, 443',
  age: '3d',
  tls: [],
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

describe('ingressConfig – renderIngressPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('summary tab renders header with name', () => {
    const result = renderIngressPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByText(/Header:test-ingress/)).toBeInTheDocument();
  });

  it('summary tab renders events', () => {
    const result = renderIngressPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('summary tab shows Test Endpoint button enabled when hosts exist', () => {
    const result = renderIngressPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    const btn = screen.getByRole('button', { name: /Test Endpoint/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('summary tab shows Test Endpoint button disabled when no hosts', () => {
    const result = renderIngressPanelContent(makeRow({ hosts: [] }), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    const btn = screen.getByRole('button', { name: /Test Endpoint/i });
    expect(btn).toBeDisabled();
  });

  it('Test Endpoint click calls showSuccess for http host', () => {
    const { showSuccess } = await import('../notification');
    const result = renderIngressPanelContent(makeRow({ tls: [] }), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    fireEvent.click(screen.getByRole('button', { name: /Test Endpoint/i }));
    expect(showSuccess).toHaveBeenCalledWith(expect.stringContaining('http://example.com'));
  });

  it('rules tab renders IngressRulesTab', () => {
    const result = renderIngressPanelContent(makeRow(), 'rules', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('ingress-rules-tab')).toBeInTheDocument();
    expect(screen.getByText(/Rules:test-ingress/)).toBeInTheDocument();
  });

  it('tls tab renders IngressTLSTab', () => {
    const result = renderIngressPanelContent(makeRow(), 'tls', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('ingress-tls-tab')).toBeInTheDocument();
  });

  it('services tab renders IngressBackendServicesTab', () => {
    const result = renderIngressPanelContent(makeRow(), 'services', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('ingress-services-tab')).toBeInTheDocument();
  });

  it('events tab renders ResourceEventsTab', () => {
    const result = renderIngressPanelContent(makeRow(), 'events', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('yaml tab renders IngressYamlTab', () => {
    const result = renderIngressPanelContent(makeRow(), 'yaml', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('ingress-yaml-tab')).toBeInTheDocument();
    expect(screen.getByText(/YAML:test-ingress/)).toBeInTheDocument();
  });

  it('holmes tab renders HolmesBottomPanel', () => {
    const result = renderIngressPanelContent(makeRow(), 'holmes', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
    expect(screen.getByText(/Holmes:Ingress:test-ingress/)).toBeInTheDocument();
  });

  it('holmes tab passes matching holmesState', () => {
    const key = 'default/test-ingress';
    const holmesState = { ...defaultHolmesState, key, loading: true };
    const result = renderIngressPanelContent(makeRow(), 'holmes', holmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
  });

  it('unknown tab returns null', () => {
    const result = renderIngressPanelContent(makeRow(), 'nonexistent', defaultHolmesState, onAnalyze, onCancel);
    expect(result).toBeNull();
  });
});

describe('normalizeIngress', () => {
  it('normalizes camelCase fields', () => {
    const row = normalizeIngress({ name: 'ing1', namespace: 'prod', class: 'nginx', hosts: ['a.com'], address: '1.2.3.4', ports: '80', age: '1d' });
    expect(row.name).toBe('ing1');
    expect(row.namespace).toBe('prod');
    expect(row.hosts).toEqual(['a.com']);
  });

  it('normalizes PascalCase fields', () => {
    const row = normalizeIngress({ Name: 'ing2', Namespace: 'staging', Class: 'traefik', Hosts: ['b.com'], Address: '10.0.0.1', Ports: '443', Age: '2d' });
    expect(row.name).toBe('ing2');
    expect(row.class).toBe('traefik');
  });

  it('applies fallback defaults', () => {
    const row = normalizeIngress({ name: 'ing3', namespace: 'default' });
    expect(row.class).toBe('-');
    expect(row.hosts).toEqual([]);
    expect(row.address).toBe('-');
    expect(row.tls).toEqual([]);
    expect(row.labels).toEqual({});
  });
});
