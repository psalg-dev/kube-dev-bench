import './wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  hpaColumns,
  hpaTabs,
  renderHPAPanelContent,
  hpaConfig,
} from '../config/resourceConfigs/hpaConfig';

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeHPAStream: vi.fn(),
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

vi.mock('../components/ResourceEventsTab', () => ({
  default: () => <div data-testid="resource-events-tab" />,
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: () => <div data-testid="holmes-bottom-panel" />,
}));

vi.mock('../k8s/graph/ResourceGraphTab', () => ({
  ResourceGraphTab: () => <div data-testid="resource-graph-tab" />,
}));

vi.mock('../k8s/resources/hpa/HPATargetTab', () => ({
  default: () => <div data-testid="hpa-target-tab" />,
}));

vi.mock('../k8s/resources/hpa/HPAMetricsTab', () => ({
  default: () => <div data-testid="hpa-metrics-tab" />,
}));

vi.mock('../k8s/resources/hpa/HPAConditionsTab', () => ({
  default: () => <div data-testid="hpa-conditions-tab" />,
}));

vi.mock('../k8s/resources/hpa/HPAYamlTab', () => ({
  default: () => <div data-testid="hpa-yaml-tab" />,
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
  name: 'my-hpa',
  namespace: 'default',
  targetKind: 'Deployment',
  targetName: 'web',
  minReplicas: 1,
  maxReplicas: 10,
  currentReplicas: 3,
  desiredReplicas: 3,
  targetCPU: '80%',
  currentCPU: '42%',
  age: '5d',
};

describe('hpaConfig – columns', () => {
  it('contains expected column keys', () => {
    const keys = hpaColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('namespace');
    expect(keys).toContain('targetKind');
    expect(keys).toContain('minReplicas');
    expect(keys).toContain('maxReplicas');
  });

  it('has a label on every column', () => {
    for (const col of hpaColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('hpaConfig – tabs', () => {
  it('contains expected tab keys', () => {
    const keys = hpaTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('target');
    expect(keys).toContain('metrics');
    expect(keys).toContain('conditions');
    expect(keys).toContain('relationships');
    expect(keys).toContain('holmes');
  });
});

describe('hpaConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(hpaConfig.resourceType).toBe('horizontalpodautoscaler');
    expect(hpaConfig.resourceKind).toBe('HorizontalPodAutoscaler');
  });
});

describe('renderHPAPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick-info', () => {
    const node = renderHPAPanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByTestId('quick-info-section')).toBeInTheDocument();
  });

  it('renders target tab', () => {
    const node = renderHPAPanelContent(mockRow, 'target', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('hpa-target-tab')).toBeInTheDocument();
  });

  it('renders holmes tab', () => {
    const node = renderHPAPanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderHPAPanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});
