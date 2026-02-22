import '../__tests__/wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  swarmNodeColumns,
  swarmNodeTabs,
  renderSwarmNodePanelContent,
  swarmNodeConfig,
} from '../config/resourceConfigs/swarm/nodeConfig';

vi.mock('../docker/swarmApi', () => ({
  GetSwarmNodes: vi.fn(),
  GetSwarmNodeTasks: vi.fn(),
  UpdateSwarmNodeAvailability: vi.fn(),
  UpdateSwarmNodeRole: vi.fn(),
  RemoveSwarmNode: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeSwarmNodeStream: vi.fn(),
  CancelHolmesStream: vi.fn(),
  onHolmesChatStream: vi.fn(() => vi.fn()),
  onHolmesContextProgress: vi.fn(() => vi.fn()),
}));

vi.mock('../docker/resources/nodes/NodeSummaryPanel', () => ({
  default: ({ row }: { row: ResourceRow }) => (
    <div data-testid="node-summary-panel">{String(row.hostname ?? '')}</div>
  ),
}));

vi.mock('../docker/resources/nodes/NodeTasksTab', () => ({
  default: ({ nodeId }: { nodeId: string }) => (
    <div data-testid="node-tasks-tab">{nodeId}</div>
  ),
}));

vi.mock('../docker/resources/nodes/NodeLabelsTab', () => ({
  default: () => <div data-testid="node-labels-tab" />,
}));

vi.mock('../docker/resources/nodes/NodeLogsTab', () => ({
  default: ({ nodeId }: { nodeId: string }) => (
    <div data-testid="node-logs-tab">{nodeId}</div>
  ),
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: () => <div data-testid="holmes-bottom-panel" />,
}));

vi.mock('../components/StatusBadge', () => ({
  default: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
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
  id: 'node-1',
  hostname: 'worker-1',
  role: 'worker',
  availability: 'active',
  state: 'ready',
  address: '10.0.0.1',
  engineVersion: '24.0.0',
  leader: false,
  labels: {},
};

describe('swarmNodeConfig – columns', () => {
  it('has the expected column keys', () => {
    const keys = swarmNodeColumns.map((c) => c.key);
    expect(keys).toContain('hostname');
    expect(keys).toContain('role');
    expect(keys).toContain('availability');
    expect(keys).toContain('state');
    expect(keys).toContain('address');
  });

  it('has labels on all columns', () => {
    for (const col of swarmNodeColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('swarmNodeConfig – tabs', () => {
  it('has the expected tab keys', () => {
    const keys = swarmNodeTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('tasks');
    expect(keys).toContain('logs');
    expect(keys).toContain('labels');
    expect(keys).toContain('holmes');
  });
});

describe('swarmNodeConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(swarmNodeConfig.resourceType).toBe('swarm-node');
    expect(swarmNodeConfig.resourceKind).toBe('Node');
  });
});

describe('renderSwarmNodePanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab without crashing', () => {
    const node = renderSwarmNodePanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn(), undefined);
    render(<>{node}</>);
    expect(screen.getByTestId('node-summary-panel')).toBeInTheDocument();
  });

  it('renders tasks tab without crashing', () => {
    const node = renderSwarmNodePanelContent(mockRow, 'tasks', mockHolmesState, vi.fn(), vi.fn(), undefined);
    render(<>{node}</>);
    expect(screen.getByTestId('node-tasks-tab')).toBeInTheDocument();
  });

  it('renders labels tab without crashing', () => {
    const node = renderSwarmNodePanelContent(mockRow, 'labels', mockHolmesState, vi.fn(), vi.fn(), undefined);
    render(<>{node}</>);
    expect(screen.getByTestId('node-labels-tab')).toBeInTheDocument();
  });

  it('renders logs tab without crashing', () => {
    const node = renderSwarmNodePanelContent(mockRow, 'logs', mockHolmesState, vi.fn(), vi.fn(), undefined);
    render(<>{node}</>);
    expect(screen.getByTestId('node-logs-tab')).toBeInTheDocument();
  });

  it('renders holmes tab without crashing', () => {
    const node = renderSwarmNodePanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn(), undefined);
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderSwarmNodePanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn(), undefined);
    expect(node).toBeNull();
  });
});
