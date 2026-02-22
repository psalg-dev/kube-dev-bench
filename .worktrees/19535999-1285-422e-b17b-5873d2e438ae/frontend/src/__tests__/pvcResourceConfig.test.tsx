import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetPersistentVolumeClaims: vi.fn(),
  DeleteResource: vi.fn(),
  GetPVCConsumers: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzePersistentVolumeClaimStream: vi.fn(),
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

vi.mock('../k8s/resources/persistentvolumeclaims/PVCBoundPVTab', () => ({
  default: ({ pvcName }: { pvcName: string }) => (
    <div data-testid="pvc-bound-pv-tab">{pvcName}</div>
  ),
}));

vi.mock('../k8s/resources/persistentvolumeclaims/PVCConsumersTab', () => ({
  default: ({ pvcName }: { pvcName: string }) => (
    <div data-testid="pvc-consumers-tab">{pvcName}</div>
  ),
}));

vi.mock('../k8s/resources/persistentvolumeclaims/PersistentVolumeClaimYamlTab', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="pvc-yaml-tab">{name}</div>
  ),
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: ({ kind, name }: { kind: string; name: string }) => (
    <div data-testid="holmes-bottom-panel">{kind}/{name}</div>
  ),
}));

import { renderPVCPanelContent } from '../config/resourceConfigs/pvcConfig';

const mockRow: ResourceRow = {
  name: 'test-pvc',
  namespace: 'default',
  status: 'Bound',
  storage: '5Gi',
  accessModes: 'ReadWriteOnce',
  volumeName: 'pvc-abc123',
  age: '14d',
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

describe('pvcConfig renderPVCPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick info', () => {
    render(<>{renderPVCPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('summary-tab-header')).toHaveTextContent('test-pvc');
    expect(screen.getByTestId('quick-info-section')).toHaveTextContent('test-pvc');
  });

  it('renders resource-actions for pvc in summary tab', () => {
    render(<>{renderPVCPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-actions')).toHaveTextContent('pvc');
  });

  it('renders boundpv tab', () => {
    render(<>{renderPVCPanelContent(mockRow, 'boundpv', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('pvc-bound-pv-tab')).toHaveTextContent('test-pvc');
  });

  it('renders consumers tab', () => {
    render(<>{renderPVCPanelContent(mockRow, 'consumers', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('pvc-consumers-tab')).toHaveTextContent('test-pvc');
  });

  it('renders events tab', () => {
    render(<>{renderPVCPanelContent(mockRow, 'events', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-events-tab')).toHaveTextContent('PersistentVolumeClaim/test-pvc');
  });

  it('renders yaml tab', () => {
    render(<>{renderPVCPanelContent(mockRow, 'yaml', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('pvc-yaml-tab')).toHaveTextContent('test-pvc');
  });

  it('renders holmes tab', () => {
    render(<>{renderPVCPanelContent(mockRow, 'holmes', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toHaveTextContent('PersistentVolumeClaim/test-pvc');
  });

  it('returns null for unknown tab', () => {
    const result = renderPVCPanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn());
    expect(result).toBeNull();
  });
});
