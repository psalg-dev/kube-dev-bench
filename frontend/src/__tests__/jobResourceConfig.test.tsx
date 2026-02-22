import './wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  jobColumns,
  jobTabs,
  renderJobPanelContent,
  jobConfig,
} from '../config/resourceConfigs/jobConfig';

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeJobStream: vi.fn(),
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

vi.mock('../k8s/resources/jobs/JobPodsTab', () => ({
  default: () => <div data-testid="job-pods-tab" />,
}));

vi.mock('../k8s/resources/jobs/JobYamlTab', () => ({
  default: () => <div data-testid="job-yaml-tab" />,
}));

vi.mock('../components/AggregateLogsTab', () => ({
  default: () => <div data-testid="aggregate-logs-tab" />,
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
  name: 'my-job',
  namespace: 'default',
  completions: '1/1',
  succeeded: 1,
  active: 0,
  failed: 0,
  age: '1h',
  duration: '5m',
  image: 'batch-processor:latest',
  labels: {},
};

describe('jobConfig – columns', () => {
  it('contains expected column keys', () => {
    const keys = jobColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('namespace');
    expect(keys).toContain('completions');
    expect(keys).toContain('succeeded');
  });

  it('has a label on every column', () => {
    for (const col of jobColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('jobConfig – tabs', () => {
  it('contains expected tab keys', () => {
    const keys = jobTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('pods');
    expect(keys).toContain('logs');
    expect(keys).toContain('events');
    expect(keys).toContain('yaml');
    expect(keys).toContain('holmes');
  });
});

describe('jobConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(jobConfig.resourceType).toBe('job');
    expect(jobConfig.resourceKind).toBe('Job');
  });
});

describe('renderJobPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick-info', () => {
    const node = renderJobPanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByTestId('quick-info-section')).toBeInTheDocument();
  });

  it('renders pods tab', () => {
    const node = renderJobPanelContent(mockRow, 'pods', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('job-pods-tab')).toBeInTheDocument();
  });

  it('renders logs tab', () => {
    const node = renderJobPanelContent(mockRow, 'logs', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('aggregate-logs-tab')).toBeInTheDocument();
  });

  it('renders events tab', () => {
    const node = renderJobPanelContent(mockRow, 'events', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('renders yaml tab', () => {
    const node = renderJobPanelContent(mockRow, 'yaml', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('job-yaml-tab')).toBeInTheDocument();
  });

  it('renders holmes tab', () => {
    const node = renderJobPanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderJobPanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});
