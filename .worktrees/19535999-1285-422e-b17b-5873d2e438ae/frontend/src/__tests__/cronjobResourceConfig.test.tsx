import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetCronJobs: vi.fn(),
  DeleteResource: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeCronJobStream: vi.fn(),
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

vi.mock('../k8s/resources/cronjobs/CronJobHistoryTab', () => ({
  default: ({ cronJobName }: { cronJobName: string }) => (
    <div data-testid="cronjob-history-tab">{cronJobName}</div>
  ),
}));

vi.mock('../k8s/resources/cronjobs/CronJobNextRunsTab', () => ({
  default: ({ cronJobName }: { cronJobName: string }) => (
    <div data-testid="cronjob-nextruns-tab">{cronJobName}</div>
  ),
}));

vi.mock('../k8s/resources/cronjobs/CronJobActionsTab', () => ({
  default: ({ cronJobName }: { cronJobName: string }) => (
    <div data-testid="cronjob-actions-tab">{cronJobName}</div>
  ),
}));

vi.mock('../k8s/resources/cronjobs/CronJobYamlTab', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="cronjob-yaml-tab">{name}</div>
  ),
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: ({ kind, name }: { kind: string; name: string }) => (
    <div data-testid="holmes-bottom-panel">{kind}/{name}</div>
  ),
}));

import { renderCronJobPanelContent } from '../config/resourceConfigs/cronjobConfig';

const mockRow: ResourceRow = {
  name: 'test-cronjob',
  namespace: 'default',
  schedule: '0 * * * *',
  suspend: false,
  nextRun: '2h',
  age: '30d',
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

describe('cronjobConfig renderCronJobPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick info', () => {
    render(<>{renderCronJobPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('summary-tab-header')).toHaveTextContent('test-cronjob');
    expect(screen.getByTestId('quick-info-section')).toHaveTextContent('test-cronjob');
  });

  it('renders resource-actions for cronjob in summary tab', () => {
    render(<>{renderCronJobPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-actions')).toHaveTextContent('cronjob');
  });

  it('renders history tab', () => {
    render(<>{renderCronJobPanelContent(mockRow, 'history', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('cronjob-history-tab')).toHaveTextContent('test-cronjob');
  });

  it('renders nextruns tab', () => {
    render(<>{renderCronJobPanelContent(mockRow, 'nextruns', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('cronjob-nextruns-tab')).toHaveTextContent('test-cronjob');
  });

  it('renders actions tab', () => {
    render(<>{renderCronJobPanelContent(mockRow, 'actions', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('cronjob-actions-tab')).toHaveTextContent('test-cronjob');
  });

  it('renders events tab', () => {
    render(<>{renderCronJobPanelContent(mockRow, 'events', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-events-tab')).toHaveTextContent('CronJob/test-cronjob');
  });

  it('renders yaml tab', () => {
    render(<>{renderCronJobPanelContent(mockRow, 'yaml', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('cronjob-yaml-tab')).toHaveTextContent('test-cronjob');
  });

  it('renders holmes tab', () => {
    render(<>{renderCronJobPanelContent(mockRow, 'holmes', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toHaveTextContent('CronJob/test-cronjob');
  });

  it('returns null for unknown tab', () => {
    const result = renderCronJobPanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn());
    expect(result).toBeNull();
  });
});
