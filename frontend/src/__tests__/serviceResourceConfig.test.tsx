import './wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  serviceColumns,
  serviceTabs,
  renderServicePanelContent,
  serviceConfig,
} from '../config/resourceConfigs/serviceConfig';

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeServiceStream: vi.fn(),
  CancelHolmesStream: vi.fn(),
  onHolmesChatStream: vi.fn(() => vi.fn()),
  onHolmesContextProgress: vi.fn(() => vi.fn()),
}));

vi.mock('../layout/bottompanel/SummaryTabHeader', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="summary-tab-header">{name}</div>
  ),
}));

vi.mock('../QuickInfoSection', () => ({
  default: () => <div data-testid="quick-info-section" />,
}));

vi.mock('../components/ResourceActions', () => ({
  default: () => <div data-testid="resource-actions" />,
}));

vi.mock('../components/ResourceEventsTab', () => ({
  default: () => <div data-testid="resource-events-tab" />,
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: () => <div data-testid="holmes-bottom-panel" />,
}));

vi.mock('../k8s/resources/services/ServiceEndpointsTab', () => ({
  default: () => <div data-testid="service-endpoints-tab" />,
}));

vi.mock('../k8s/resources/services/ServiceYamlTab', () => ({
  default: () => <div data-testid="service-yaml-tab" />,
}));

const mockHolmesState: HolmesAnalysisState = {
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

const mockRow: ResourceRow = {
  name: 'my-service',
  namespace: 'default',
  type: 'ClusterIP',
  clusterIP: '10.96.0.1',
  ports: '80/TCP',
  age: '20d',
  labels: {},
};

describe('serviceConfig – columns', () => {
  it('contains expected column keys', () => {
    const keys = serviceColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('namespace');
    expect(keys).toContain('type');
    expect(keys).toContain('clusterIP');
    expect(keys).toContain('ports');
  });

  it('has a label on every column', () => {
    for (const col of serviceColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('serviceConfig – tabs', () => {
  it('contains expected tab keys', () => {
    const keys = serviceTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('endpoints');
    expect(keys).toContain('events');
    expect(keys).toContain('yaml');
    expect(keys).toContain('holmes');
  });
});

describe('serviceConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(serviceConfig.resourceType).toBe('service');
    expect(serviceConfig.resourceKind).toBe('Service');
  });
});

describe('renderServicePanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick-info', () => {
    const node = renderServicePanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByTestId('quick-info-section')).toBeInTheDocument();
  });

  it('renders endpoints tab', () => {
    const node = renderServicePanelContent(mockRow, 'endpoints', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('service-endpoints-tab')).toBeInTheDocument();
  });

  it('renders events tab', () => {
    const node = renderServicePanelContent(mockRow, 'events', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('renders yaml tab', () => {
    const node = renderServicePanelContent(mockRow, 'yaml', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('service-yaml-tab')).toBeInTheDocument();
  });

  it('renders holmes tab', () => {
    const node = renderServicePanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderServicePanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});
