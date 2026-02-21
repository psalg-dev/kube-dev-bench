import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetSecrets: vi.fn(),
  DeleteResource: vi.fn(),
  GetSecretData: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeSecretStream: vi.fn(),
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
  default: () => <div data-testid="quick-info-section">quick-info</div>,
}));

vi.mock('../k8s/resources/secrets/SecretDataTab', () => ({
  default: ({ secretName }: { secretName: string }) => (
    <div data-testid="secret-data-tab">{secretName}</div>
  ),
}));

vi.mock('../k8s/resources/secrets/SecretConsumersTab', () => ({
  default: ({ secretName }: { secretName: string }) => (
    <div data-testid="secret-consumers-tab">{secretName}</div>
  ),
}));

vi.mock('../k8s/resources/secrets/SecretYamlTab', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="secret-yaml-tab">{name}</div>
  ),
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: ({ kind, name }: { kind: string; name: string }) => (
    <div data-testid="holmes-bottom-panel">{kind}/{name}</div>
  ),
}));

import { renderSecretPanelContent } from '../config/resourceConfigs/secretConfig';

const mockRow: ResourceRow = {
  name: 'test-secret',
  namespace: 'default',
  type: 'Opaque',
  keys: '3',
  size: '1.2 KB',
  age: '90d',
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

describe('secretConfig renderSecretPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header', () => {
    render(<>{renderSecretPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('summary-tab-header')).toHaveTextContent('test-secret');
    expect(screen.getByTestId('quick-info-section')).toBeInTheDocument();
  });

  it('renders resource-actions for secret in summary tab', () => {
    render(<>{renderSecretPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-actions')).toHaveTextContent('secret');
  });

  it('renders data tab', () => {
    render(<>{renderSecretPanelContent(mockRow, 'data', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('secret-data-tab')).toHaveTextContent('test-secret');
  });

  it('renders consumers tab', () => {
    render(<>{renderSecretPanelContent(mockRow, 'consumers', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('secret-consumers-tab')).toHaveTextContent('test-secret');
  });

  it('renders events tab', () => {
    render(<>{renderSecretPanelContent(mockRow, 'events', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-events-tab')).toHaveTextContent('Secret/test-secret');
  });

  it('renders yaml tab', () => {
    render(<>{renderSecretPanelContent(mockRow, 'yaml', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('secret-yaml-tab')).toHaveTextContent('test-secret');
  });

  it('renders holmes tab', () => {
    render(<>{renderSecretPanelContent(mockRow, 'holmes', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toHaveTextContent('Secret/test-secret');
  });

  it('returns null for unknown tab', () => {
    const result = renderSecretPanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn());
    expect(result).toBeNull();
  });
});
