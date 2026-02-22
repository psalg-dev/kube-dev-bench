import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ResourceRow } from '../types/resourceConfigs';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import {
  swarmSecretColumns,
  swarmSecretTabs,
  swarmSecretConfig,
  renderSwarmSecretPanelContent,
} from '../config/resourceConfigs/swarm/secretConfig';

vi.mock('../docker/resources/secrets/SecretSummaryPanel', () => ({
  SecretSummaryPanel: () => <div data-testid="secret-summary-panel" />,
}));
vi.mock('../docker/resources/secrets/SecretInspectTab', () => ({
  SecretInspectTab: () => <div data-testid="secret-inspect-tab" />,
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
  id: 'secret-1',
  name: 'my-secret',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  labels: {},
  driverName: '',
};

describe('swarmSecretConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('columns', () => {
    it('has the expected column keys', () => {
      const keys = swarmSecretColumns.map((c) => c.key);
      expect(keys).toContain('name');
      expect(keys).toContain('createdAt');
      expect(keys).toContain('updatedAt');
      expect(keys).toContain('labels');
    });

    it('has correct labels for columns', () => {
      const nameCol = swarmSecretColumns.find((c) => c.key === 'name');
      expect(nameCol?.label).toBe('Name');
      const createdCol = swarmSecretColumns.find((c) => c.key === 'createdAt');
      expect(createdCol?.label).toBe('Created');
    });
  });

  describe('tabs', () => {
    it('has the expected tab keys', () => {
      const keys = swarmSecretTabs.map((t) => t.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('inspect');
    });
  });

  describe('config object', () => {
    it('has correct resourceType and title', () => {
      expect(swarmSecretConfig.resourceType).toBe('swarm-secret');
      expect(swarmSecretConfig.title).toBe('Swarm Secrets');
    });
  });

  describe('renderPanelContent', () => {
    it('renders summary tab without crashing', () => {
      render(<>{renderSwarmSecretPanelContent(mockRow, 'summary', mockHolmesState)}</>);
      expect(screen.getByTestId('secret-summary-panel')).toBeInTheDocument();
    });

    it('renders inspect tab without crashing', () => {
      render(<>{renderSwarmSecretPanelContent(mockRow, 'inspect', mockHolmesState)}</>);
      expect(screen.getByTestId('secret-inspect-tab')).toBeInTheDocument();
    });

    it('returns null for unknown tab', () => {
      const result = renderSwarmSecretPanelContent(mockRow, 'unknown', mockHolmesState);
      expect(result).toBeNull();
    });
  });
});
