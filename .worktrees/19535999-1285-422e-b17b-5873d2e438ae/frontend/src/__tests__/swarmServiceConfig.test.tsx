import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// Mock heavy child components used by renderPanelContent
vi.mock('../docker/resources/services/ServiceSummaryPanel', () => ({
  default: () => <div data-testid="service-summary" />,
}));
vi.mock('../docker/resources/services/ServiceTasksTab', () => ({
  default: () => <div data-testid="service-tasks" />,
}));
vi.mock('../docker/resources/services/ServicePlacementTab', () => ({
  default: () => <div data-testid="service-placement" />,
}));
vi.mock('../docker/resources/services/ImageUpdateBadge', () => ({
  ImageUpdateBadge: ({ value }: { value: unknown }) => <div data-testid="image-update-badge">{String(value)}</div>,
}));
vi.mock('../components/AggregateLogsTab', () => ({
  default: () => <div data-testid="aggregate-logs" />,
}));
vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: () => <div data-testid="holmes-panel" />,
}));
vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

import {
  swarmServiceColumns,
  swarmServiceTabs,
  renderSwarmServicePanelContent,
} from '../config/resourceConfigs/swarm/serviceConfig';

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
  id: 'svc-1',
  name: 'my-service',
  image: 'nginx:latest',
  mode: 'replicated',
  replicas: 2,
  runningTasks: 2,
  ports: [{ publishedPort: 80, targetPort: 8080, protocol: 'tcp' }],
  createdAt: '2024-01-01T00:00:00Z',
  labels: {},
};

describe('swarmServiceConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('columns', () => {
    it('exports at least 2 columns', () => {
      expect(swarmServiceColumns.length).toBeGreaterThanOrEqual(2);
    });

    it('contains expected column keys', () => {
      const keys = swarmServiceColumns.map((c) => c.key);
      expect(keys).toContain('name');
      expect(keys).toContain('image');
      expect(keys).toContain('mode');
      expect(keys).toContain('replicas');
    });
  });

  describe('tabs', () => {
    it('exports at least 2 tabs', () => {
      expect(swarmServiceTabs.length).toBeGreaterThanOrEqual(2);
    });

    it('contains expected tab keys', () => {
      const keys = swarmServiceTabs.map((t) => t.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('logs');
    });
  });

  describe('renderPanelContent', () => {
    it('renders summary tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmServicePanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders tasks tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmServicePanelContent(mockRow, 'tasks', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders placement tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmServicePanelContent(mockRow, 'placement', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders logs tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmServicePanelContent(mockRow, 'logs', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders holmes tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmServicePanelContent(mockRow, 'holmes', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('returns null for unknown tab', () => {
      const result = renderSwarmServicePanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn(), {});
      expect(result).toBeNull();
    });
  });
});
