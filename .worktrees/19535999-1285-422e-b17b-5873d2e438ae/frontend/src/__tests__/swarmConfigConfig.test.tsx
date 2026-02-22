import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../docker/resources/configs/ConfigSummaryPanel', () => ({
  ConfigSummaryPanel: () => <div data-testid="config-summary" />,
}));
vi.mock('../docker/resources/configs/ConfigDataTab', () => ({
  ConfigDataTab: () => <div data-testid="config-data" />,
}));
vi.mock('../docker/resources/configs/ConfigInspectTab', () => ({
  ConfigInspectTab: () => <div data-testid="config-inspect" />,
}));
vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

import {
  swarmConfigColumns,
  swarmConfigTabs,
  renderSwarmConfigPanelContent,
} from '../config/resourceConfigs/swarm/configConfig';

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
  id: 'cfg-1',
  name: 'nginx.conf',
  dataSize: 512,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
  labels: {},
};

describe('swarmConfigConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('columns', () => {
    it('exports at least 2 columns', () => {
      expect(swarmConfigColumns.length).toBeGreaterThanOrEqual(2);
    });

    it('contains expected column keys', () => {
      const keys = swarmConfigColumns.map((c) => c.key);
      expect(keys).toContain('name');
      expect(keys).toContain('dataSize');
      expect(keys).toContain('createdAt');
    });
  });

  describe('tabs', () => {
    it('exports at least 2 tabs', () => {
      expect(swarmConfigTabs.length).toBeGreaterThanOrEqual(2);
    });

    it('contains expected tab keys', () => {
      const keys = swarmConfigTabs.map((t) => t.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('data');
    });
  });

  describe('renderPanelContent', () => {
    it('renders summary tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmConfigPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders data tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmConfigPanelContent(mockRow, 'data', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders inspect tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmConfigPanelContent(mockRow, 'inspect', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('returns null for unknown tab', () => {
      const result = renderSwarmConfigPanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn(), {});
      expect(result).toBeNull();
    });
  });
});
