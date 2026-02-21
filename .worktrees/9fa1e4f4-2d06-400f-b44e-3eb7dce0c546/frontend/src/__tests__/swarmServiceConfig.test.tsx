import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ResourceRow } from '../types/resourceConfigs';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import {
  swarmServiceColumns,
  swarmServiceTabs,
  swarmServiceConfig,
  renderSwarmServicePanelContent,
} from '../config/resourceConfigs/swarm/serviceConfig';

vi.mock('../docker/resources/services/ServiceSummaryPanel', () => ({
  default: () => <div data-testid="service-summary-panel" />,
}));
vi.mock('../docker/resources/services/ServiceTasksTab', () => ({
  default: () => <div data-testid="service-tasks-tab" />,
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
  ImageUpdateBadge: () => <span data-testid="image-update-badge" />,
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
};

describe('swarmServiceConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('columns', () => {
    it('has the expected column keys', () => {
      const keys = swarmServiceColumns.map((c) => c.key);
      expect(keys).toContain('name');
      expect(keys).toContain('image');
      expect(keys).toContain('mode');
      expect(keys).toContain('replicas');
      expect(keys).toContain('runningTasks');
      expect(keys).toContain('ports');
      expect(keys).toContain('createdAt');
    });

    it('has correct labels for all columns', () => {
      const nameCol = swarmServiceColumns.find((c) => c.key === 'name');
      expect(nameCol?.label).toBe('Name');
      const imageCol = swarmServiceColumns.find((c) => c.key === 'image');
      expect(imageCol?.label).toBe('Image');
    });
  });

  describe('tabs', () => {
    it('has the expected tab keys', () => {
      const keys = swarmServiceTabs.map((t) => t.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('tasks');
      expect(keys).toContain('placement');
      expect(keys).toContain('logs');
      expect(keys).toContain('holmes');
    });
  });

  describe('config object', () => {
    it('has correct resourceType and title', () => {
      expect(swarmServiceConfig.resourceType).toBe('swarm-service');
      expect(swarmServiceConfig.title).toBe('Swarm Services');
    });
  });

  describe('renderPanelContent', () => {
    it('renders summary tab without crashing', () => {
      render(<>{renderSwarmServicePanelContent(mockRow, 'summary', mockHolmesState, undefined, undefined)}</>);
      expect(screen.getByTestId('service-summary-panel')).toBeInTheDocument();
    });

    it('renders tasks tab without crashing', () => {
      render(<>{renderSwarmServicePanelContent(mockRow, 'tasks', mockHolmesState, undefined, undefined)}</>);
      expect(screen.getByTestId('service-tasks-tab')).toBeInTheDocument();
    });

    it('renders placement tab without crashing', () => {
      render(<>{renderSwarmServicePanelContent(mockRow, 'placement', mockHolmesState, undefined, undefined)}</>);
      expect(screen.getByTestId('service-placement-tab')).toBeInTheDocument();
    });

    it('renders logs tab without crashing', () => {
      render(<>{renderSwarmServicePanelContent(mockRow, 'logs', mockHolmesState, undefined, undefined)}</>);
      expect(screen.getByTestId('aggregate-logs-tab')).toBeInTheDocument();
    });

    it('renders holmes tab without crashing', () => {
      render(<>{renderSwarmServicePanelContent(mockRow, 'holmes', mockHolmesState, undefined, undefined)}</>);
      expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
    });

    it('returns null for unknown tab', () => {
      const result = renderSwarmServicePanelContent(mockRow, 'unknown', mockHolmesState, undefined, undefined);
      expect(result).toBeNull();
    });
  });
});
