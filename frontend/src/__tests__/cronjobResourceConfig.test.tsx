import './wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  cronjobColumns,
  cronjobTabs,
  renderCronJobPanelContent,
  cronjobConfig,
} from '../config/resourceConfigs/cronjobConfig';

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeCronJobStream: vi.fn(),
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

vi.mock('../k8s/resources/cronjobs/CronJobHistoryTab', () => ({
  default: () => <div data-testid="cronjob-history-tab" />,
}));

vi.mock('../k8s/resources/cronjobs/CronJobActionsTab', () => ({
  default: () => <div data-testid="cronjob-actions-tab" />,
}));

vi.mock('../k8s/resources/cronjobs/CronJobNextRunsTab', () => ({
  default: () => <div data-testid="cronjob-nextruns-tab" />,
}));

vi.mock('../k8s/resources/cronjobs/CronJobYamlTab', () => ({
  default: () => <div data-testid="cronjob-yaml-tab" />,
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
  name: 'my-cronjob',
  namespace: 'default',
  schedule: '0 * * * *',
  suspend: false,
  nextRun: '2024-01-01T01:00:00Z',
  age: '30d',
  image: 'batch:latest',
  labels: {},
};

describe('cronjobConfig – columns', () => {
  it('contains expected column keys', () => {
    const keys = cronjobColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('namespace');
    expect(keys).toContain('schedule');
    expect(keys).toContain('nextRun');
  });

  it('has a label on every column', () => {
    for (const col of cronjobColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('cronjobConfig – tabs', () => {
  it('contains expected tab keys', () => {
    const keys = cronjobTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('history');
    expect(keys).toContain('nextruns');
    expect(keys).toContain('actions');
    expect(keys).toContain('events');
    expect(keys).toContain('yaml');
    expect(keys).toContain('holmes');
  });
});

describe('cronjobConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(cronjobConfig.resourceType).toBe('cronjob');
    expect(cronjobConfig.resourceKind).toBe('CronJob');
  });
});

describe('renderCronJobPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick-info', () => {
    const node = renderCronJobPanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByTestId('quick-info-section')).toBeInTheDocument();
  });

  it('renders history tab', () => {
    const node = renderCronJobPanelContent(mockRow, 'history', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('cronjob-history-tab')).toBeInTheDocument();
  });

  it('renders next runs tab', () => {
    const node = renderCronJobPanelContent(mockRow, 'nextruns', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('cronjob-nextruns-tab')).toBeInTheDocument();
  });

  it('renders actions tab', () => {
    const node = renderCronJobPanelContent(mockRow, 'actions', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('cronjob-actions-tab')).toBeInTheDocument();
  });

  it('renders events tab', () => {
    const node = renderCronJobPanelContent(mockRow, 'events', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('renders yaml tab', () => {
    const node = renderCronJobPanelContent(mockRow, 'yaml', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('cronjob-yaml-tab')).toBeInTheDocument();
  });

  it('renders holmes tab', () => {
    const node = renderCronJobPanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderCronJobPanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});
