import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetIngresses: vi.fn(),
  DeleteResource: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeIngressStream: vi.fn(),
  onHolmesChatStream: vi.fn(),
  onHolmesContextProgress: vi.fn(),
  CancelHolmesStream: vi.fn(),
}));

vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
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

vi.mock('../k8s/resources/ingresses/IngressRulesTab', () => ({
  default: ({ ingressName }: { ingressName: string }) => (
    <div data-testid="ingress-rules-tab">{ingressName}</div>
  ),
}));

vi.mock('../k8s/resources/ingresses/IngressTLSTab', () => ({
  default: ({ ingressName }: { ingressName: string }) => (
    <div data-testid="ingress-tls-tab">{ingressName}</div>
  ),
}));

vi.mock('../k8s/resources/ingresses/IngressBackendServicesTab', () => ({
  default: ({ ingressName }: { ingressName: string }) => (
    <div data-testid="ingress-backend-services-tab">{ingressName}</div>
  ),
}));

vi.mock('../k8s/resources/ingresses/IngressYamlTab', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="ingress-yaml-tab">{name}</div>
  ),
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: ({ kind, name }: { kind: string; name: string }) => (
    <div data-testid="holmes-bottom-panel">{kind}/{name}</div>
  ),
}));

import { renderIngressPanelContent } from '../config/resourceConfigs/ingressConfig';

const mockRow: ResourceRow = {
  name: 'test-ingress',
  namespace: 'default',
  class: 'nginx',
  hosts: ['example.com'],
  address: '10.0.0.1',
  ports: '80,443',
  age: '2d',
  tls: [],
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

describe('ingressConfig renderIngressPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick info', () => {
    render(<>{renderIngressPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('summary-tab-header')).toHaveTextContent('test-ingress');
    expect(screen.getByTestId('quick-info-section')).toHaveTextContent('test-ingress');
  });

  it('renders Test Endpoint button in summary tab', () => {
    render(<>{renderIngressPanelContent(mockRow, 'summary', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByRole('button', { name: /test endpoint/i })).toBeInTheDocument();
  });

  it('renders rules tab', () => {
    render(<>{renderIngressPanelContent(mockRow, 'rules', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('ingress-rules-tab')).toHaveTextContent('test-ingress');
  });

  it('renders tls tab', () => {
    render(<>{renderIngressPanelContent(mockRow, 'tls', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('ingress-tls-tab')).toHaveTextContent('test-ingress');
  });

  it('renders services tab', () => {
    render(<>{renderIngressPanelContent(mockRow, 'services', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('ingress-backend-services-tab')).toHaveTextContent('test-ingress');
  });

  it('renders events tab', () => {
    render(<>{renderIngressPanelContent(mockRow, 'events', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('resource-events-tab')).toHaveTextContent('Ingress/test-ingress');
  });

  it('renders yaml tab', () => {
    render(<>{renderIngressPanelContent(mockRow, 'yaml', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('ingress-yaml-tab')).toHaveTextContent('test-ingress');
  });

  it('renders holmes tab', () => {
    render(<>{renderIngressPanelContent(mockRow, 'holmes', holmesState, vi.fn(), vi.fn())}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toHaveTextContent('Ingress/test-ingress');
  });

  it('returns null for unknown tab', () => {
    const result = renderIngressPanelContent(mockRow, 'unknown', holmesState, vi.fn(), vi.fn());
    expect(result).toBeNull();
  });
});
