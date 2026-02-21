import './wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  pvColumns,
  pvTabs,
  renderPVPanelContent,
  pvConfig,
} from '../config/resourceConfigs/pvConfig';

vi.mock('../holmes/holmesApi', () => ({
  AnalyzePersistentVolumeStream: vi.fn(),
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

vi.mock('../k8s/resources/persistentvolumes/PVBoundPVCTab', () => ({
  default: () => <div data-testid="pv-bound-pvc-tab" />,
}));

vi.mock('../k8s/resources/persistentvolumes/PVAnnotationsTab', () => ({
  default: () => <div data-testid="pv-annotations-tab" />,
}));

vi.mock('../k8s/resources/persistentvolumes/PVCapacityUsageTab', () => ({
  default: () => <div data-testid="pv-capacity-usage-tab" />,
}));

vi.mock('../k8s/resources/persistentvolumes/PersistentVolumeYamlTab', () => ({
  default: () => <div data-testid="pv-yaml-tab" />,
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
  name: 'my-pv',
  namespace: '',
  capacity: '10Gi',
  accessModes: 'ReadWriteOnce',
  reclaimPolicy: 'Retain',
  status: 'Bound',
  claim: 'default/my-pvc',
  storageClass: 'standard',
  volumeType: 'hostPath',
  age: '1d',
  labels: {},
  annotations: {},
};

describe('pvConfig – columns', () => {
  it('contains expected column keys', () => {
    const keys = pvColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('capacity');
    expect(keys).toContain('status');
    expect(keys).toContain('storageClass');
  });

  it('has a label on every column', () => {
    for (const col of pvColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('pvConfig – tabs', () => {
  it('contains expected tab keys', () => {
    const keys = pvTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('boundpvc');
    expect(keys).toContain('annotations');
    expect(keys).toContain('usage');
    expect(keys).toContain('events');
    expect(keys).toContain('yaml');
    expect(keys).toContain('holmes');
  });
});

describe('pvConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(pvConfig.resourceType).toBe('pv');
    expect(pvConfig.resourceKind).toBe('PersistentVolume');
  });

  it('is cluster-scoped', () => {
    expect(pvConfig.clusterScoped).toBe(true);
  });
});

describe('renderPVPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick-info', () => {
    const node = renderPVPanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByTestId('quick-info-section')).toBeInTheDocument();
  });

  it('renders boundpvc tab', () => {
    const node = renderPVPanelContent(mockRow, 'boundpvc', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('pv-bound-pvc-tab')).toBeInTheDocument();
  });

  it('renders annotations tab', () => {
    const node = renderPVPanelContent(mockRow, 'annotations', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('pv-annotations-tab')).toBeInTheDocument();
  });

  it('renders capacity usage tab', () => {
    const node = renderPVPanelContent(mockRow, 'usage', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('pv-capacity-usage-tab')).toBeInTheDocument();
  });

  it('renders events tab', () => {
    const node = renderPVPanelContent(mockRow, 'events', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('renders yaml tab', () => {
    const node = renderPVPanelContent(mockRow, 'yaml', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('pv-yaml-tab')).toBeInTheDocument();
  });

  it('renders holmes tab', () => {
    const node = renderPVPanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderPVPanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});
