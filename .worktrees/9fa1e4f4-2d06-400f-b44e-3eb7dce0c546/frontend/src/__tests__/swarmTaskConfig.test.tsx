import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ResourceRow } from '../types/resourceConfigs';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import {
  swarmTaskColumns,
  swarmTaskTabs,
  swarmTaskConfig,
  renderSwarmTaskPanelContent,
} from '../config/resourceConfigs/swarm/taskConfig';

vi.mock('../docker/resources/tasks/TaskSummaryPanel', () => ({
  default: () => <div data-testid="task-summary-panel" />,
}));
vi.mock('../components/AggregateLogsTab', () => ({
  default: () => <div data-testid="aggregate-logs-tab" />,
}));
vi.mock('../components/EmptyTabContent', () => ({
  default: () => <div data-testid="empty-tab-content" />,
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
vi.mock('../docker/resources/tasks/HealthStatusBadge', () => ({
  default: () => <span data-testid="health-status-badge" />,
}));
vi.mock('../constants/emptyTabMessages', () => ({
  getEmptyTabMessage: () => ({
    icon: '📋',
    title: 'No content',
    description: 'Nothing to show',
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
  updatedAt: '2024-01-01T00:01:00Z',
  error: '',
  networks: [],
  mounts: [],
};

describe('swarmTaskConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('columns', () => {
    it('has the expected column keys', () => {
      const keys = swarmTaskColumns.map((c) => c.key);
      expect(keys).toContain('id');
      expect(keys).toContain('serviceName');
      expect(keys).toContain('nodeName');
      expect(keys).toContain('slot');
      expect(keys).toContain('state');
      expect(keys).toContain('desiredState');
      expect(keys).toContain('containerId');
    });

    it('has correct label for id column', () => {
      const col = swarmTaskColumns.find((c) => c.key === 'id');
      expect(col?.label).toBe('Task ID');
    });

    it('has correct label for serviceName column', () => {
      const col = swarmTaskColumns.find((c) => c.key === 'serviceName');
      expect(col?.label).toBe('Service');
    });
  });

  describe('tabs', () => {
    it('has the expected tab keys', () => {
      const keys = swarmTaskTabs.map((t) => t.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('logs');
      expect(keys).toContain('exec');
      expect(keys).toContain('holmes');
    });
  });

  describe('config object', () => {
    it('has correct resourceType and title', () => {
      expect(swarmTaskConfig.resourceType).toBe('swarm-task');
      expect(swarmTaskConfig.title).toBe('Swarm Tasks');
    });
  });

  describe('renderPanelContent', () => {
    it('renders summary tab without crashing', () => {
      const onAnalyze = vi.fn();
      const onCancel = vi.fn();
      render(<>{renderSwarmTaskPanelContent(mockRow, 'summary', mockHolmesState, onAnalyze, onCancel)}</>);
      expect(screen.getByTestId('task-summary-panel')).toBeInTheDocument();
    });

    it('renders logs tab with container without crashing', () => {
      const onAnalyze = vi.fn();
      const onCancel = vi.fn();
      render(<>{renderSwarmTaskPanelContent(mockRow, 'logs', mockHolmesState, onAnalyze, onCancel)}</>);
      expect(screen.getByTestId('aggregate-logs-tab')).toBeInTheDocument();
    });

    it('renders logs tab without containerId shows empty state', () => {
      const rowWithoutContainer: ResourceRow = { ...mockRow, containerId: undefined };
      const onAnalyze = vi.fn();
      const onCancel = vi.fn();
      render(<>{renderSwarmTaskPanelContent(rowWithoutContainer, 'logs', mockHolmesState, onAnalyze, onCancel)}</>);
      expect(screen.getByTestId('empty-tab-content')).toBeInTheDocument();
    });

    it('renders holmes tab without crashing', () => {
      const onAnalyze = vi.fn();
      const onCancel = vi.fn();
      render(<>{renderSwarmTaskPanelContent(mockRow, 'holmes', mockHolmesState, onAnalyze, onCancel)}</>);
      expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
    });

    it('returns null for unknown tab', () => {
      const onAnalyze = vi.fn();
      const onCancel = vi.fn();
      const result = renderSwarmTaskPanelContent(mockRow, 'unknown', mockHolmesState, onAnalyze, onCancel);
      expect(result).toBeNull();
    });
  });
});
