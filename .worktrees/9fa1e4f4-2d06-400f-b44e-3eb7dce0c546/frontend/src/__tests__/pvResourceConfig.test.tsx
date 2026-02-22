import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn(() => () => {}),
  EventsOff: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzePersistentVolumeStream: vi.fn(),
}));

vi.mock('../k8s/resources/persistentvolumes/PVBoundPVCTab', () => ({
  default: ({ pvName, claim }: { pvName: string; claim: string }) => (
    <div data-testid="pv-bound-pvc-tab">BoundPVC:{pvName}:{claim}</div>
  ),
}));

vi.mock('../k8s/resources/persistentvolumes/PVAnnotationsTab', () => ({
  default: ({ annotations }: { annotations: Record<string, string> }) => (
    <div data-testid="pv-annotations-tab">Annotations:{Object.keys(annotations ?? {}).length}</div>
  ),
}));

vi.mock('../k8s/resources/persistentvolumes/PVCapacityUsageTab', () => ({
  default: ({ pvName }: { pvName: string }) => (
    <div data-testid="pv-capacity-tab">Capacity:{pvName}</div>
  ),
}));

vi.mock('../k8s/resources/persistentvolumes/PersistentVolumeYamlTab', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="pv-yaml-tab">YAML:{name}</div>
  ),
}));

vi.mock('../components/ResourceEventsTab', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="resource-events-tab">Events:{name}</div>
  ),
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: ({ kind, name }: { kind: string; name: string }) => (
    <div data-testid="holmes-panel">Holmes:{kind}:{name}</div>
  ),
}));

vi.mock('../layout/bottompanel/SummaryTabHeader', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="summary-tab-header">Header:{name}</div>
  ),
}));

vi.mock('../components/ResourceActions', () => ({
  default: ({ resourceType }: { resourceType: string }) => (
    <div data-testid="resource-actions">{resourceType}</div>
  ),
}));

import { renderPVPanelContent, normalizePV } from '../config/resourceConfigs/pvConfig';
import type { ResourceRow } from '../types/resourceConfigs';

const makeRow = (overrides: Partial<ResourceRow> = {}): ResourceRow => ({
  name: 'test-pv',
  namespace: '',
  capacity: '10Gi',
  accessModes: 'ReadWriteOnce',
  reclaimPolicy: 'Retain',
  status: 'Available',
  claim: 'default/my-pvc',
  storageClass: 'standard',
  volumeType: 'nfs',
  age: '5d',
  labels: {},
  annotations: {},
  ...overrides,
});

const defaultHolmesState = {
  key: '',
  loading: false,
  response: null,
  error: null,
  streamId: null,
  queryTimestamp: null,
  streamingText: '',
  reasoningText: '',
  toolEvents: [],
  contextSteps: [],
};

const onAnalyze = vi.fn();
const onCancel = vi.fn();

describe('pvConfig – renderPVPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('summary tab renders header and quick info', () => {
    const result = renderPVPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByText(/Header:test-pv/)).toBeInTheDocument();
  });

  it('summary tab renders events section', () => {
    const result = renderPVPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('boundpvc tab renders PVBoundPVCTab', () => {
    const result = renderPVPanelContent(makeRow(), 'boundpvc', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('pv-bound-pvc-tab')).toBeInTheDocument();
    expect(screen.getByText(/BoundPVC:test-pv/)).toBeInTheDocument();
  });

  it('annotations tab renders PVAnnotationsTab', () => {
    const row = makeRow({ annotations: { 'k8s.io/key': 'value' } });
    const result = renderPVPanelContent(row, 'annotations', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('pv-annotations-tab')).toBeInTheDocument();
  });

  it('annotations tab with empty annotations', () => {
    const result = renderPVPanelContent(makeRow({ annotations: {} }), 'annotations', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('pv-annotations-tab')).toBeInTheDocument();
    expect(screen.getByText(/Annotations:0/)).toBeInTheDocument();
  });

  it('usage tab renders PVCapacityUsageTab', () => {
    const result = renderPVPanelContent(makeRow(), 'usage', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('pv-capacity-tab')).toBeInTheDocument();
    expect(screen.getByText(/Capacity:test-pv/)).toBeInTheDocument();
  });

  it('events tab renders ResourceEventsTab', () => {
    const result = renderPVPanelContent(makeRow(), 'events', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('yaml tab renders yaml component', () => {
    const result = renderPVPanelContent(makeRow(), 'yaml', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('pv-yaml-tab')).toBeInTheDocument();
    expect(screen.getByText(/YAML:test-pv/)).toBeInTheDocument();
  });

  it('holmes tab renders HolmesBottomPanel with correct kind', () => {
    const result = renderPVPanelContent(makeRow(), 'holmes', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
    expect(screen.getByText(/Holmes:PersistentVolume:test-pv/)).toBeInTheDocument();
  });

  it('holmes tab uses matching holmesState key', () => {
    const holmesState = { ...defaultHolmesState, key: 'test-pv', response: 'some analysis', loading: false };
    const result = renderPVPanelContent(makeRow(), 'holmes', holmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
  });

  it('unknown tab returns null', () => {
    const result = renderPVPanelContent(makeRow(), 'nonexistent', defaultHolmesState, onAnalyze, onCancel);
    expect(result).toBeNull();
  });
});

describe('normalizePV', () => {
  it('normalizes camelCase fields', () => {
    const row = normalizePV({ name: 'pv1', capacity: '5Gi', accessModes: 'RWO', reclaimPolicy: 'Delete', status: 'Bound', claim: 'ns/pvc', storageClass: 'fast', volumeType: 'local', age: '1d' });
    expect(row.name).toBe('pv1');
    expect(row.capacity).toBe('5Gi');
    expect(row.storageClass).toBe('fast');
  });

  it('normalizes PascalCase fields', () => {
    const row = normalizePV({ Name: 'pv2', Capacity: '20Gi', AccessModes: 'RWX', ReclaimPolicy: 'Retain', Status: 'Available', Claim: '', StorageClass: 'ssd', VolumeType: 'csi', Age: '2d' });
    expect(row.name).toBe('pv2');
    expect(row.capacity).toBe('20Gi');
  });

  it('applies fallback defaults', () => {
    const row = normalizePV({ name: 'pv3' });
    expect(row.capacity).toBe('-');
    expect(row.status).toBe('-');
    expect(row.claim).toBe('-');
    expect(row.labels).toEqual({});
    expect(row.annotations).toEqual({});
  });
});
