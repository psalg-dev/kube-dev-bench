import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetDeployments: vi.fn(),
  DeleteResource: vi.fn(),
  RestartDeployment: vi.fn(),
  GetDeploymentLogs: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeDeploymentStream: vi.fn(),
  onHolmesChatStream: vi.fn(),
  onHolmesContextProgress: vi.fn(),
  CancelHolmesStream: vi.fn(),
}));

vi.mock('../components/ResourceEventsTab', () => ({
  default: ({ kind, name }: { kind: string; name: string }) => (
    <div data-testid="resource-events-tab">{kind}/{name}</div>
  ),
}));

vi.mock('../layout/bottompanel/SummaryTabHeader', () => ({
  default: ({ name, actions }: { name: string; actions?: import('react').ReactNode }) => <div data-testid="summary-tab-header">{name}{actions}</div>,
}));

vi.mock('../components/ResourceActions', () => ({
  default: ({ resourceType }: { resourceType: string }) => (
    <div data-testid="resource-actions">{resourceType}</div>
  ),
}));

vi.mock('../QuickInfoSection', () => ({
  default: ({ resourceName }: { resourceName: string }) => (
    <div data-testid="quick-info-section">{resourceName}</div>
  ),
}));

vi.mock('../k8s/resources/deployments/DeploymentPodsTab', () => ({
  default: ({ deploymentName }: { deploymentName: string }) => (
    <div data-testid="deployment-pods-tab">{deploymentName}</div>
  ),
}));

vi.mock('../k8s/resources/deployments/DeploymentRolloutTab', () => ({
  default: ({ deploymentName }: { deploymentName: string }) => (
    <div data-testid="deployment-rollout-tab">{deploymentName}</div>
  ),
}));

vi.mock('../components/AggregateLogsTab', () => ({
  default: ({ title }: { title: string }) => (
    <div data-testid="aggregate-logs-tab">{title}</div>
  ),
}));

vi.mock('../layout/bottompanel/YamlTab', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="yaml-tab">{content}</div>
  ),
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: ({ kind, name }: { kind: string; name: string }) => (
    <div data-testid="holmes-bottom-panel">{kind}/{name}</div>
  ),
}));

import { renderDeploymentPanelContent } from '../config/resourceConfigs/deploymentConfig';

const mockRow: ResourceRow = {
  name: 'test-deployment',
  namespace: 'default',
  replicas: 3,
  ready: 3,
  available: 3,
  age: '20d',
  image: 'nginx:1.21',
  labels: {},
};

const holmesState: HolmesAnalysisState = {
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

describe('deploymentConfig renderDeploymentPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick info', () => {
    render(<>{renderDeploymentPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('summary-tab-header')).toHaveTextContent('test-deployment');
    expect(screen.getByTestId('quick-info-section')).toHaveTextContent('test-deployment');
  });

  it('renders resource-actions for deployment in summary tab', () => {
    render(<>{renderDeploymentPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-actions')).toHaveTextContent('deployment');
  });

  it('renders pods tab', () => {
    render(<>{renderDeploymentPanelContent(mockRow, 'pods', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('deployment-pods-tab')).toHaveTextContent('test-deployment');
  });

  it('renders rollout tab', () => {
    render(<>{renderDeploymentPanelContent(mockRow, 'rollout', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('deployment-rollout-tab')).toHaveTextContent('test-deployment');
  });

  it('renders logs tab', () => {
    render(<>{renderDeploymentPanelContent(mockRow, 'logs', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('aggregate-logs-tab')).toHaveTextContent('Deployment Logs');
  });

  it('renders events tab', () => {
    render(<>{renderDeploymentPanelContent(mockRow, 'events', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-events-tab')).toHaveTextContent('Deployment/test-deployment');
  });

  it('renders yaml tab with deployment content', () => {
    render(<>{renderDeploymentPanelContent(mockRow, 'yaml', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('yaml-tab')).toHaveTextContent('Deployment');
    expect(screen.getByTestId('yaml-tab')).toHaveTextContent('test-deployment');
  });

  it('renders holmes tab', () => {
    render(<>{renderDeploymentPanelContent(mockRow, 'holmes', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toHaveTextContent('Deployment/test-deployment');
  });

  it('returns null for unknown tab', () => {
    const result = renderDeploymentPanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn());
    expect(result).toBeNull();
  });
});
