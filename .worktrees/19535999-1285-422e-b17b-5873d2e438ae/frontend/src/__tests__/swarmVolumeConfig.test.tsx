import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../QuickInfoSection', () => ({
  default: () => <div data-testid="quick-info" />,
}));
vi.mock('../layout/bottompanel/SummaryTabHeader', () => ({
  default: ({ name }: { name: string }) => <div data-testid="summary-header">{name}</div>,
}));
vi.mock('../docker/resources/SwarmResourceActions', () => ({
  default: () => <div data-testid="swarm-actions" />,
}));
vi.mock('../docker/resources/volumes/VolumeUsedBySection', () => ({
  default: () => <div data-testid="volume-used-by" />,
}));
vi.mock('../docker/resources/volumes/VolumeFilesTab', () => ({
  default: () => <div data-testid="volume-files" />,
}));
vi.mock('../docker/resources/volumes/VolumeInspectTab', () => ({
  default: () => <div data-testid="volume-inspect" />,
}));
vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

import {
  swarmVolumeColumns,
  swarmVolumeTabs,
  renderSwarmVolumePanelContent,
} from '../config/resourceConfigs/swarm/volumeConfig';

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
  name: 'my-volume',
  driver: 'local',
  scope: 'local',
  mountpoint: '/var/lib/docker/volumes/my-volume/_data',
  createdAt: '2024-01-01T00:00:00Z',
  labels: { env: 'prod' },
};

describe('swarmVolumeConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('columns', () => {
    it('exports at least 2 columns', () => {
      expect(swarmVolumeColumns.length).toBeGreaterThanOrEqual(2);
    });

    it('contains expected column keys', () => {
      const keys = swarmVolumeColumns.map((c) => c.key);
      expect(keys).toContain('name');
      expect(keys).toContain('driver');
      expect(keys).toContain('scope');
    });
  });

  describe('tabs', () => {
    it('exports at least 2 tabs', () => {
      expect(swarmVolumeTabs.length).toBeGreaterThanOrEqual(2);
    });

    it('contains expected tab keys', () => {
      const keys = swarmVolumeTabs.map((t) => t.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('files');
    });
  });

  describe('renderPanelContent', () => {
    it('renders summary tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmVolumePanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders files tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmVolumePanelContent(mockRow, 'files', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders inspect tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmVolumePanelContent(mockRow, 'inspect', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('returns null for unknown tab', () => {
      const result = renderSwarmVolumePanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn(), {});
      expect(result).toBeNull();
    });
  });
});
