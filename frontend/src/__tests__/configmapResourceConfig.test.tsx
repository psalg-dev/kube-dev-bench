import './wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  configmapColumns,
  configmapTabs,
  renderConfigMapPanelContent,
  configmapConfig,
} from '../config/resourceConfigs/configmapConfig';

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeConfigMapStream: vi.fn(),
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

vi.mock('../k8s/resources/configmaps/ConfigMapDataTab', () => ({
  ConfigMapDataTab: () => <div data-testid="configmap-data-tab" />,
}));

vi.mock('../k8s/resources/configmaps/ConfigMapConsumersTab', () => ({
  ConfigMapConsumersTab: () => <div data-testid="configmap-consumers-tab" />,
}));

vi.mock('../k8s/resources/configmaps/ConfigMapYamlTab', () => ({
  ConfigMapYamlTab: () => <div data-testid="configmap-yaml-tab" />,
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
  name: 'my-configmap',
  namespace: 'default',
  keys: 5,
  size: '2048',
  age: '12d',
  labels: {},
};

describe('configmapConfig – columns', () => {
  it('contains expected column keys', () => {
    const keys = configmapColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('namespace');
    expect(keys).toContain('keys');
    expect(keys).toContain('size');
  });

  it('has a label on every column', () => {
    for (const col of configmapColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('configmapConfig – tabs', () => {
  it('contains expected tab keys', () => {
    const keys = configmapTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('data');
    expect(keys).toContain('consumers');
    expect(keys).toContain('events');
    expect(keys).toContain('yaml');
    expect(keys).toContain('holmes');
  });
});

describe('configmapConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(configmapConfig.resourceType).toBe('configmap');
    expect(configmapConfig.resourceKind).toBe('ConfigMap');
  });
});

describe('renderConfigMapPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick-info', () => {
    const node = renderConfigMapPanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByTestId('quick-info-section')).toBeInTheDocument();
  });

  it('renders data tab', () => {
    const node = renderConfigMapPanelContent(mockRow, 'data', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('configmap-data-tab')).toBeInTheDocument();
  });

  it('renders consumers tab', () => {
    const node = renderConfigMapPanelContent(mockRow, 'consumers', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('configmap-consumers-tab')).toBeInTheDocument();
  });

  it('renders events tab', () => {
    const node = renderConfigMapPanelContent(mockRow, 'events', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('renders yaml tab', () => {
    const node = renderConfigMapPanelContent(mockRow, 'yaml', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('configmap-yaml-tab')).toBeInTheDocument();
  });

  it('renders holmes tab', () => {
    const node = renderConfigMapPanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderConfigMapPanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});
