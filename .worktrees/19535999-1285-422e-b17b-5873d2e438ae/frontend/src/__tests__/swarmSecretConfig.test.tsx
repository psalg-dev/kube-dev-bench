import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../docker/resources/secrets/SecretSummaryPanel', () => ({
  SecretSummaryPanel: () => <div data-testid="secret-summary" />,
}));
vi.mock('../docker/resources/secrets/SecretInspectTab', () => ({
  SecretInspectTab: () => <div data-testid="secret-inspect" />,
}));
vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

import {
  swarmSecretColumns,
  swarmSecretTabs,
  renderSwarmSecretPanelContent,
} from '../config/resourceConfigs/swarm/secretConfig';

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
  id: 'secret-1',
  name: 'db-password',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
  labels: { env: 'prod' },
  driverName: null,
};

describe('swarmSecretConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('columns', () => {
    it('exports at least 2 columns', () => {
      expect(swarmSecretColumns.length).toBeGreaterThanOrEqual(2);
    });

    it('contains expected column keys', () => {
      const keys = swarmSecretColumns.map((c) => c.key);
      expect(keys).toContain('name');
      expect(keys).toContain('createdAt');
      expect(keys).toContain('labels');
    });
  });

  describe('tabs', () => {
    it('exports at least 2 tabs', () => {
      expect(swarmSecretTabs.length).toBeGreaterThanOrEqual(2);
    });

    it('contains expected tab keys', () => {
      const keys = swarmSecretTabs.map((t) => t.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('inspect');
    });
  });

  describe('renderPanelContent', () => {
    it('renders summary tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmSecretPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders inspect tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmSecretPanelContent(mockRow, 'inspect', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('returns null for unknown tab', () => {
      const result = renderSwarmSecretPanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn(), {});
      expect(result).toBeNull();
    });
  });
});
