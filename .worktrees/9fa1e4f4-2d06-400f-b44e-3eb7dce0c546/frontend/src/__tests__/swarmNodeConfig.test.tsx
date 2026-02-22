import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ResourceRow } from '../types/resourceConfigs';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import {
  swarmNodeColumns,
  swarmNodeTabs,
  swarmNodeConfig,
  renderSwarmNodePanelContent,
} from '../config/resourceConfigs/swarm/nodeConfig';

vi.mock('../docker/resources/nodes/NodeSummaryPanel', () => ({
  default: () => <div data-testid="node-summary-panel" />,
}));
vi.mock('../docker/resources/nodes/NodeTasksTab', () => ({
  default: () => <div data-testid="node-tasks-tab" />,
}));
vi.mock('../docker/resources/nodes/NodeLabelsTab', () => ({
  default: () => <div data-testid="node-labels-tab" />,
}));
vi.mock('../docker/resources/nodes/NodeLogsTab', () => ({
  default: () => <div data-testid="node-logs-tab" />,
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
  hostname: 'worker-node-1',
  role: 'worker',
  availability: 'active',
  state: 'ready',
  address: '192.168.1.10',
  engineVersion: '24.0.0',
  leader: false,
  labels: {},
};

describe('swarmNodeConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('columns', () => {
    it('has the expected column keys', () => {
      const keys = swarmNodeColumns.map((c) => c.key);
      expect(keys).toContain('hostname');
      expect(keys).toContain('role');
      expect(keys).toContain('availability');
      expect(keys).toContain('state');
      expect(keys).toContain('address');
      expect(keys).toContain('engineVersion');
      expect(keys).toContain('leader');
    });

    it('has correct label for hostname column', () => {
      const col = swarmNodeColumns.find((c) => c.key === 'hostname');
      expect(col?.label).toBe('Hostname');
    });
  });

  describe('tabs', () => {
    it('has the expected tab keys', () => {
      const keys = swarmNodeTabs.map((t) => t.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('tasks');
      expect(keys).toContain('logs');
      expect(keys).toContain('labels');
      expect(keys).toContain('holmes');
    });
  });

  describe('config object', () => {
    it('has correct resourceType and title', () => {
      expect(swarmNodeConfig.resourceType).toBe('swarm-node');
      expect(swarmNodeConfig.title).toBe('Swarm Nodes');
    });
  });

  describe('renderPanelContent', () => {
    it('renders summary tab without crashing', () => {
      render(<>{renderSwarmNodePanelContent(mockRow, 'summary', mockHolmesState, undefined, undefined, undefined)}</>);
      expect(screen.getByTestId('node-summary-panel')).toBeInTheDocument();
    });

    it('renders tasks tab without crashing', () => {
      render(<>{renderSwarmNodePanelContent(mockRow, 'tasks', mockHolmesState, undefined, undefined, undefined)}</>);
      expect(screen.getByTestId('node-tasks-tab')).toBeInTheDocument();
    });

    it('renders labels tab without crashing', () => {
      render(<>{renderSwarmNodePanelContent(mockRow, 'labels', mockHolmesState, undefined, undefined, { refresh: () => {} })}</>);
      expect(screen.getByTestId('node-labels-tab')).toBeInTheDocument();
    });

    it('renders logs tab without crashing', () => {
      render(<>{renderSwarmNodePanelContent(mockRow, 'logs', mockHolmesState, undefined, undefined, undefined)}</>);
      expect(screen.getByTestId('node-logs-tab')).toBeInTheDocument();
    });

    it('renders holmes tab without crashing', () => {
      render(<>{renderSwarmNodePanelContent(mockRow, 'holmes', mockHolmesState, undefined, undefined, undefined)}</>);
      expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
    });

    it('returns null for unknown tab', () => {
      const result = renderSwarmNodePanelContent(mockRow, 'unknown', mockHolmesState, undefined, undefined, undefined);
      expect(result).toBeNull();
    });
  });
});
