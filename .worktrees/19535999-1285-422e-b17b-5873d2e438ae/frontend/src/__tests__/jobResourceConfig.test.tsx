import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetJobs: vi.fn(),
  DeleteResource: vi.fn(),
  GetJobLogs: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeJobStream: vi.fn(),
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

vi.mock('../components/AggregateLogsTab', () => ({
  default: ({ title }: { title: string }) => (
    <div data-testid="aggregate-logs-tab">{title}</div>
  ),
}));

vi.mock('../k8s/resources/jobs/JobPodsTab', () => ({
  default: ({ jobName }: { jobName: string }) => (
    <div data-testid="job-pods-tab">{jobName}</div>
  ),
}));

vi.mock('../k8s/resources/jobs/JobYamlTab', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="job-yaml-tab">{name}</div>
  ),
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: ({ kind, name }: { kind: string; name: string }) => (
    <div data-testid="holmes-bottom-panel">{kind}/{name}</div>
  ),
}));

import { renderJobPanelContent } from '../config/resourceConfigs/jobConfig';

const mockRow: ResourceRow = {
  name: 'test-job',
  namespace: 'default',
  completions: 1,
  succeeded: 1,
  active: 0,
  failed: 0,
  age: '1d',
  duration: '5m',
  image: 'busybox:latest',
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

describe('jobConfig renderJobPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick info', () => {
    render(<>{renderJobPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('summary-tab-header')).toHaveTextContent('test-job');
    expect(screen.getByTestId('quick-info-section')).toHaveTextContent('test-job');
  });

  it('renders resource-actions for job in summary tab', () => {
    render(<>{renderJobPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-actions')).toHaveTextContent('job');
  });

  it('renders pods tab', () => {
    render(<>{renderJobPanelContent(mockRow, 'pods', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('job-pods-tab')).toHaveTextContent('test-job');
  });

  it('renders logs tab', () => {
    render(<>{renderJobPanelContent(mockRow, 'logs', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('aggregate-logs-tab')).toHaveTextContent('Job Logs');
  });

  it('renders events tab', () => {
    render(<>{renderJobPanelContent(mockRow, 'events', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-events-tab')).toHaveTextContent('Job/test-job');
  });

  it('renders yaml tab', () => {
    render(<>{renderJobPanelContent(mockRow, 'yaml', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('job-yaml-tab')).toHaveTextContent('test-job');
  });

  it('renders holmes tab', () => {
    render(<>{renderJobPanelContent(mockRow, 'holmes', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toHaveTextContent('Job/test-job');
  });

  it('returns null for unknown tab', () => {
    const result = renderJobPanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn());
    expect(result).toBeNull();
  });
});
