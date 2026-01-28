import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

vi.mock('../docker/swarmApi.js', () => ({
  GetClusterTopology: vi.fn(),
  GetSwarmNode: vi.fn(),
  GetSwarmService: vi.fn(),
  GetSwarmServiceLogs: vi.fn(),
}));

vi.mock('../layout/bottompanel/BottomPanel.jsx', () => ({
  default: ({ open, tabs, activeTab, onTabChange, onClose, children }) => {
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
        <button type="button" onClick={onClose}>
          Close
        </button>
        <div data-testid="bottom-panel-content">{children}</div>
      </div>
    );
  },
}));

vi.mock('../layout/bottompanel/TextViewerTab', () => ({
  default: ({ content, loading, error, loadingLabel }) => (
    <div data-testid="text-viewer">
      <div>loading:{String(loading)}</div>
      <div>error:{error ? String(error) : ''}</div>
      <div>label:{loadingLabel}</div>
      <pre>{String(content ?? '')}</pre>
    </div>
  ),
}));

vi.mock('../docker/resources/nodes/NodeTasksTab.jsx', () => ({
  default: ({ nodeId }) => (
    <div data-testid="node-tasks">NodeTasks:{nodeId}</div>
  ),
}));

vi.mock('../docker/resources/nodes/NodeLogsTab.jsx', () => ({
  default: ({ nodeId }) => <div data-testid="node-logs">NodeLogs:{nodeId}</div>,
}));

vi.mock('../docker/resources/nodes/NodeLabelsTab.jsx', () => ({
  default: ({ nodeId, onSaved }) => (
    <div data-testid="node-labels">
      <div>NodeLabels:{nodeId}</div>
      <button type="button" onClick={onSaved}>
        TriggerSaved
      </button>
    </div>
  ),
}));

vi.mock('../docker/resources/services/ServiceTasksTab.jsx', () => ({
  default: ({ serviceId }) => (
    <div data-testid="service-tasks">ServiceTasks:{serviceId}</div>
  ),
}));

function mockTopology() {
  return {
    timestamp: '2026-01-11 12:00:00',
    nodes: [
      {
        id: 'n1',
        hostname: 'node-1',
        role: 'manager',
        state: 'Ready',
        taskCount: 2,
      },
      {
        id: 'n2',
        hostname: 'node-2',
        role: 'worker',
        state: 'Down',
        taskCount: 0,
      },
    ],
    services: [
      {
        id: 's1',
        name: 'svc-1',
        mode: 'replicated',
        runningTasks: 1,
        taskCount: 1,
      },
    ],
    links: [{ from: 's1', to: 'n1', weight: 5 }],
  };
}

describe('TopologyView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders topology and opens node details panel', async () => {
    const swarmApi = await import('../docker/swarmApi.js');
    swarmApi.GetClusterTopology.mockResolvedValueOnce(mockTopology());
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
    });

    const { default: TopologyView } =
      await import('../docker/topology/TopologyView.jsx');

    const { container } = render(<TopologyView />);

    expect(await screen.findAllByTestId('topology-node-item')).not.toHaveLength(
      0,
    );
    expect(
      await screen.findAllByTestId('topology-service-item'),
    ).not.toHaveLength(0);

    // SVG node color mapping (Ready / Down)
    const circles = Array.from(container.querySelectorAll('circle'));
    expect(circles.some((c) => c.getAttribute('fill') === '#2ea44f')).toBe(
      true,
    );
    expect(circles.some((c) => c.getAttribute('fill') === '#ff7b72')).toBe(
      true,
    );

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

    // Close via Escape key.
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('bottom-panel')).not.toBeInTheDocument();
    });
  });

  it('opens service details and loads logs (masked env + mount formatting)', async () => {
    const swarmApi = await import('../docker/swarmApi.js');
    swarmApi.GetClusterTopology.mockResolvedValueOnce(mockTopology());
    swarmApi.GetSwarmService.mockResolvedValueOnce({
      id: 's1',
      name: 'svc-1',
      mode: 'replicated',
      replicas: 2,
      runningTasks: 1,
      createdAt: '2026-01-11T12:00:00Z',
      image: 'nginx:latest',
      ports: [
        {
          publishedPort: 8080,
          targetPort: 80,
          protocol: 'tcp',
          publishMode: 'ingress',
        },
      ],
      env: ['PASSWORD=secret', 'EMPTY='],
      mounts: [{ type: 'bind', source: '/a', target: '/b', readOnly: true }],
      resources: {
        limits: { nanoCpus: 1e9, memoryBytes: 1024 },
        reservations: { nanoCpus: 2e9, memoryBytes: 2048 },
      },
      labels: { team: 'core' },
    });
    swarmApi.GetSwarmServiceLogs.mockResolvedValue('hello logs');

    const { default: TopologyView } =
      await import('../docker/topology/TopologyView.jsx');

    render(<TopologyView />);

    expect(
      await screen.findAllByTestId('topology-service-item'),
    ).not.toHaveLength(0);

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
    const swarmApi = await import('../docker/swarmApi.js');
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');

    /** @type {null | (() => void)} */
    let intervalCallback = null;
    intervalSpy.mockImplementation((cb, ms) => {
      if (ms === 8000) intervalCallback = cb;
      return 123;
    });

    swarmApi.GetClusterTopology.mockResolvedValueOnce(
      mockTopology(),
    ).mockRejectedValueOnce(new Error('boom'));

    const { default: TopologyView } =
      await import('../docker/topology/TopologyView.jsx');

    render(<TopologyView />);

    expect(await screen.findAllByTestId('topology-node-item')).not.toHaveLength(
      0,
    );

    // Trigger silent auto-refresh.
    expect(intervalCallback).toBeTypeOf('function');
    intervalCallback();

    expect(await screen.findByText('boom')).toBeInTheDocument();
    // Existing topology stays rendered.
    expect(screen.getAllByTestId('topology-node-item')).not.toHaveLength(0);

    intervalSpy.mockRestore();
  });

  it('shows error and clears topology on non-silent refresh failures', async () => {
    const swarmApi = await import('../docker/swarmApi.js');
    swarmApi.GetClusterTopology.mockResolvedValueOnce(
      mockTopology(),
    ).mockRejectedValueOnce(new Error('nope'));

    const { default: TopologyView } =
      await import('../docker/topology/TopologyView.jsx');

    render(<TopologyView />);

    expect(await screen.findAllByTestId('topology-node-item')).not.toHaveLength(
      0,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('nope')).toBeInTheDocument();
    expect(await screen.findByText('No nodes found.')).toBeInTheDocument();
  });
});
