import '../__tests__/wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  swarmTaskColumns,
  swarmTaskTabs,
  renderSwarmTaskPanelContent,
  swarmTaskConfig,
} from '../config/resourceConfigs/swarm/taskConfig';

vi.mock('../docker/swarmApi', () => ({
  GetSwarmTasks: vi.fn(),
  GetSwarmTaskLogs: vi.fn(),
  StartSwarmTaskExecSession: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeSwarmTaskStream: vi.fn(),
  CancelHolmesStream: vi.fn(),
  onHolmesChatStream: vi.fn(() => vi.fn()),
  onHolmesContextProgress: vi.fn(() => vi.fn()),
}));

vi.mock('../docker/resources/tasks/TaskSummaryPanel', () => ({
  default: ({ row }: { row: ResourceRow }) => (
    <div data-testid="task-summary-panel">{String(row.id ?? '')}</div>
  ),
}));

vi.mock('../docker/resources/tasks/HealthStatusBadge', () => ({
  default: ({ status }: { status: string | null }) => (
    <span data-testid="health-status-badge">{status ?? 'none'}</span>
  ),
}));

vi.mock('../components/AggregateLogsTab', () => ({
  default: () => <div data-testid="aggregate-logs-tab" />,
}));

vi.mock('../components/EmptyTabContent', () => ({
  default: ({ title }: { title: string }) => (
    <div data-testid="empty-tab-content">{title}</div>
  ),
}));

vi.mock('../layout/bottompanel/ConsoleTab', () => ({
  default: () => <div data-testid="console-tab" />,
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: () => <div data-testid="holmes-bottom-panel" />,
}));

vi.mock('../components/StatusBadge', () => ({
  default: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

vi.mock('../constants/emptyTabMessages', () => ({
  getEmptyTabMessage: (_key: string) => ({
    icon: '📋',
    title: 'No data',
    description: 'No data available',
    tip: undefined,
  }),
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
  id: 'task-abc123',
  serviceId: 'svc-1',
  serviceName: 'my-service',
  nodeId: 'node-1',
  nodeName: 'worker-1',
  slot: 1,
  state: 'running',
  desiredState: 'running',
  healthStatus: 'healthy',
  containerId: 'container-abc123',
  image: 'nginx:latest',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  error: null,
  networks: [],
  mounts: [],
};

describe('swarmTaskConfig – columns', () => {
  it('has the expected column keys', () => {
    const keys = swarmTaskColumns.map((c) => c.key);
    expect(keys).toContain('id');
    expect(keys).toContain('serviceName');
    expect(keys).toContain('nodeName');
    expect(keys).toContain('state');
    expect(keys).toContain('healthStatus');
  });

  it('has labels on all columns', () => {
    for (const col of swarmTaskColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('swarmTaskConfig – tabs', () => {
  it('has the expected tab keys', () => {
    const keys = swarmTaskTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('logs');
    expect(keys).toContain('exec');
    expect(keys).toContain('holmes');
  });
});

describe('swarmTaskConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(swarmTaskConfig.resourceType).toBe('swarm-task');
    expect(swarmTaskConfig.resourceKind).toBe('Task');
  });
});

describe('renderSwarmTaskPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab without crashing', () => {
    const node = renderSwarmTaskPanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('task-summary-panel')).toBeInTheDocument();
  });

  it('renders logs tab with container without crashing', () => {
    const node = renderSwarmTaskPanelContent(mockRow, 'logs', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('aggregate-logs-tab')).toBeInTheDocument();
  });

  it('renders logs tab empty state when no container', () => {
    const rowNoContainer: ResourceRow = { ...mockRow, containerId: undefined };
    const node = renderSwarmTaskPanelContent(rowNoContainer, 'logs', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('empty-tab-content')).toBeInTheDocument();
  });

  it('renders exec tab with running container without crashing', () => {
    const node = renderSwarmTaskPanelContent(mockRow, 'exec', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('console-tab')).toBeInTheDocument();
  });

  it('renders exec empty state when no container', () => {
    const rowNoContainer: ResourceRow = { ...mockRow, containerId: undefined };
    const node = renderSwarmTaskPanelContent(rowNoContainer, 'exec', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('empty-tab-content')).toBeInTheDocument();
  });

  it('renders holmes tab without crashing', () => {
    const node = renderSwarmTaskPanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderSwarmTaskPanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});
