import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';

const { runtimeHandlers, swarmApiMocks, notificationMocks } = vi.hoisted(() => {
  return {
    runtimeHandlers: new Map(),
    swarmApiMocks: {
      GetSwarmNodes: vi.fn(),
      UpdateSwarmNodeAvailability: vi.fn(),
      UpdateSwarmNodeRole: vi.fn(),
      RemoveSwarmNode: vi.fn(),
    },
    notificationMocks: {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    },
  };
});

vi.mock('../docker/swarmApi.js', () => swarmApiMocks);
vi.mock('../notification.js', () => notificationMocks);

vi.mock('../../wailsjs/runtime/runtime.js', () => ({
  EventsOn: vi.fn((eventName, cb) => {
    runtimeHandlers.set(eventName, cb);
    return vi.fn();
  }),
}));

vi.mock('../layout/overview/OverviewTableWithPanel.jsx', () => ({
  default: function OverviewTableWithPanelMock(props) {
    const { title, columns, data, getRowActions, renderPanelContent } = props;
    const rows = Array.isArray(data) ? data : [];

    return (
      <div>
        <div data-testid="title">{title}</div>
        <div data-testid="rows">
          {rows.map((row) => {
            const actions = typeof getRowActions === 'function' ? getRowActions(row) : [];
            return (
              <div key={row.id} data-testid={`row-${row.id}`}>
                <div data-testid={`name-${row.id}`}>{row.hostname}</div>

                <div data-testid={`cells-${row.id}`}>
                  {(columns || []).map((col) => {
                    const rawValue = row[col.key];
                    const content = col.cell ? col.cell({ getValue: () => rawValue }) : rawValue ?? '-';
                    return (
                      <div key={col.key} data-testid={`cell-${row.id}-${col.key}`}>
                        {content}
                      </div>
                    );
                  })}
                </div>

                <div data-testid={`actions-${row.id}`}>
                  {actions.map((a) => (
                    <div key={a.label}>
                      <button
                        type="button"
                        disabled={Boolean(a.disabled)}
                        onClick={a.onClick}
                      >
                        {a.label}
                      </button>
                      {/*
                        Some action handlers include extra guards even when disabled.
                        Provide a deterministic way to execute the handler for coverage.
                      */}
                      <button
                        type="button"
                        data-testid={`force-${row.id}-${a.label}`}
                        onClick={a.onClick}
                      >
                        force:{a.label}
                      </button>
                    </div>
                  ))}
                </div>

                <div data-testid={`panel-${row.id}`}>{renderPanelContent?.(row, 'summary')}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
}));

vi.mock('../QuickInfoSection.jsx', () => ({
  default: function QuickInfoSectionMock() {
    return <div data-testid="quick-info" />;
  },
}));

vi.mock('../layout/bottompanel/SummaryTabHeader.jsx', () => ({
  default: function SummaryTabHeaderMock({ name, actions }) {
    return (
      <div data-testid="summary-tab-header">
        <div>{name}</div>
        <div data-testid="header-actions">{actions}</div>
      </div>
    );
  },
}));

vi.mock('../docker/resources/SwarmResourceActions.jsx', () => ({
  default: function SwarmResourceActionsMock({ onDrain, onActivate, onDelete }) {
    return (
      <div>
        <button type="button" onClick={onDrain}>Drain</button>
        <button type="button" onClick={onActivate}>Activate</button>
        {onDelete ? <button type="button" onClick={onDelete}>Delete</button> : null}
      </div>
    );
  },
}));

vi.mock('../docker/resources/nodes/NodeTasksTab.jsx', () => ({
  default: function NodeTasksTabMock() {
    return <div data-testid="node-tasks" />;
  },
}));

vi.mock('../docker/resources/nodes/NodeLabelsTab.jsx', () => ({
  default: function NodeLabelsTabMock() {
    return <div data-testid="node-labels" />;
  },
}));

vi.mock('../docker/resources/nodes/NodeLogsTab.jsx', () => ({
  default: function NodeLogsTabMock() {
    return <div data-testid="node-logs" />;
  },
}));

import SwarmNodesOverviewTable from '../docker/resources/nodes/SwarmNodesOverviewTable.jsx';

function emit(eventName, payload) {
  const cb = runtimeHandlers.get(eventName);
  if (!cb) throw new Error(`No handler registered for ${eventName}`);
  cb(payload);
}

describe('SwarmNodesOverviewTable', () => {
  beforeEach(() => {
    runtimeHandlers.clear();
    vi.clearAllMocks();

    swarmApiMocks.GetSwarmNodes.mockResolvedValue([
      {
        id: 'node1',
        hostname: 'worker-1',
        role: 'worker',
        availability: 'active',
        state: 'ready',
        address: '10.0.0.2',
        engineVersion: '25.0.0',
        leader: false,
        nanoCpus: 2e9,
        memoryBytes: 1024 * 1024 * 1024,
        labels: { a: '1' },
      },
      {
        id: 'node2',
        hostname: 'manager-1',
        role: 'manager',
        availability: 'drain',
        state: 'down',
        address: '10.0.0.3',
        engineVersion: '25.0.0',
        leader: true,
      },
    ]);

    swarmApiMocks.UpdateSwarmNodeAvailability.mockResolvedValue(undefined);
    swarmApiMocks.UpdateSwarmNodeRole.mockResolvedValue(undefined);
    swarmApiMocks.RemoveSwarmNode.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads and renders nodes; row action disabled states apply', async () => {
    render(<SwarmNodesOverviewTable />);

    expect(screen.getByText('Loading Swarm nodes...')).toBeInTheDocument();

    expect(await screen.findByTestId('row-node1')).toBeInTheDocument();
    expect(screen.getByTestId('name-node2')).toHaveTextContent('manager-1');

    const a1 = screen.getByTestId('actions-node1');
    expect(within(a1).getByRole('button', { name: 'Drain' })).not.toBeDisabled();
    expect(within(a1).getByRole('button', { name: 'Activate' })).toBeDisabled();
    expect(within(a1).getByRole('button', { name: 'Promote…' })).not.toBeDisabled();

    const a2 = screen.getByTestId('actions-node2');
    expect(within(a2).getByRole('button', { name: 'Drain' })).toBeDisabled();
    expect(within(a2).getByRole('button', { name: 'Activate' })).not.toBeDisabled();
    expect(within(a2).getByRole('button', { name: 'Demote…' })).toBeDisabled();
    expect(within(a2).getByRole('button', { name: 'Remove' })).toBeDisabled();

    // cell renderers
    expect(screen.getByTestId('cell-node2-leader')).toHaveTextContent('✓');
  });

  it('executes row actions and shows notifications', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<SwarmNodesOverviewTable />);
    await screen.findByTestId('row-node1');

    const a1 = screen.getByTestId('actions-node1');

    fireEvent.click(within(a1).getByRole('button', { name: 'Drain' }));
    await waitFor(() => expect(swarmApiMocks.UpdateSwarmNodeAvailability).toHaveBeenCalledWith('node1', 'drain'));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Node worker-1 set to drain');

    fireEvent.click(within(a1).getByRole('button', { name: 'Promote…' }));
    await waitFor(() => expect(swarmApiMocks.UpdateSwarmNodeRole).toHaveBeenCalledWith('node1', 'manager'));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Node worker-1 promoted to manager');

    fireEvent.click(within(a1).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(swarmApiMocks.RemoveSwarmNode).toHaveBeenCalledWith('node1', false));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Node worker-1 removed');

    // refresh() should trigger reload
    // initial load + one refresh-triggered load per action above
    await waitFor(() => expect(swarmApiMocks.GetSwarmNodes).toHaveBeenCalledTimes(4));
  });

  it('demote on a leader manager shows an error without confirming', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<SwarmNodesOverviewTable />);
    await screen.findByTestId('row-node2');

    const a2 = screen.getByTestId('actions-node2');

    // Use force-invoke to hit the guard branch even though the UI disables the button.
    fireEvent.click(within(a2).getByTestId('force-node2-Demote…'));
    expect(notificationMocks.showError).toHaveBeenCalledWith('Cannot demote the current leader node');
    expect(swarmApiMocks.UpdateSwarmNodeRole).not.toHaveBeenCalled();
  });

  it('applies runtime updates for swarm:nodes:update', async () => {
    render(<SwarmNodesOverviewTable />);
    await screen.findByTestId('row-node1');

    act(() => {
      emit('swarm:nodes:update', [
        { id: 'node3', hostname: 'worker-2', role: 'worker', availability: 'active', state: 'ready', address: '10.0.0.4', engineVersion: '25.0.0' },
      ]);
    });

    expect(await screen.findByTestId('row-node3')).toBeInTheDocument();
  });

  it('panel actions call APIs (promote/drain/activate/delete)', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<SwarmNodesOverviewTable />);
    await screen.findByTestId('row-node1');

    const panel = screen.getByTestId('panel-node1');

    fireEvent.click(within(panel).getByRole('button', { name: 'Promote' }));
    await waitFor(() => expect(swarmApiMocks.UpdateSwarmNodeRole).toHaveBeenCalledWith('node1', 'manager'));

    // SwarmResourceActions mock buttons
    const header = within(panel).getByTestId('summary-tab-header');
    fireEvent.click(within(header).getByRole('button', { name: 'Drain' }));
    await waitFor(() => expect(swarmApiMocks.UpdateSwarmNodeAvailability).toHaveBeenCalledWith('node1', 'drain'));

    fireEvent.click(within(header).getByRole('button', { name: 'Activate' }));
    await waitFor(() => expect(swarmApiMocks.UpdateSwarmNodeAvailability).toHaveBeenCalledWith('node1', 'active'));

    fireEvent.click(within(header).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(swarmApiMocks.RemoveSwarmNode).toHaveBeenCalledWith('node1', false));
  });
});
