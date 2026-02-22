import './wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  statefulsetColumns,
  statefulsetTabs,
  renderStatefulSetPanelContent,
  statefulsetConfig,
} from '../config/resourceConfigs/statefulsetConfig';

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeStatefulSetStream: vi.fn(),
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

vi.mock('../components/ResourcePodsTab', () => ({
  default: () => <div data-testid="resource-pods-tab" />,
}));

vi.mock('../k8s/resources/statefulsets/StatefulSetPVCsTab', () => ({
  default: () => <div data-testid="statefulset-pvcs-tab" />,
}));

vi.mock('../components/AggregateLogsTab', () => ({
  default: () => <div data-testid="aggregate-logs-tab" />,
}));

vi.mock('../layout/bottompanel/YamlTab', () => ({
  default: () => <div data-testid="yaml-tab" />,
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
  name: 'my-statefulset',
  namespace: 'default',
  replicas: 3,
  ready: 3,
  age: '5d',
  image: 'nginx:latest',
  labels: {},
};

describe('statefulsetConfig – columns', () => {
  it('contains expected column keys', () => {
    const keys = statefulsetColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('namespace');
    expect(keys).toContain('replicas');
  });

  it('has a label on every column', () => {
    for (const col of statefulsetColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('statefulsetConfig – tabs', () => {
  it('contains expected tab keys', () => {
    const keys = statefulsetTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('pods');
    expect(keys).toContain('pvcs');
    expect(keys).toContain('logs');
    expect(keys).toContain('events');
    expect(keys).toContain('yaml');
    expect(keys).toContain('holmes');
  });
});

describe('statefulsetConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(statefulsetConfig.resourceType).toBe('statefulset');
    expect(statefulsetConfig.resourceKind).toBe('StatefulSet');
  });
});

describe('renderStatefulSetPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick-info', () => {
    const node = renderStatefulSetPanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByTestId('quick-info-section')).toBeInTheDocument();
  });

  it('renders pods tab', () => {
    const node = renderStatefulSetPanelContent(mockRow, 'pods', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('resource-pods-tab')).toBeInTheDocument();
  });

  it('renders pvcs tab', () => {
    const node = renderStatefulSetPanelContent(mockRow, 'pvcs', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('statefulset-pvcs-tab')).toBeInTheDocument();
  });

  it('renders logs tab', () => {
    const node = renderStatefulSetPanelContent(mockRow, 'logs', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('aggregate-logs-tab')).toBeInTheDocument();
  });

  it('renders events tab', () => {
    const node = renderStatefulSetPanelContent(mockRow, 'events', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('renders yaml tab', () => {
    const node = renderStatefulSetPanelContent(mockRow, 'yaml', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('yaml-tab')).toBeInTheDocument();
  });

  it('renders holmes tab', () => {
    const node = renderStatefulSetPanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderStatefulSetPanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});
