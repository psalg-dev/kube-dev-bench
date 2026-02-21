import './wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  pvcColumns,
  pvcTabs,
  renderPVCPanelContent,
  pvcConfig,
} from '../config/resourceConfigs/pvcConfig';

vi.mock('../holmes/holmesApi', () => ({
  AnalyzePersistentVolumeClaimStream: vi.fn(),
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

vi.mock('../k8s/resources/persistentvolumeclaims/PVCBoundPVTab', () => ({
  default: () => <div data-testid="pvc-bound-pv-tab" />,
}));

vi.mock('../k8s/resources/persistentvolumeclaims/PVCConsumersTab', () => ({
  default: () => <div data-testid="pvc-consumers-tab" />,
}));

vi.mock('../k8s/resources/persistentvolumeclaims/PersistentVolumeClaimYamlTab', () => ({
  default: () => <div data-testid="pvc-yaml-tab" />,
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
  name: 'my-pvc',
  namespace: 'default',
  status: 'Bound',
  storage: '5Gi',
  accessModes: 'ReadWriteOnce',
  volumeName: 'my-pv',
  age: '3d',
  labels: {},
};

describe('pvcConfig – columns', () => {
  it('contains expected column keys', () => {
    const keys = pvcColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('namespace');
    expect(keys).toContain('status');
    expect(keys).toContain('storage');
    expect(keys).toContain('volumeName');
  });

  it('has a label on every column', () => {
    for (const col of pvcColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('pvcConfig – tabs', () => {
  it('contains expected tab keys', () => {
    const keys = pvcTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('boundpv');
    expect(keys).toContain('consumers');
    expect(keys).toContain('events');
    expect(keys).toContain('yaml');
    expect(keys).toContain('holmes');
  });
});

describe('pvcConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(pvcConfig.resourceType).toBe('persistentvolumeclaim');
    expect(pvcConfig.resourceKind).toBe('PersistentVolumeClaim');
  });
});

describe('renderPVCPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick-info', () => {
    const node = renderPVCPanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByTestId('quick-info-section')).toBeInTheDocument();
  });

  it('renders bound PV tab', () => {
    const node = renderPVCPanelContent(mockRow, 'boundpv', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('pvc-bound-pv-tab')).toBeInTheDocument();
  });

  it('renders consumers tab', () => {
    const node = renderPVCPanelContent(mockRow, 'consumers', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('pvc-consumers-tab')).toBeInTheDocument();
  });

  it('renders events tab', () => {
    const node = renderPVCPanelContent(mockRow, 'events', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('renders yaml tab', () => {
    const node = renderPVCPanelContent(mockRow, 'yaml', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('pvc-yaml-tab')).toBeInTheDocument();
  });

  it('renders holmes tab', () => {
    const node = renderPVCPanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderPVCPanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});
