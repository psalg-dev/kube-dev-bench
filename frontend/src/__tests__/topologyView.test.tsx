import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { docker, topology } from '../../wailsjs/go/models';

vi.mock('../docker/swarmApi', () => ({
  GetClusterTopology: vi.fn(),
  GetSwarmNode: vi.fn(),
  GetSwarmService: vi.fn(),
  GetSwarmServiceLogs: vi.fn(),
}));

type ReactFlowProps = {
  nodes?: unknown[];
  onNodeClick?: (_: unknown, _node: unknown) => void;
  children?: ReactNode;
};
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes = [], onNodeClick, children }: ReactFlowProps) => (
    <div data-testid="reactflow">
      {nodes.map((node) => (
        <button key={node.id} type="button" onClick={() => onNodeClick?.({}, node)}>
          {node.data?.label}
        </button>
      ))}
      {children}
    </div>
  ),
  Background: () => <div data-testid="graph-bg" />,
  Controls: () => <div data-testid="graph-controls" />,
  MiniMap: () => <div data-testid="graph-minimap" />,
  MarkerType: { ArrowClosed: 'arrowclosed' },
}));

vi.mock('../layout/bottompanel/BottomPanel', () => ({
  default: ({ open, tabs, activeTab, onTabChange, onClose, children }: {
    open: boolean;
    tabs?: Array<{ key: string; label: string }>;
    activeTab?: string;
    onTabChange: (_key: string) => void;
    onClose: () => void;
    children?: React.ReactNode;
  }) => {
    if (!open) return null;
    return (
      <div className="bottom-panel" data-testid="bottom-panel">
        <div data-testid="bottom-panel-tabs">
          {(tabs || []).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTabChange(t.key)}
              aria-pressed={activeTab === t.key}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose}>Close</button>
        <div data-testid="bottom-panel-content">{children}</div>
      </div>
    );
  },
}));
vi.mock('../layout/bottompanel/TextViewerTab', () => ({
  default: ({ content, loading, error, loadingLabel }: {
    content?: string | null;
    loading: boolean;
    error?: string | Error | null;
    loadingLabel?: string;
  }) => (
    <div data-testid="text-viewer">
      <div>loading:{String(loading)}</div>
      <div>error:{error ? String(error) : ''}</div>
      <div>label:{loadingLabel}</div>
      <pre>{String(content ?? '')}</pre>
    </div>
  ),
}));

vi.mock('../docker/resources/nodes/NodeTasksTab', () => ({
  default: ({ nodeId }: { nodeId: string }) => <div data-testid="node-tasks">NodeTasks:{nodeId}</div>,
}));

vi.mock('../docker/resources/nodes/NodeLogsTab', () => ({
  default: ({ nodeId }: { nodeId: string }) => <div data-testid="node-logs">NodeLogs:{nodeId}</div>,
}));

vi.mock('../docker/resources/nodes/NodeLabelsTab', () => ({
  default: ({ nodeId, onSaved }: { nodeId: string; onSaved: () => void }) => (
    <div data-testid="node-labels">
      <div>NodeLabels:{nodeId}</div>
      <button type="button" onClick={onSaved}>TriggerSaved</button>
    </div>
  ),
}));

vi.mock('../docker/resources/services/ServiceTasksTab', () => ({
  default: ({ serviceId }: { serviceId: string }) => <div data-testid="service-tasks">ServiceTasks:{serviceId}</div>,
}));

function mockTopology() {
  return {
    timestamp: '2026-01-11 12:00:00',
    nodes: [
      { id: 'n1', hostname: 'node-1', role: 'manager', state: 'Ready', taskCount: 2 },
      { id: 'n2', hostname: 'node-2', role: 'worker', state: 'Down', taskCount: 0 },
    ],
    services: [
      { id: 's1', name: 'svc-1', mode: 'replicated', runningTasks: 1, taskCount: 1 },
    ],
    links: [
      { from: 's1', to: 'n1', weight: 5 },
    ],
  };
}

describe('TopologyView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders topology and opens node details panel', async () => {
    const swarmApi = vi.mocked(await import('../docker/swarmApi'));
    swarmApi.GetClusterTopology.mockResolvedValueOnce(mockTopology() as unknown as topology.ClusterTopology);
    swarmApi.GetSwarmNode.mockResolvedValue({
      id: 'n1',
      hostname: 'node-1',
      role: 'manager',
      leader: true,
      availability: 'active',
      state: 'Ready',
      address: '10.0.0.1',
      engineVersion: '25.0',
      os: 'linux',
      arch: 'amd64',
      nanoCpus: 2e9,
      memoryBytes: 1024 * 1024 * 1024,
      labels: { a: 'b' },
    } as unknown as docker.SwarmNodeInfo);

    const { default: TopologyView } = await import('../docker/topology/TopologyView');

    const { container } = render(<TopologyView />);

    expect(await screen.findAllByTestId('topology-node-item')).not.toHaveLength(0);
    expect(await screen.findAllByTestId('topology-service-item')).not.toHaveLength(0);

    // Graph node markers include state classes (Ready / Down).
    const readyMarkers = container.querySelectorAll('.topologyGraphNodeDot--ready');
    const downMarkers = container.querySelectorAll('.topologyGraphNodeDot--down');
    expect(readyMarkers.length).toBeGreaterThan(0);
    expect(downMarkers.length).toBeGreaterThan(0);

    const nodeButtons = screen.getAllByTestId('topology-node-item');
    fireEvent.click(nodeButtons[0]);

    expect(await screen.findByTestId('bottom-panel')).toBeInTheDocument();

    // Node summary loads and formats capacity values.
    expect(await screen.findByText('Quick info')).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('1.00 GiB')).toBeInTheDocument();
    expect(screen.getByText('2.00 cores')).toBeInTheDocument();

    // Switch tabs to Labels and trigger a saved event to force reload.
    const tabs = within(screen.getByTestId('bottom-panel-tabs'));
    fireEvent.click(tabs.getByRole('button', { name: 'Labels' }));
    expect(await screen.findByTestId('node-labels')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'TriggerSaved' }));

    // Re-loads node details on saved.
    await waitFor(() => {
      expect(swarmApi.GetSwarmNode).toHaveBeenCalledTimes(2);
    });

    // Wait for the reloaded summary to settle before closing.
    fireEvent.click(tabs.getByRole('button', { name: 'Summary' }));
    expect(await screen.findByText('Memory')).toBeInTheDocument();

    // Close via explicit panel action to avoid key-event timing flakiness.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByTestId('bottom-panel')).not.toBeInTheDocument();
    });
  });

  it('opens service details and loads logs (masked env + mount formatting)', async () => {
    const swarmApi = vi.mocked(await import('../docker/swarmApi'));
    swarmApi.GetClusterTopology.mockResolvedValueOnce(mockTopology() as unknown as topology.ClusterTopology);
    swarmApi.GetSwarmService.mockResolvedValueOnce({
      id: 's1',
      name: 'svc-1',
      mode: 'replicated',
      replicas: 2,
      runningTasks: 1,
      createdAt: '2026-01-11T12:00:00Z',
      image: 'nginx:latest',
      ports: [{ publishedPort: 8080, targetPort: 80, protocol: 'tcp', publishMode: 'ingress' }],
      env: ['PASSWORD=secret', 'EMPTY='],
      mounts: [{ type: 'bind', source: '/a', target: '/b', readOnly: true }],
      resources: {
        limits: { nanoCpus: 1e9, memoryBytes: 1024 },
        reservations: { nanoCpus: 2e9, memoryBytes: 2048 },
      },
      labels: { team: 'core' },
    } as unknown as docker.SwarmServiceInfo);
    swarmApi.GetSwarmServiceLogs.mockResolvedValue('hello logs');

    const { default: TopologyView } = await import('../docker/topology/TopologyView');

    render(<TopologyView />);

    expect(await screen.findAllByTestId('topology-service-item')).not.toHaveLength(0);

    const svcButtons = screen.getAllByTestId('topology-service-item');
    fireEvent.click(svcButtons[0]);

    expect(await screen.findByTestId('bottom-panel')).toBeInTheDocument();
    expect(await screen.findByText('Quick info')).toBeInTheDocument();

    // Env is masked.
    expect(screen.getByText('PASSWORD=<hidden>')).toBeInTheDocument();
    expect(screen.getByText('EMPTY=')).toBeInTheDocument();

    // Mount is formatted.
    expect(screen.getByText('bind:/a -> /b (ro)')).toBeInTheDocument();

    // Summary view loads service logs with "200" lines.
    await waitFor(() => {
      expect(swarmApi.GetSwarmServiceLogs).toHaveBeenCalledWith('s1', '200');
    });

    // Switch to Logs tab to load with "500".
    fireEvent.click(screen.getByRole('button', { name: 'Logs' }));
    expect(await screen.findByTestId('text-viewer')).toBeInTheDocument();
    await waitFor(() => {
      expect(swarmApi.GetSwarmServiceLogs).toHaveBeenCalledWith('s1', '500');
    });
  });

  it('keeps topology on silent refresh failures and shows error', async () => {
    const swarmApi = vi.mocked(await import('../docker/swarmApi'));
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');

    let intervalCallback: (() => void) | undefined;
    intervalSpy.mockImplementation((cb, ms) => {
      if (ms === 8000) intervalCallback = cb as () => void;
      return 123 as unknown as number;
    });

    swarmApi.GetClusterTopology
      .mockResolvedValueOnce(mockTopology() as unknown as topology.ClusterTopology)
      .mockRejectedValueOnce(new Error('boom'));

    const { default: TopologyView } = await import('../docker/topology/TopologyView');

    render(<TopologyView />);

    expect(await screen.findAllByTestId('topology-node-item')).not.toHaveLength(0);

    // Trigger silent auto-refresh.
    expect(intervalCallback).toBeTypeOf('function');
    intervalCallback?.();

    expect(await screen.findByText('boom')).toBeInTheDocument();
    // Existing topology stays rendered.
    expect(screen.getAllByTestId('topology-node-item')).not.toHaveLength(0);

    intervalSpy.mockRestore();
  });

  it('shows error and clears topology on non-silent refresh failures', async () => {
    const swarmApi = vi.mocked(await import('../docker/swarmApi'));
    swarmApi.GetClusterTopology
      .mockResolvedValueOnce(mockTopology() as unknown as topology.ClusterTopology)
      .mockRejectedValueOnce(new Error('nope'));

    const { default: TopologyView } = await import('../docker/topology/TopologyView');

    render(<TopologyView />);

    expect(await screen.findAllByTestId('topology-node-item')).not.toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('nope')).toBeInTheDocument();
    expect(await screen.findByText('No nodes found.')).toBeInTheDocument();
  });
});
