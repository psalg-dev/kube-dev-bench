import './wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  deploymentColumns,
  deploymentTabs,
  renderDeploymentPanelContent,
  deploymentConfig,
} from '../config/resourceConfigs/deploymentConfig';

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeDeploymentStream: vi.fn(),
  CancelHolmesStream: vi.fn(),
  onHolmesChatStream: vi.fn(() => vi.fn()),
  onHolmesContextProgress: vi.fn(() => vi.fn()),
}));

vi.mock('../layout/bottompanel/SummaryTabHeader', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="summary-tab-header">{name}</div>
  ),
}));

vi.mock('../QuickInfoSection', () => ({
  default: () => <div data-testid="quick-info-section" />,
}));

vi.mock('../components/ResourceActions', () => ({
  default: () => <div data-testid="resource-actions" />,
}));

vi.mock('../components/ResourceEventsTab', () => ({
  default: () => <div data-testid="resource-events-tab" />,
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: () => <div data-testid="holmes-bottom-panel" />,
}));

vi.mock('../k8s/resources/deployments/DeploymentPodsTab', () => ({
  default: () => <div data-testid="deployment-pods-tab" />,
}));

vi.mock('../k8s/resources/deployments/DeploymentRolloutTab', () => ({
  default: () => <div data-testid="deployment-rollout-tab" />,
}));

vi.mock('../components/AggregateLogsTab', () => ({
  default: () => <div data-testid="aggregate-logs-tab" />,
}));

vi.mock('../layout/bottompanel/YamlTab', () => ({
  default: () => <div data-testid="yaml-tab" />,
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
  name: 'my-deployment',
  namespace: 'default',
  replicas: 3,
  ready: 3,
  available: 3,
  age: '7d',
  image: 'nginx:1.21',
  labels: {},
};

describe('deploymentConfig – columns', () => {
  it('contains expected column keys', () => {
    const keys = deploymentColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('namespace');
    expect(keys).toContain('replicas');
    expect(keys).toContain('ready');
    expect(keys).toContain('image');
  });

  it('has a label on every column', () => {
    for (const col of deploymentColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('deploymentConfig – tabs', () => {
  it('contains expected tab keys', () => {
    const keys = deploymentTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('pods');
    expect(keys).toContain('rollout');
    expect(keys).toContain('logs');
    expect(keys).toContain('events');
    expect(keys).toContain('yaml');
    expect(keys).toContain('holmes');
  });
});

describe('deploymentConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(deploymentConfig.resourceType).toBe('deployment');
    expect(deploymentConfig.resourceKind).toBe('Deployment');
  });
});

describe('renderDeploymentPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick-info', () => {
    const node = renderDeploymentPanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByTestId('quick-info-section')).toBeInTheDocument();
  });

  it('renders pods tab', () => {
    const node = renderDeploymentPanelContent(mockRow, 'pods', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('deployment-pods-tab')).toBeInTheDocument();
  });

  it('renders rollout tab', () => {
    const node = renderDeploymentPanelContent(mockRow, 'rollout', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('deployment-rollout-tab')).toBeInTheDocument();
  });

  it('renders logs tab', () => {
    const node = renderDeploymentPanelContent(mockRow, 'logs', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('aggregate-logs-tab')).toBeInTheDocument();
  });

  it('renders events tab', () => {
    const node = renderDeploymentPanelContent(mockRow, 'events', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('renders yaml tab', () => {
    const node = renderDeploymentPanelContent(mockRow, 'yaml', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('yaml-tab')).toBeInTheDocument();
  });

  it('renders holmes tab', () => {
    const node = renderDeploymentPanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderDeploymentPanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});
