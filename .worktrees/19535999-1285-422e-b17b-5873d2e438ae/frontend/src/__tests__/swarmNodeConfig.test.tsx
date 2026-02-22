import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../components/StatusBadge', () => ({
  default: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));
vi.mock('../docker/resources/nodes/NodeSummaryPanel', () => ({
  default: () => <div data-testid="node-summary" />,
}));
vi.mock('../docker/resources/nodes/NodeTasksTab', () => ({
  default: () => <div data-testid="node-tasks" />,
}));
vi.mock('../docker/resources/nodes/NodeLabelsTab', () => ({
  default: () => <div data-testid="node-labels" />,
}));
vi.mock('../docker/resources/nodes/NodeLogsTab', () => ({
  default: () => <div data-testid="node-logs" />,
}));
vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: () => <div data-testid="holmes-panel" />,
}));
vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

import {
  swarmNodeColumns,
  swarmNodeTabs,
  renderSwarmNodePanelContent,
} from '../config/resourceConfigs/swarm/nodeConfig';

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

describe('swarmNodeConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('columns', () => {
    it('exports at least 2 columns', () => {
      expect(swarmNodeColumns.length).toBeGreaterThanOrEqual(2);
    });

    it('contains expected column keys', () => {
      const keys = swarmNodeColumns.map((c) => c.key);
      expect(keys).toContain('hostname');
      expect(keys).toContain('role');
      expect(keys).toContain('availability');
      expect(keys).toContain('state');
    });
  });

  describe('tabs', () => {
    it('exports at least 2 tabs', () => {
      expect(swarmNodeTabs.length).toBeGreaterThanOrEqual(2);
    });

    it('contains expected tab keys', () => {
      const keys = swarmNodeTabs.map((t) => t.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('tasks');
    });
  });

  describe('renderPanelContent', () => {
    it('renders summary tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmNodePanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders tasks tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmNodePanelContent(mockRow, 'tasks', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders labels tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmNodePanelContent(mockRow, 'labels', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders logs tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmNodePanelContent(mockRow, 'logs', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders holmes tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmNodePanelContent(mockRow, 'holmes', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('returns null for unknown tab', () => {
      const result = renderSwarmNodePanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn(), {});
      expect(result).toBeNull();
    });
  });
});
