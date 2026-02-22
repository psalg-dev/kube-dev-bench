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
vi.mock('../docker/resources/networks/NetworkConnectedServicesTable', () => ({
  NetworkConnectedServicesTable: () => <div data-testid="network-services" />,
}));
vi.mock('../docker/resources/networks/NetworkConnectedContainersTable', () => ({
  NetworkConnectedContainersTable: () => <div data-testid="network-containers" />,
}));
vi.mock('../docker/resources/networks/NetworkInspectTab', () => ({
  NetworkInspectTab: () => <div data-testid="network-inspect" />,
}));
vi.mock('../docker/resources/networks/NetworkDetailsSections', () => ({
  NetworkIPAMSection: () => <div data-testid="network-ipam" />,
  NetworkOptionsSection: () => <div data-testid="network-options" />,
}));
vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

import {
  swarmNetworkColumns,
  swarmNetworkTabs,
  renderSwarmNetworkPanelContent,
} from '../config/resourceConfigs/swarm/networkConfig';

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
  id: 'net-1',
  name: 'my-overlay',
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
    it('exports at least 2 columns', () => {
      expect(swarmNetworkColumns.length).toBeGreaterThanOrEqual(2);
    });

    it('contains expected column keys', () => {
      const keys = swarmNetworkColumns.map((c) => c.key);
      expect(keys).toContain('name');
      expect(keys).toContain('driver');
      expect(keys).toContain('scope');
    });
  });

  describe('tabs', () => {
    it('exports at least 2 tabs', () => {
      expect(swarmNetworkTabs.length).toBeGreaterThanOrEqual(2);
    });

    it('contains expected tab keys', () => {
      const keys = swarmNetworkTabs.map((t) => t.key);
      expect(keys).toContain('summary');
      expect(keys).toContain('services');
    });
  });

  describe('renderPanelContent', () => {
    it('renders summary tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmNetworkPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders services tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmNetworkPanelContent(mockRow, 'services', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders containers tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmNetworkPanelContent(mockRow, 'containers', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('renders inspect tab without throwing', () => {
      const { container } = render(
        <>{renderSwarmNetworkPanelContent(mockRow, 'inspect', holmesState, vi.fn(), vi.fn(), {})}</>,
      );
      expect(container).toBeTruthy();
    });

    it('returns null for unknown tab', () => {
      const result = renderSwarmNetworkPanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn(), {});
      expect(result).toBeNull();
    });
  });
});
