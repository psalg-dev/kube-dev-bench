import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../components/StatusBadge', () => ({
  default: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));
vi.mock('../docker/resources/tasks/HealthStatusBadge', () => ({
  default: ({ status }: { status: string | null }) => <span data-testid="health-badge">{status ?? '-'}</span>,
}));
vi.mock('../docker/resources/tasks/TaskSummaryPanel', () => ({
  default: () => <div data-testid="task-summary" />,
}));
vi.mock('../components/AggregateLogsTab', () => ({
  default: () => <div data-testid="aggregate-logs" />,
}));
vi.mock('../components/EmptyTabContent', () => ({
  default: ({ title }: { title: string }) => <div data-testid="empty-tab">{title}</div>,
}));
vi.mock('../constants/emptyTabMessages', () => ({
  getEmptyTabMessage: () => ({
    icon: '📋',
    title: 'No content',
    description: 'Nothing here',
    tip: '',
  }),
}));
vi.mock('../layout/bottompanel/ConsoleTab', () => ({
  default: () => <div data-testid="console-tab" />,
}));
vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: () => <div data-testid="holmes-panel" />,
}));

import {
  swarmTaskColumns,
  swarmTaskTabs,
  renderSwarmTaskPanelContent,
} from '../config/resourceConfigs/swarm/taskConfig';

const holmesState = {
  key: '',
  response: null,
  loading: false,
  error: null,
  streamId: null,
  streamingText: '',
  reasoningText: '',
  toolEvents: [],
  contextSteps: [],
  queryTimestamp: null,
};

const mockRow = {
  id: 'task-abc123',
  serviceId: 'svc-1',
  serviceName: 'web',
  nodeId: 'node-1',
  nodeName: 'worker-1',
  slot: 1,
  state: 'running',
  desiredState: 'running',
  healthStatus: 'healthy',
  containerId: 'cont-abc123',
  image: 'nginx:latest',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
  error: null,
  networks: [],
  mounts: [],
};

describe('swarmTaskConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('columns', () => {
    it('exports at least 2 columns', () => {
      expect(swarmTaskColumns.length).toBeGreaterThanOrEqual(2);
    });

    it('contains expected column keys', () => {
      const keys = swarmTaskColumns.map((c) => c.key);
      expect(keys).toContain('id');
      expect(keys).toContain('serviceName');
      expect(keys).toContain('state');
    });
  });

  describe('tabs', () => {
    it('exports at least 2 tabs', () => {
      expect(swarmTaskTabs.length).toBeGreaterThanOrEqual(2);
    });

    it('contains expected tab keys', () => {
      const keys = swarmTaskTabs.map((t) => t.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('logs');
    });
  });

  describe('renderPanelContent', () => {
    it('renders summary tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmTaskPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders logs tab (with container) without throwing', () => {
      const { container } = render(
        <>{renderSwarmTaskPanelContent(mockRow, 'logs', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders logs tab (no container) without throwing', () => {
      const rowNoContainer = { ...mockRow, containerId: null };
      const { container } = render(
        <>{renderSwarmTaskPanelContent(rowNoContainer, 'logs', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders exec tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmTaskPanelContent(mockRow, 'exec', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders holmes tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmTaskPanelContent(mockRow, 'holmes', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('returns null for unknown tab', () => {
      const result = renderSwarmTaskPanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn(), {});
      expect(result).toBeNull();
    });
  });
});
