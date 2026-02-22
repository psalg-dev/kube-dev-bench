import '../__tests__/wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  swarmConfigColumns,
  swarmConfigTabs,
  renderSwarmConfigPanelContent,
  swarmConfigConfig,
} from '../config/resourceConfigs/swarm/configConfig';

vi.mock('../docker/swarmApi', () => ({
  GetSwarmConfigs: vi.fn(),
  CloneSwarmConfig: vi.fn(),
  ExportSwarmConfig: vi.fn(),
  RemoveSwarmConfig: vi.fn(),
}));

vi.mock('../docker/resources/configs/ConfigSummaryPanel', () => ({
  ConfigSummaryPanel: ({ row }: { row: ResourceRow }) => (
    <div data-testid="config-summary-panel">{String(row.name ?? '')}</div>
  ),
}));

vi.mock('../docker/resources/configs/ConfigDataTab', () => ({
  ConfigDataTab: ({ configId }: { configId: string }) => (
    <div data-testid="config-data-tab">{configId}</div>
  ),
}));

vi.mock('../docker/resources/configs/ConfigInspectTab', () => ({
  ConfigInspectTab: ({ configId }: { configId: string }) => (
    <div data-testid="config-inspect-tab">{configId}</div>
  ),
}));

const mockRow: ResourceRow = {
  id: 'cfg-1',
  name: 'my-config',
  dataSize: 256,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
  labels: {},
};

describe('swarmConfigConfig – columns', () => {
  it('has the expected column keys', () => {
    const keys = swarmConfigColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('dataSize');
    expect(keys).toContain('createdAt');
    expect(keys).toContain('updatedAt');
  });

  it('has labels on all columns', () => {
    for (const col of swarmConfigColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('swarmConfigConfig – tabs', () => {
  it('has the expected tab keys', () => {
    const keys = swarmConfigTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('data');
    expect(keys).toContain('inspect');
  });
});

describe('swarmConfigConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(swarmConfigConfig.resourceType).toBe('swarm-config');
    expect(swarmConfigConfig.resourceKind).toBe('Config');
  });
});

describe('renderSwarmConfigPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab without crashing', () => {
    const node = renderSwarmConfigPanelContent(mockRow, 'summary');
    render(<>{node}</>);
    expect(screen.getByTestId('config-summary-panel')).toBeInTheDocument();
  });

  it('renders data tab without crashing', () => {
    const node = renderSwarmConfigPanelContent(mockRow, 'data');
    render(<>{node}</>);
    expect(screen.getByTestId('config-data-tab')).toBeInTheDocument();
  });

  it('renders inspect tab without crashing', () => {
    const node = renderSwarmConfigPanelContent(mockRow, 'inspect');
    render(<>{node}</>);
    expect(screen.getByTestId('config-inspect-tab')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderSwarmConfigPanelContent(mockRow, 'unknown');
    expect(node).toBeNull();
  });
});
