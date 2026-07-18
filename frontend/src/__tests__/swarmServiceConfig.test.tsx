import '../__tests__/wailsMocks';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HolmesAnalysisState } from '../hooks/useHolmesAnalysis';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  swarmServiceColumns,
  swarmServiceTabs,
  renderSwarmServicePanelContent,
  swarmServiceConfig,
  getSwarmServiceRowActions,
} from '../config/resourceConfigs/swarm/serviceConfig';

vi.mock('../docker/swarmApi', () => ({
  GetSwarmServices: vi.fn(),
  GetSwarmServiceLogs: vi.fn(),
  GetSwarmTasksByService: vi.fn(),
  RemoveSwarmService: vi.fn(),
  RestartSwarmService: vi.fn(),
  ScaleSwarmService: vi.fn(),
}));

vi.mock('../holmes/holmesApi', () => ({
  AnalyzeSwarmServiceStream: vi.fn(),
  CancelHolmesStream: vi.fn(),
  onHolmesChatStream: vi.fn(() => vi.fn()),
  onHolmesContextProgress: vi.fn(() => vi.fn()),
}));

vi.mock('../docker/resources/services/ServiceSummaryPanel', () => ({
  default: ({ row }: { row: ResourceRow }) => (
    <div data-testid="service-summary-panel">{String(row.name ?? '')}</div>
  ),
}));

vi.mock('../docker/resources/services/ServiceTasksTab', () => ({
  default: ({ serviceId }: { serviceId: string }) => (
    <div data-testid="service-tasks-tab">{serviceId}</div>
  ),
}));

vi.mock('../docker/resources/services/ServicePlacementTab', () => ({
  default: () => <div data-testid="service-placement-tab" />,
}));

vi.mock('../components/AggregateLogsTab', () => ({
  default: () => <div data-testid="aggregate-logs-tab" />,
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: () => <div data-testid="holmes-bottom-panel" />,
}));

vi.mock('../docker/resources/services/ImageUpdateBadge', () => ({
  ImageUpdateBadge: ({ value }: { value: unknown }) => (
    <button type="button">{String(value ?? 'no-update')}</button>
  ),
}));

vi.mock('../components/BaseModal', () => ({
  __esModule: true,
  BaseModal: ({ isOpen, onClose, title, children, footer }: { isOpen: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="modal-wrapper">
        <div data-testid="modal-title">{title}</div>
        <div data-testid="modal-content">{children}</div>
        {footer && <div data-testid="modal-footer">{footer}</div>}
        <button data-testid="modal-close" onClick={onClose}>Close</button>
      </div>
    );
  },
  default: ({ isOpen, onClose, title, children, footer }: { isOpen: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="modal-wrapper">
        <div data-testid="modal-title">{title}</div>
        <div data-testid="modal-content">{children}</div>
        {footer && <div data-testid="modal-footer">{footer}</div>}
        <button data-testid="modal-close" onClick={onClose}>Close</button>
      </div>
    );
  },
  ModalButton: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <button data-testid="modal-btn" {...props}>{children}</button>,
  ModalPrimaryButton: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <button data-testid="modal-primary-btn" {...props}>{children}</button>,
  ModalDangerButton: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <button data-testid="modal-danger-btn" {...props}>{children}</button>,
}));

vi.mock('../notification', () => ({
  __esModule: true,
  showError: vi.fn(),
  showSuccess: vi.fn(),
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
  id: 'svc-1',
  name: 'my-service',
  image: 'nginx:latest',
  mode: 'replicated',
  replicas: 2,
  runningTasks: 2,
  ports: [],
  createdAt: '2024-01-01T00:00:00Z',
  labels: {},
};

describe('swarmServiceConfig – columns', () => {
  it('has the expected column keys', () => {
    const keys = swarmServiceColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('image');
    expect(keys).toContain('mode');
    expect(keys).toContain('replicas');
    expect(keys).toContain('ports');
    expect(keys).toContain('createdAt');
  });

  it('has labels on all columns', () => {
    for (const col of swarmServiceColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('swarmServiceConfig – tabs', () => {
  it('has the expected tab keys', () => {
    const keys = swarmServiceTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('tasks');
    expect(keys).toContain('placement');
    expect(keys).toContain('logs');
    expect(keys).toContain('holmes');
  });
});

describe('swarmServiceConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(swarmServiceConfig.resourceType).toBe('swarm-service');
    expect(swarmServiceConfig.resourceKind).toBe('Service');
  });
});

describe('renderSwarmServicePanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab without crashing', () => {
    const node = renderSwarmServicePanelContent(mockRow, 'summary', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('service-summary-panel')).toBeInTheDocument();
  });

  it('renders tasks tab without crashing', () => {
    const node = renderSwarmServicePanelContent(mockRow, 'tasks', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('service-tasks-tab')).toBeInTheDocument();
  });

  it('renders placement tab without crashing', () => {
    const node = renderSwarmServicePanelContent(mockRow, 'placement', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('service-placement-tab')).toBeInTheDocument();
  });

  it('renders logs tab without crashing', () => {
    const node = renderSwarmServicePanelContent(mockRow, 'logs', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('aggregate-logs-tab')).toBeInTheDocument();
  });

  it('renders holmes tab without crashing', () => {
    const node = renderSwarmServicePanelContent(mockRow, 'holmes', mockHolmesState, vi.fn(), vi.fn());
    render(<>{node}</>);
    expect(screen.getByTestId('holmes-bottom-panel')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderSwarmServicePanelContent(mockRow, 'unknown', mockHolmesState, vi.fn(), vi.fn());
    expect(node).toBeNull();
  });
});

describe('getSwarmServiceRowActions – scale dialog', () => {
  const mockPanelApi = { openDetails: vi.fn(), setActiveTab: vi.fn(), refresh: vi.fn() };
  const mockHolmesHelpers = {
    holmesState: { loading: false, response: null, error: null, key: null, streamId: null, streamingText: '', reasoningText: '', queryTimestamp: null, contextSteps: [], toolEvents: [] },
    analyze: vi.fn(),
    cancel: vi.fn()
  };

  it('does NOT use window.prompt for scale action', () => {
    const windowPromptSpy = vi.spyOn(window, 'prompt');
    const actions = getSwarmServiceRowActions(mockRow, mockPanelApi, mockHolmesHelpers);
    const scaleAction = actions.find((a) => a.label === 'Scale…');
    expect(scaleAction).toBeDefined();
    expect(windowPromptSpy).not.toHaveBeenCalled();
    windowPromptSpy.mockRestore();
  });
});

describe('getSwarmServiceRowActions – delete dialog', () => {
  const mockPanelApi = { openDetails: vi.fn(), setActiveTab: vi.fn(), refresh: vi.fn() };
  const mockHolmesHelpers = {
    holmesState: { loading: false, response: null, error: null, key: null, streamId: null, streamingText: '', reasoningText: '', queryTimestamp: null, contextSteps: [], toolEvents: [] },
    analyze: vi.fn(),
    cancel: vi.fn()
  };

  it('does NOT use window.confirm for delete action', () => {
    const windowConfirmSpy = vi.spyOn(window, 'confirm');
    const actions = getSwarmServiceRowActions(mockRow, mockPanelApi, mockHolmesHelpers);
    const deleteAction = actions.find((a) => a.label === 'Delete');
    expect(deleteAction).toBeDefined();
    expect(windowConfirmSpy).not.toHaveBeenCalled();
    windowConfirmSpy.mockRestore();
  });
});
