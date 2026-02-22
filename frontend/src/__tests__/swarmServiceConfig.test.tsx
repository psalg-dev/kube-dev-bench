import '../__tests__/wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  swarmServiceColumns,
  swarmServiceTabs,
  renderSwarmServicePanelContent,
  swarmServiceConfig,
} from '../config/resourceConfigs/swarm/serviceConfig';

vi.mock('../docker/swarmApi', () => ({
  GetSwarmServices: vi.fn(),
  GetSwarmServiceLogs: vi.fn(),
  GetSwarmTasksByService: vi.fn(),
  RemoveSwarmService: vi.fn(),
  RestartSwarmService: vi.fn(),
  ScaleSwarmService: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeSwarmServiceStream: vi.fn(),
  CancelHolmesStream: vi.fn(),
  onHolmesChatStream: vi.fn(() => vi.fn()),
  onHolmesContextProgress: vi.fn(() => vi.fn()),
}));

vi.mock('../docker/resources/services/ServiceSummaryPanel', () => ({
  default: ({ row }: { row: ResourceRow }) => (
    <div data-testid="service-summary-panel">{String(row.name ?? '')}</div>
  ),
}));

vi.mock('../docker/resources/services/ServiceTasksTab', () => ({
  default: ({ serviceId }: { serviceId: string }) => (
    <div data-testid="service-tasks-tab">{serviceId}</div>
  ),
}));

vi.mock('../docker/resources/services/ServicePlacementTab', () => ({
  default: () => <div data-testid="service-placement-tab" />,
}));

vi.mock('../components/AggregateLogsTab', () => ({
  default: () => <div data-testid="aggregate-logs-tab" />,
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: () => <div data-testid="holmes-bottom-panel" />,
}));

vi.mock('../docker/resources/services/ImageUpdateBadge', () => ({
  ImageUpdateBadge: ({ value }: { value: unknown }) => (
    <button type="button">{String(value ?? 'no-update')}</button>
  ),
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
  id: 'svc-1',
  name: 'my-service',
  image: 'nginx:latest',
  mode: 'replicated',
  replicas: 2,
  runningTasks: 2,
  ports: [],
  createdAt: '2024-01-01T00:00:00Z',
  labels: {},
};

describe('swarmServiceConfig – columns', () => {
  it('has the expected column keys', () => {
    const keys = swarmServiceColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('image');
    expect(keys).toContain('mode');
    expect(keys).toContain('replicas');
    expect(keys).toContain('ports');
    expect(keys).toContain('createdAt');
  });

  it('has labels on all columns', () => {
    for (const col of swarmServiceColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('swarmServiceConfig – tabs', () => {
  it('has the expected tab keys', () => {
    const keys = swarmServiceTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('tasks');
    expect(keys).toContain('placement');
    expect(keys).toContain('logs');
    expect(keys).toContain('holmes');
  });
});

describe('swarmServiceConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(swarmServiceConfig.resourceType).toBe('swarm-service');
    expect(swarmServiceConfig.resourceKind).toBe('Service');
  });
});

describe('renderSwarmServicePanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab without crashing', () => {
    const node = renderSwarmServicePanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('service-summary-panel')).toBeInTheDocument();
  });

  it('renders tasks tab without crashing', () => {
    const node = renderSwarmServicePanelContent(mockRow, 'tasks', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('service-tasks-tab')).toBeInTheDocument();
  });

  it('renders placement tab without crashing', () => {
    const node = renderSwarmServicePanelContent(mockRow, 'placement', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('service-placement-tab')).toBeInTheDocument();
  });

  it('renders logs tab without crashing', () => {
    const node = renderSwarmServicePanelContent(mockRow, 'logs', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('aggregate-logs-tab')).toBeInTheDocument();
  });

  it('renders holmes tab without crashing', () => {
    const node = renderSwarmServicePanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderSwarmServicePanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});
