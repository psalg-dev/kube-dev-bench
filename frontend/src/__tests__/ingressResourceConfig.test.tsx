import './wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  ingressColumns,
  ingressTabs,
  renderIngressPanelContent,
  ingressConfig,
} from '../config/resourceConfigs/ingressConfig';

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeIngressStream: vi.fn(),
  CancelHolmesStream: vi.fn(),
  onHolmesChatStream: vi.fn(() => vi.fn()),
  onHolmesContextProgress: vi.fn(() => vi.fn()),
}));

vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
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

vi.mock('../k8s/resources/ingresses/IngressRulesTab', () => ({
  default: () => <div data-testid="ingress-rules-tab" />,
}));

vi.mock('../k8s/resources/ingresses/IngressTLSTab', () => ({
  default: () => <div data-testid="ingress-tls-tab" />,
}));

vi.mock('../k8s/resources/ingresses/IngressBackendServicesTab', () => ({
  default: () => <div data-testid="ingress-backend-services-tab" />,
}));

vi.mock('../k8s/resources/ingresses/IngressYamlTab', () => ({
  default: () => <div data-testid="ingress-yaml-tab" />,
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
  name: 'my-ingress',
  namespace: 'default',
  class: 'nginx',
  hosts: ['example.com'],
  address: '192.168.1.1',
  ports: '80, 443',
  age: '2d',
  tls: [],
  labels: {},
};

describe('ingressConfig – columns', () => {
  it('contains expected column keys', () => {
    const keys = ingressColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('namespace');
    expect(keys).toContain('hosts');
    expect(keys).toContain('class');
  });

  it('has a label on every column', () => {
    for (const col of ingressColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('ingressConfig – tabs', () => {
  it('contains expected tab keys', () => {
    const keys = ingressTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('rules');
    expect(keys).toContain('tls');
    expect(keys).toContain('services');
    expect(keys).toContain('events');
    expect(keys).toContain('yaml');
    expect(keys).toContain('holmes');
  });
});

describe('ingressConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(ingressConfig.resourceType).toBe('ingress');
    expect(ingressConfig.resourceKind).toBe('Ingress');
  });
});

describe('renderIngressPanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab with header and quick-info', () => {
    const node = renderIngressPanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByTestId('quick-info-section')).toBeInTheDocument();
  });

  it('renders rules tab', () => {
    const node = renderIngressPanelContent(mockRow, 'rules', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('ingress-rules-tab')).toBeInTheDocument();
  });

  it('renders tls tab', () => {
    const node = renderIngressPanelContent(mockRow, 'tls', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('ingress-tls-tab')).toBeInTheDocument();
  });

  it('renders backend services tab', () => {
    const node = renderIngressPanelContent(mockRow, 'services', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('ingress-backend-services-tab')).toBeInTheDocument();
  });

  it('renders events tab', () => {
    const node = renderIngressPanelContent(mockRow, 'events', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('resource-events-tab')).toBeInTheDocument();
  });

  it('renders yaml tab', () => {
    const node = renderIngressPanelContent(mockRow, 'yaml', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('ingress-yaml-tab')).toBeInTheDocument();
  });

  it('renders holmes tab', () => {
    const node = renderIngressPanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderIngressPanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});
