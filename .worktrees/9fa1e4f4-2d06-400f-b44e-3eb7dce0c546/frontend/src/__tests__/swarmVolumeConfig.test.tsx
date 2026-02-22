import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ResourceRow } from '../types/resourceConfigs';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import {
  swarmVolumeColumns,
  swarmVolumeTabs,
  swarmVolumeConfig,
  renderSwarmVolumePanelContent,
} from '../config/resourceConfigs/swarm/volumeConfig';

vi.mock('../QuickInfoSection', () => ({
  default: () => <div data-testid="quick-info-section" />,
}));
vi.mock('../layout/bottompanel/SummaryTabHeader', () => ({
  default: () => <div data-testid="summary-tab-header" />,
}));
vi.mock('../docker/resources/SwarmResourceActions', () => ({
  default: () => <div data-testid="swarm-resource-actions" />,
}));
vi.mock('../docker/resources/volumes/VolumeUsedBySection', () => ({
  default: () => <div data-testid="volume-used-by-section" />,
}));
vi.mock('../docker/resources/volumes/VolumeFilesTab', () => ({
  default: () => <div data-testid="volume-files-tab" />,
}));
vi.mock('../docker/resources/volumes/VolumeInspectTab', () => ({
  default: () => <div data-testid="volume-inspect-tab" />,
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
  name: 'my-volume',
  driver: 'local',
  scope: 'local',
  mountpoint: '/var/lib/docker/volumes/my-volume/_data',
  createdAt: '2024-01-01T00:00:00Z',
  labels: {},
};

describe('swarmVolumeConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('columns', () => {
    it('has the expected column keys', () => {
      const keys = swarmVolumeColumns.map((c) => c.key);
      expect(keys).toContain('name');
      expect(keys).toContain('driver');
      expect(keys).toContain('scope');
      expect(keys).toContain('createdAt');
      expect(keys).toContain('labels');
    });

    it('has correct labels for columns', () => {
      const nameCol = swarmVolumeColumns.find((c) => c.key === 'name');
      expect(nameCol?.label).toBe('Name');
      const driverCol = swarmVolumeColumns.find((c) => c.key === 'driver');
      expect(driverCol?.label).toBe('Driver');
    });
  });

  describe('tabs', () => {
    it('has the expected tab keys', () => {
      const keys = swarmVolumeTabs.map((t) => t.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('files');
      expect(keys).toContain('inspect');
    });
  });

  describe('config object', () => {
    it('has correct resourceType and title', () => {
      expect(swarmVolumeConfig.resourceType).toBe('swarm-volume');
      expect(swarmVolumeConfig.title).toBe('Swarm Volumes');
    });
  });

  describe('renderPanelContent', () => {
    it('renders summary tab without crashing', () => {
      render(<>{renderSwarmVolumePanelContent(mockRow, 'summary', mockHolmesState, undefined, undefined, { refresh: () => {} })}</>);
      expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    });

    it('renders files tab without crashing', () => {
      render(<>{renderSwarmVolumePanelContent(mockRow, 'files', mockHolmesState, undefined, undefined, undefined)}</>);
      expect(screen.getByTestId('volume-files-tab')).toBeInTheDocument();
    });

    it('renders inspect tab without crashing', () => {
      render(<>{renderSwarmVolumePanelContent(mockRow, 'inspect', mockHolmesState, undefined, undefined, undefined)}</>);
      expect(screen.getByTestId('volume-inspect-tab')).toBeInTheDocument();
    });

    it('returns null for unknown tab', () => {
      const result = renderSwarmVolumePanelContent(mockRow, 'unknown', mockHolmesState, undefined, undefined, undefined);
      expect(result).toBeNull();
    });
  });
});
