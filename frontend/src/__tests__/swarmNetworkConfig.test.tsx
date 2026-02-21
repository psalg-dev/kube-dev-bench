import '../__tests__/wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  swarmNetworkColumns,
  swarmNetworkTabs,
  renderSwarmNetworkPanelContent,
  swarmNetworkConfig,
} from '../config/resourceConfigs/swarm/networkConfig';

vi.mock('../docker/swarmApi', () => ({
  GetSwarmNetworks: vi.fn(),
  GetSwarmNetworkServices: vi.fn(),
  GetSwarmNetworkContainers: vi.fn(),
  RemoveSwarmNetwork: vi.fn(),
}));

vi.mock('../QuickInfoSection', () => ({
  default: () => <div data-testid="quick-info-section" />,
}));

vi.mock('../layout/bottompanel/SummaryTabHeader', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="summary-tab-header">{name}</div>
  ),
}));

vi.mock('../docker/resources/SwarmResourceActions', () => ({
  default: () => <div data-testid="swarm-resource-actions" />,
}));

vi.mock('../docker/resources/networks/NetworkConnectedServicesTable', () => ({
  NetworkConnectedServicesTable: ({ networkId }: { networkId: string }) => (
    <div data-testid="network-connected-services">{networkId}</div>
  ),
}));

vi.mock('../docker/resources/networks/NetworkConnectedContainersTable', () => ({
  NetworkConnectedContainersTable: ({ networkId }: { networkId: string }) => (
    <div data-testid="network-connected-containers">{networkId}</div>
  ),
}));

vi.mock('../docker/resources/networks/NetworkInspectTab', () => ({
  NetworkInspectTab: ({ networkId }: { networkId: string }) => (
    <div data-testid="network-inspect-tab">{networkId}</div>
  ),
}));

vi.mock('../docker/resources/networks/NetworkDetailsSections', () => ({
  NetworkIPAMSection: () => <div data-testid="network-ipam-section" />,
  NetworkOptionsSection: () => <div data-testid="network-options-section" />,
}));

const mockRow: ResourceRow = {
  id: 'net-1',
  name: 'my-network',
  driver: 'overlay',
  scope: 'swarm',
  attachable: true,
  internal: false,
  createdAt: '2024-01-01T00:00:00Z',
  labels: {},
  options: {},
  ipam: {},
};

describe('swarmNetworkConfig – columns', () => {
  it('has the expected column keys', () => {
    const keys = swarmNetworkColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('driver');
    expect(keys).toContain('scope');
    expect(keys).toContain('attachable');
    expect(keys).toContain('internal');
    expect(keys).toContain('createdAt');
  });

  it('has labels on all columns', () => {
    for (const col of swarmNetworkColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('swarmNetworkConfig – tabs', () => {
  it('has the expected tab keys', () => {
    const keys = swarmNetworkTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('services');
    expect(keys).toContain('containers');
    expect(keys).toContain('inspect');
  });
});

describe('swarmNetworkConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(swarmNetworkConfig.resourceType).toBe('swarm-network');
    expect(swarmNetworkConfig.resourceKind).toBe('Network');
  });
});

describe('renderSwarmNetworkPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab without crashing', () => {
    const node = renderSwarmNetworkPanelContent(mockRow, 'summary');
    render(<>{node}</>);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByTestId('quick-info-section')).toBeInTheDocument();
  });

  it('renders services tab without crashing', () => {
    const node = renderSwarmNetworkPanelContent(mockRow, 'services');
    render(<>{node}</>);
    expect(screen.getByTestId('network-connected-services')).toBeInTheDocument();
  });

  it('renders containers tab without crashing', () => {
    const node = renderSwarmNetworkPanelContent(mockRow, 'containers');
    render(<>{node}</>);
    expect(screen.getByTestId('network-connected-containers')).toBeInTheDocument();
  });

  it('renders inspect tab without crashing', () => {
    const node = renderSwarmNetworkPanelContent(mockRow, 'inspect');
    render(<>{node}</>);
    expect(screen.getByTestId('network-inspect-tab')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderSwarmNetworkPanelContent(mockRow, 'unknown');
    expect(node).toBeNull();
  });
});
