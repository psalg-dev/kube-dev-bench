import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ResourceRow } from '../types/resourceConfigs';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import {
  swarmConfigColumns,
  swarmConfigTabs,
  swarmConfigConfig,
  renderSwarmConfigPanelContent,
} from '../config/resourceConfigs/swarm/configConfig';

vi.mock('../docker/resources/configs/ConfigSummaryPanel', () => ({
  ConfigSummaryPanel: () => <div data-testid="config-summary-panel" />,
}));
vi.mock('../docker/resources/configs/ConfigDataTab', () => ({
  ConfigDataTab: () => <div data-testid="config-data-tab" />,
}));
vi.mock('../docker/resources/configs/ConfigInspectTab', () => ({
  ConfigInspectTab: () => <div data-testid="config-inspect-tab" />,
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
  id: 'cfg-1',
  name: 'my-config',
  dataSize: 512,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  labels: {},
};

describe('swarmConfigConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('columns', () => {
    it('has the expected column keys', () => {
      const keys = swarmConfigColumns.map((c) => c.key);
      expect(keys).toContain('name');
      expect(keys).toContain('dataSize');
      expect(keys).toContain('createdAt');
      expect(keys).toContain('updatedAt');
    });

    it('has correct labels for columns', () => {
      const nameCol = swarmConfigColumns.find((c) => c.key === 'name');
      expect(nameCol?.label).toBe('Name');
      const sizeCol = swarmConfigColumns.find((c) => c.key === 'dataSize');
      expect(sizeCol?.label).toBe('Size');
    });
  });

  describe('tabs', () => {
    it('has the expected tab keys', () => {
      const keys = swarmConfigTabs.map((t) => t.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('data');
      expect(keys).toContain('inspect');
    });
  });

  describe('config object', () => {
    it('has correct resourceType and title', () => {
      expect(swarmConfigConfig.resourceType).toBe('swarm-config');
      expect(swarmConfigConfig.title).toBe('Swarm Configs');
    });
  });

  describe('renderPanelContent', () => {
    it('renders summary tab without crashing', () => {
      render(<>{renderSwarmConfigPanelContent(mockRow, 'summary', mockHolmesState)}</>);
      expect(screen.getByTestId('config-summary-panel')).toBeInTheDocument();
    });

    it('renders data tab without crashing', () => {
      render(<>{renderSwarmConfigPanelContent(mockRow, 'data', mockHolmesState)}</>);
      expect(screen.getByTestId('config-data-tab')).toBeInTheDocument();
    });

    it('renders inspect tab without crashing', () => {
      render(<>{renderSwarmConfigPanelContent(mockRow, 'inspect', mockHolmesState)}</>);
      expect(screen.getByTestId('config-inspect-tab')).toBeInTheDocument();
    });

    it('returns null for unknown tab', () => {
      const result = renderSwarmConfigPanelContent(mockRow, 'unknown', mockHolmesState);
      expect(result).toBeNull();
    });
  });
});
