import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetPersistentVolumes: vi.fn(),
  DeleteResource: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzePersistentVolumeStream: vi.fn(),
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

vi.mock('../k8s/resources/persistentvolumes/PVBoundPVCTab', () => ({
  default: ({ pvName }: { pvName: string }) => (
    <div data-testid="pv-bound-pvc-tab">{pvName}</div>
  ),
}));

vi.mock('../k8s/resources/persistentvolumes/PVAnnotationsTab', () => ({
  default: () => <div data-testid="pv-annotations-tab">Annotations</div>,
}));

vi.mock('../k8s/resources/persistentvolumes/PVCapacityUsageTab', () => ({
  default: ({ pvName }: { pvName: string }) => (
    <div data-testid="pv-capacity-usage-tab">{pvName}</div>
  ),
}));

vi.mock('../k8s/resources/persistentvolumes/PersistentVolumeYamlTab', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="pv-yaml-tab">{name}</div>
  ),
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: ({ kind, name }: { kind: string; name: string }) => (
    <div data-testid="holmes-bottom-panel">{kind}/{name}</div>
  ),
}));

import { renderPVPanelContent } from '../config/resourceConfigs/pvConfig';

const mockRow: ResourceRow = {
  name: 'test-pv',
  namespace: '',
  capacity: '10Gi',
  accessModes: 'ReadWriteOnce',
  reclaimPolicy: 'Retain',
  status: 'Available',
  claim: '-',
  storageClass: 'standard',
  volumeType: 'nfs',
  age: '5d',
  labels: {},
  annotations: {},
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

describe('pvConfig renderPVPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick info', () => {
    render(<>{renderPVPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('summary-tab-header')).toHaveTextContent('test-pv');
    expect(screen.getByTestId('quick-info-section')).toHaveTextContent('test-pv');
  });

  it('renders resource-actions for pv in summary tab', () => {
    render(<>{renderPVPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-actions')).toHaveTextContent('pv');
  });

  it('renders boundpvc tab', () => {
    render(<>{renderPVPanelContent(mockRow, 'boundpvc', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('pv-bound-pvc-tab')).toHaveTextContent('test-pv');
  });

  it('renders annotations tab', () => {
    render(<>{renderPVPanelContent(mockRow, 'annotations', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('pv-annotations-tab')).toBeInTheDocument();
  });

  it('renders usage tab', () => {
    render(<>{renderPVPanelContent(mockRow, 'usage', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('pv-capacity-usage-tab')).toHaveTextContent('test-pv');
  });

  it('renders events tab', () => {
    render(<>{renderPVPanelContent(mockRow, 'events', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-events-tab')).toHaveTextContent('PersistentVolume/test-pv');
  });

  it('renders yaml tab', () => {
    render(<>{renderPVPanelContent(mockRow, 'yaml', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('pv-yaml-tab')).toHaveTextContent('test-pv');
  });

  it('renders holmes tab', () => {
    render(<>{renderPVPanelContent(mockRow, 'holmes', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toHaveTextContent('PersistentVolume/test-pv');
  });

  it('returns null for unknown tab', () => {
    const result = renderPVPanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn());
    expect(result).toBeNull();
  });
});
