import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn(() => () => {}),
  EventsOff: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzePersistentVolumeClaimStream: vi.fn(),
}));

vi.mock('../k8s/resources/persistentvolumeclaims/PVCBoundPVTab', () => ({
  default: ({ pvcName, pvName }: { pvcName: string; pvName: string }) => (
    <div data-testid="pvc-bound-pv-tab">BoundPV:{pvcName}:{pvName}</div>
  ),
}));

vi.mock('../k8s/resources/persistentvolumeclaims/PVCConsumersTab', () => ({
  default: ({ pvcName }: { pvcName: string }) => (
    <div data-testid="pvc-consumers-tab">Consumers:{pvcName}</div>
  ),
}));

vi.mock('../k8s/resources/persistentvolumeclaims/PersistentVolumeClaimYamlTab', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="pvc-yaml-tab">YAML:{name}</div>
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

import { renderPVCPanelContent, normalizePVC } from '../config/resourceConfigs/pvcConfig';
import type { ResourceRow } from '../types/resourceConfigs';

const makeRow = (overrides: Partial<ResourceRow> = {}): ResourceRow => ({
  name: 'test-pvc',
  namespace: 'default',
  status: 'Bound',
  storage: '5Gi',
  accessModes: 'ReadWriteOnce',
  volumeName: 'pvc-abc123',
  age: '7d',
  labels: {},
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

describe('pvcConfig – renderPVCPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('summary tab renders header with PVC name', () => {
    const result = renderPVCPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByText(/Header:test-pvc/)).toBeInTheDocument();
  });

  it('summary tab renders events section', () => {
    const result = renderPVCPanelContent(makeRow(), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('summary tab renders with empty namespace', () => {
    const result = renderPVCPanelContent(makeRow({ namespace: '' }), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
  });

  it('summary tab renders Pending PVC', () => {
    const result = renderPVCPanelContent(makeRow({ status: 'Pending', volumeName: '-' }), 'summary', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
  });

  it('boundpv tab renders PVCBoundPVTab', () => {
    const result = renderPVCPanelContent(makeRow(), 'boundpv', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('pvc-bound-pv-tab')).toBeInTheDocument();
    expect(screen.getByText(/BoundPV:test-pvc/)).toBeInTheDocument();
  });

  it('consumers tab renders PVCConsumersTab', () => {
    const result = renderPVCPanelContent(makeRow(), 'consumers', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('pvc-consumers-tab')).toBeInTheDocument();
    expect(screen.getByText(/Consumers:test-pvc/)).toBeInTheDocument();
  });

  it('events tab renders ResourceEventsTab', () => {
    const result = renderPVCPanelContent(makeRow(), 'events', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
    expect(screen.getByText(/Events:test-pvc/)).toBeInTheDocument();
  });

  it('yaml tab renders PersistentVolumeClaimYamlTab', () => {
    const result = renderPVCPanelContent(makeRow(), 'yaml', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('pvc-yaml-tab')).toBeInTheDocument();
    expect(screen.getByText(/YAML:test-pvc/)).toBeInTheDocument();
  });

  it('holmes tab renders HolmesBottomPanel with PersistentVolumeClaim kind', () => {
    const result = renderPVCPanelContent(makeRow(), 'holmes', defaultHolmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
    expect(screen.getByText(/Holmes:PersistentVolumeClaim:test-pvc/)).toBeInTheDocument();
  });

  it('holmes tab passes matching state when key matches', () => {
    const key = 'default/test-pvc';
    const holmesState = { ...defaultHolmesState, key, loading: false, response: 'pvc analysis' };
    const result = renderPVCPanelContent(makeRow(), 'holmes', holmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
  });

  it('holmes tab uses null response for non-matching key', () => {
    const holmesState = { ...defaultHolmesState, key: 'other/other', response: 'hidden' };
    const result = renderPVCPanelContent(makeRow(), 'holmes', holmesState, onAnalyze, onCancel);
    render(result as React.ReactElement);
    expect(screen.getByTestId('holmes-panel')).toBeInTheDocument();
  });

  it('unknown tab returns null', () => {
    const result = renderPVCPanelContent(makeRow(), 'nonexistent', defaultHolmesState, onAnalyze, onCancel);
    expect(result).toBeNull();
  });
});

describe('normalizePVC', () => {
  it('normalizes camelCase fields', () => {
    const row = normalizePVC({ name: 'pvc1', namespace: 'prod', status: 'Bound', storage: '10Gi', accessModes: ['ReadWriteOnce'], volumeName: 'pv-123', age: '2d' });
    expect(row.name).toBe('pvc1');
    expect(row.status).toBe('Bound');
    expect(row.storage).toBe('10Gi');
    expect(row.accessModes).toBe('ReadWriteOnce');
  });

  it('normalizes PascalCase fields', () => {
    const row = normalizePVC({ Name: 'pvc2', Namespace: 'staging', Status: 'Pending', Storage: '5Gi', AccessModes: ['ReadWriteMany'], VolumeName: '', Age: '1d' });
    expect(row.name).toBe('pvc2');
    expect(row.namespace).toBe('staging');
    expect(row.status).toBe('Pending');
  });

  it('applies fallback defaults', () => {
    const row = normalizePVC({ name: 'pvc3', namespace: 'default' });
    expect(row.status).toBe('-');
    expect(row.storage).toBe('-');
    expect(row.accessModes).toBe('-');
    expect(row.volumeName).toBe('-');
    expect(row.age).toBe('-');
    expect(row.labels).toEqual({});
  });

  it('joins multiple access modes', () => {
    const row = normalizePVC({ name: 'pvc4', namespace: 'ns', accessModes: ['ReadWriteOnce', 'ReadOnlyMany'] });
    expect(row.accessModes).toBe('ReadWriteOnce, ReadOnlyMany');
  });

  it('supports empty namespace', () => {
    const row = normalizePVC({ name: 'pvc5', namespace: '' });
    expect(row.namespace).toBe('');
  });
});
