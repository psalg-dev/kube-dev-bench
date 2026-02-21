import './wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  secretColumns,
  secretTabs,
  renderSecretPanelContent,
  secretConfig,
} from '../config/resourceConfigs/secretConfig';

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeSecretStream: vi.fn(),
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

vi.mock('../k8s/resources/secrets/SecretDataTab', () => ({
  default: () => <div data-testid="secret-data-tab" />,
}));

vi.mock('../k8s/resources/secrets/SecretConsumersTab', () => ({
  default: () => <div data-testid="secret-consumers-tab" />,
}));

vi.mock('../k8s/resources/secrets/SecretYamlTab', () => ({
  default: () => <div data-testid="secret-yaml-tab" />,
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
  name: 'my-secret',
  namespace: 'default',
  type: 'Opaque',
  keys: 3,
  size: '512',
  age: '15d',
  labels: {},
};

describe('secretConfig – columns', () => {
  it('contains expected column keys', () => {
    const keys = secretColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('namespace');
    expect(keys).toContain('type');
    expect(keys).toContain('keys');
  });

  it('has a label on every column', () => {
    for (const col of secretColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('secretConfig – tabs', () => {
  it('contains expected tab keys', () => {
    const keys = secretTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('data');
    expect(keys).toContain('consumers');
    expect(keys).toContain('events');
    expect(keys).toContain('yaml');
    expect(keys).toContain('holmes');
  });
});

describe('secretConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(secretConfig.resourceType).toBe('secret');
    expect(secretConfig.resourceKind).toBe('Secret');
  });
});

describe('renderSecretPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick-info', () => {
    const node = renderSecretPanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByTestId('quick-info-section')).toBeInTheDocument();
  });

  it('renders data tab', () => {
    const node = renderSecretPanelContent(mockRow, 'data', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('secret-data-tab')).toBeInTheDocument();
  });

  it('renders consumers tab', () => {
    const node = renderSecretPanelContent(mockRow, 'consumers', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('secret-consumers-tab')).toBeInTheDocument();
  });

  it('renders events tab', () => {
    const node = renderSecretPanelContent(mockRow, 'events', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('renders yaml tab', () => {
    const node = renderSecretPanelContent(mockRow, 'yaml', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('secret-yaml-tab')).toBeInTheDocument();
  });

  it('renders holmes tab', () => {
    const node = renderSecretPanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderSecretPanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});
