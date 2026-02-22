import '../__tests__/wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  swarmStackColumns,
  swarmStackTabs,
  renderSwarmStackPanelContent,
  swarmStackConfig,
} from '../config/resourceConfigs/swarm/stackConfig';

vi.mock('../docker/swarmApi', () => ({
  GetSwarmStacks: vi.fn(),
  GetSwarmStackServices: vi.fn(),
  GetSwarmStackResources: vi.fn(),
  GetSwarmStackComposeYAML: vi.fn(),
  RemoveSwarmStack: vi.fn(),
  RollbackSwarmStack: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeSwarmStackStream: vi.fn(),
  CancelHolmesStream: vi.fn(),
  onHolmesChatStream: vi.fn(() => vi.fn()),
  onHolmesContextProgress: vi.fn(() => vi.fn()),
}));

vi.mock('../docker/resources/stacks/StackSummaryPanel', () => ({
  StackSummaryPanel: ({ row }: { row: ResourceRow }) => (
    <div data-testid="stack-summary-panel">{String(row.name ?? '')}</div>
  ),
}));

vi.mock('../docker/resources/stacks/StackServicesTab', () => ({
  StackServicesTab: ({ stackName }: { stackName: string }) => (
    <div data-testid="stack-services-tab">{stackName}</div>
  ),
}));

vi.mock('../docker/resources/stacks/StackResourcesTab', () => ({
  StackResourcesTab: ({ stackName, resource }: { stackName: string; resource: string }) => (
    <div data-testid={`stack-resources-tab-${resource}`}>{stackName}</div>
  ),
}));

vi.mock('../docker/resources/stacks/StackComposeTab', () => ({
  StackComposeTab: ({ stackName }: { stackName: string }) => (
    <div data-testid="stack-compose-tab">{stackName}</div>
  ),
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: () => <div data-testid="holmes-bottom-panel" />,
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
  name: 'my-stack',
  services: 3,
  orchestrator: 'swarm',
};

describe('swarmStackConfig – columns', () => {
  it('has the expected column keys', () => {
    const keys = swarmStackColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('services');
    expect(keys).toContain('orchestrator');
  });

  it('has labels on all columns', () => {
    for (const col of swarmStackColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('swarmStackConfig – tabs', () => {
  it('has the expected tab keys', () => {
    const keys = swarmStackTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('services');
    expect(keys).toContain('networks');
    expect(keys).toContain('volumes');
    expect(keys).toContain('configs');
    expect(keys).toContain('secrets');
    expect(keys).toContain('compose');
    expect(keys).toContain('holmes');
  });
});

describe('swarmStackConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(swarmStackConfig.resourceType).toBe('swarm-stack');
    expect(swarmStackConfig.resourceKind).toBe('Stack');
  });
});

describe('renderSwarmStackPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab without crashing', () => {
    const node = renderSwarmStackPanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('stack-summary-panel')).toBeInTheDocument();
  });

  it('renders services tab without crashing', () => {
    const node = renderSwarmStackPanelContent(mockRow, 'services', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('stack-services-tab')).toBeInTheDocument();
  });

  it('renders networks tab without crashing', () => {
    const node = renderSwarmStackPanelContent(mockRow, 'networks', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('stack-resources-tab-networks')).toBeInTheDocument();
  });

  it('renders volumes tab without crashing', () => {
    const node = renderSwarmStackPanelContent(mockRow, 'volumes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('stack-resources-tab-volumes')).toBeInTheDocument();
  });

  it('renders configs tab without crashing', () => {
    const node = renderSwarmStackPanelContent(mockRow, 'configs', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('stack-resources-tab-configs')).toBeInTheDocument();
  });

  it('renders secrets tab without crashing', () => {
    const node = renderSwarmStackPanelContent(mockRow, 'secrets', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('stack-resources-tab-secrets')).toBeInTheDocument();
  });

  it('renders compose tab without crashing', () => {
    const node = renderSwarmStackPanelContent(mockRow, 'compose', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('stack-compose-tab')).toBeInTheDocument();
  });

  it('renders holmes tab without crashing', () => {
    const node = renderSwarmStackPanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderSwarmStackPanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});
