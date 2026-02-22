import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ResourceRow } from '../types/resourceConfigs';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import {
  swarmNetworkColumns,
  swarmNetworkTabs,
  swarmNetworkConfig,
  renderSwarmNetworkPanelContent,
} from '../config/resourceConfigs/swarm/networkConfig';

vi.mock('../QuickInfoSection', () => ({
  default: () => <div data-testid="quick-info-section" />,
}));
vi.mock('../layout/bottompanel/SummaryTabHeader', () => ({
  default: () => <div data-testid="summary-tab-header" />,
}));
vi.mock('../docker/resources/SwarmResourceActions', () => ({
  default: () => <div data-testid="swarm-resource-actions" />,
}));
vi.mock('../docker/resources/networks/NetworkConnectedServicesTable', () => ({
  NetworkConnectedServicesTable: () => <div data-testid="network-connected-services" />,
}));
vi.mock('../docker/resources/networks/NetworkConnectedContainersTable', () => ({
  NetworkConnectedContainersTable: () => <div data-testid="network-connected-containers" />,
}));
vi.mock('../docker/resources/networks/NetworkInspectTab', () => ({
  NetworkInspectTab: () => <div data-testid="network-inspect-tab" />,
}));
vi.mock('../docker/resources/networks/NetworkDetailsSections', () => ({
  NetworkIPAMSection: () => <div data-testid="network-ipam-section" />,
  NetworkOptionsSection: () => <div data-testid="network-options-section" />,
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
  id: 'net-1',
  name: 'my-overlay-network',
  driver: 'overlay',
  scope: 'swarm',
  attachable: true,
  internal: false,
  createdAt: '2024-01-01T00:00:00Z',
  labels: {},
  options: {},
  ipam: {},
};

describe('swarmNetworkConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('columns', () => {
    it('has the expected column keys', () => {
      const keys = swarmNetworkColumns.map((c) => c.key);
      expect(keys).toContain('name');
      expect(keys).toContain('driver');
      expect(keys).toContain('scope');
      expect(keys).toContain('attachable');
      expect(keys).toContain('internal');
      expect(keys).toContain('createdAt');
    });

    it('has correct labels for columns', () => {
      const nameCol = swarmNetworkColumns.find((c) => c.key === 'name');
      expect(nameCol?.label).toBe('Name');
      const driverCol = swarmNetworkColumns.find((c) => c.key === 'driver');
      expect(driverCol?.label).toBe('Driver');
    });
  });

  describe('tabs', () => {
    it('has the expected tab keys', () => {
      const keys = swarmNetworkTabs.map((t) => t.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('services');
      expect(keys).toContain('containers');
      expect(keys).toContain('inspect');
    });
  });

  describe('config object', () => {
    it('has correct resourceType and title', () => {
      expect(swarmNetworkConfig.resourceType).toBe('swarm-network');
      expect(swarmNetworkConfig.title).toBe('Docker Networks');
    });
  });

  describe('renderPanelContent', () => {
    it('renders summary tab without crashing', () => {
      render(<>{renderSwarmNetworkPanelContent(mockRow, 'summary', mockHolmesState, undefined, undefined, { refresh: () => {} })}</>);
      expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    });

    it('renders services tab without crashing', () => {
      render(<>{renderSwarmNetworkPanelContent(mockRow, 'services', mockHolmesState, undefined, undefined, undefined)}</>);
      expect(screen.getByTestId('network-connected-services')).toBeInTheDocument();
    });

    it('renders containers tab without crashing', () => {
      render(<>{renderSwarmNetworkPanelContent(mockRow, 'containers', mockHolmesState, undefined, undefined, undefined)}</>);
      expect(screen.getByTestId('network-connected-containers')).toBeInTheDocument();
    });

    it('renders inspect tab without crashing', () => {
      render(<>{renderSwarmNetworkPanelContent(mockRow, 'inspect', mockHolmesState, undefined, undefined, undefined)}</>);
      expect(screen.getByTestId('network-inspect-tab')).toBeInTheDocument();
    });

    it('returns null for unknown tab', () => {
      const result = renderSwarmNetworkPanelContent(mockRow, 'unknown', mockHolmesState, undefined, undefined, undefined);
      expect(result).toBeNull();
    });
  });
});
