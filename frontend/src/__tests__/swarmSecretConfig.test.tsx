import '../__tests__/wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  swarmSecretColumns,
  swarmSecretTabs,
  renderSwarmSecretPanelContent,
  swarmSecretConfig,
} from '../config/resourceConfigs/swarm/secretConfig';

vi.mock('../docker/swarmApi', () => ({
  GetSwarmSecrets: vi.fn(),
  RemoveSwarmSecret: vi.fn(),
}));

vi.mock('../docker/resources/secrets/SecretSummaryPanel', () => ({
  SecretSummaryPanel: ({ row }: { row: ResourceRow }) => (
    <div data-testid="secret-summary-panel">{String(row.name ?? '')}</div>
  ),
}));

vi.mock('../docker/resources/secrets/SecretInspectTab', () => ({
  SecretInspectTab: ({ secretId }: { secretId: string }) => (
    <div data-testid="secret-inspect-tab">{secretId}</div>
  ),
}));

const mockRow: ResourceRow = {
  id: 'sec-1',
  name: 'my-secret',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
  labels: {},
  driverName: undefined,
};

describe('swarmSecretConfig – columns', () => {
  it('has the expected column keys', () => {
    const keys = swarmSecretColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('createdAt');
    expect(keys).toContain('updatedAt');
    expect(keys).toContain('labels');
  });

  it('has labels on all columns', () => {
    for (const col of swarmSecretColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('swarmSecretConfig – tabs', () => {
  it('has the expected tab keys', () => {
    const keys = swarmSecretTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('inspect');
  });
});

describe('swarmSecretConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(swarmSecretConfig.resourceType).toBe('swarm-secret');
    expect(swarmSecretConfig.resourceKind).toBe('Secret');
  });
});

describe('renderSwarmSecretPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab without crashing', () => {
    const node = renderSwarmSecretPanelContent(mockRow, 'summary');
    render(<>{node}</>);
    expect(screen.getByTestId('secret-summary-panel')).toBeInTheDocument();
  });

  it('renders inspect tab without crashing', () => {
    const node = renderSwarmSecretPanelContent(mockRow, 'inspect');
    render(<>{node}</>);
    expect(screen.getByTestId('secret-inspect-tab')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderSwarmSecretPanelContent(mockRow, 'unknown');
    expect(node).toBeNull();
  });
});
