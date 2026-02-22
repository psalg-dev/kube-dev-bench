import './wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  replicasetColumns,
  replicasetTabs,
  renderReplicaSetPanelContent,
  replicasetConfig,
} from '../config/resourceConfigs/replicasetConfig';

vi.mock('../holmes/holmesApi', () => ({
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

vi.mock('../k8s/resources/replicasets/ReplicaSetOwnerTab', () => ({
  default: () => <div data-testid="replicaset-owner-tab" />,
}));

vi.mock('../k8s/graph/ResourceGraphTab', () => ({
  ResourceGraphTab: () => <div data-testid="resource-graph-tab" />,
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
  name: 'my-replicaset',
  namespace: 'default',
  desired: 3,
  current: 3,
  ready: 3,
  age: '8d',
  image: 'nginx:latest',
  labels: {},
  ownerName: 'my-deployment',
  ownerKind: 'Deployment',
};

describe('replicasetConfig – columns', () => {
  it('contains expected column keys', () => {
    const keys = replicasetColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('namespace');
    expect(keys).toContain('desired');
    expect(keys).toContain('ready');
  });

  it('has a label on every column', () => {
    for (const col of replicasetColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('replicasetConfig – tabs', () => {
  it('contains expected tab keys', () => {
    const keys = replicasetTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('pods');
    expect(keys).toContain('owner');
    expect(keys).toContain('events');
    expect(keys).toContain('yaml');
    expect(keys).toContain('relationships');
    expect(keys).toContain('holmes');
  });
});

describe('replicasetConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(replicasetConfig.resourceType).toBe('replicaset');
    expect(replicasetConfig.resourceKind).toBe('ReplicaSet');
  });
});

describe('renderReplicaSetPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick-info', () => {
    const node = renderReplicaSetPanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByTestId('quick-info-section')).toBeInTheDocument();
  });

  it('renders pods tab', () => {
    const node = renderReplicaSetPanelContent(mockRow, 'pods', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('resource-pods-tab')).toBeInTheDocument();
  });

  it('renders owner tab', () => {
    const node = renderReplicaSetPanelContent(mockRow, 'owner', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('replicaset-owner-tab')).toBeInTheDocument();
  });

  it('renders events tab', () => {
    const node = renderReplicaSetPanelContent(mockRow, 'events', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('renders yaml tab', () => {
    const node = renderReplicaSetPanelContent(mockRow, 'yaml', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('yaml-tab')).toBeInTheDocument();
  });

  it('renders relationships tab', () => {
    const node = renderReplicaSetPanelContent(mockRow, 'relationships', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('resource-graph-tab')).toBeInTheDocument();
  });

  it('renders holmes tab', () => {
    const node = renderReplicaSetPanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderReplicaSetPanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});
