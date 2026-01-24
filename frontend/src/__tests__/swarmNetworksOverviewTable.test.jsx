import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';

const { runtimeHandlers, swarmApiMocks, notificationMocks } = vi.hoisted(() => {
  return {
    runtimeHandlers: new Map(),
    swarmApiMocks: {
      GetSwarmNetworks: vi.fn(),
      RemoveSwarmNetwork: vi.fn(),
    },
    notificationMocks: {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    },
  };
});

vi.mock('../docker/swarmApi.js', () => swarmApiMocks);

vi.mock('../../wailsjs/runtime/runtime.js', () => ({
  EventsOn: vi.fn((eventName, cb) => {
    runtimeHandlers.set(eventName, cb);
    return vi.fn();
  }),
}));

vi.mock('../notification.js', () => notificationMocks);

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
                <div data-testid={`name-${row.id}`}>{row.name}</div>

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
                    <button
                      key={a.label}
                      type="button"
                      disabled={Boolean(a.disabled)}
                      onClick={a.onClick}
                    >
                      {a.label}
                    </button>
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
  default: function SwarmResourceActionsMock({ onDelete }) {
    return (
      <button type="button" onClick={onDelete}>
        Delete
      </button>
    );
  },
}));

vi.mock('../docker/resources/networks/NetworkConnectedServicesSection.jsx', () => ({
  default: function NetworkConnectedServicesSectionMock() {
    return <div data-testid="connected-services" />;
  },
}));

vi.mock('../docker/resources/networks/NetworkConnectedContainersSection.jsx', () => ({
  default: function NetworkConnectedContainersSectionMock() {
    return <div data-testid="connected-containers" />;
  },
}));

vi.mock('../docker/resources/networks/NetworkInspectTab.jsx', () => ({
  default: function NetworkInspectTabMock() {
    return <div data-testid="network-inspect" />;
  },
}));

vi.mock('../docker/resources/networks/NetworkDetailsSections.jsx', () => ({
  NetworkIPAMSection: function NetworkIPAMSectionMock() {
    return <div data-testid="network-ipam" />;
  },
  NetworkOptionsSection: function NetworkOptionsSectionMock() {
    return <div data-testid="network-options" />;
  },
}));

import SwarmNetworksOverviewTable from '../docker/resources/networks/SwarmNetworksOverviewTable.jsx';

function emit(eventName, payload) {
  const cb = runtimeHandlers.get(eventName);
  if (!cb) throw new Error(`No handler registered for ${eventName}`);
  cb(payload);
}

describe('SwarmNetworksOverviewTable', () => {
  beforeEach(() => {
    runtimeHandlers.clear();
    vi.clearAllMocks();

    swarmApiMocks.GetSwarmNetworks.mockResolvedValue([
      {
        id: 'net1',
        name: 'bridge',
        driver: 'bridge',
        scope: 'local',
        attachable: false,
        internal: false,
        createdAt: new Date(2025, 0, 2, 3, 4, 5),
      },
      {
        id: 'net2',
        name: 'app-net',
        driver: 'overlay',
        scope: 'swarm',
        attachable: true,
        internal: false,
        createdAt: new Date(2025, 0, 2, 3, 4, 5),
      },
    ]);

    swarmApiMocks.RemoveSwarmNetwork.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads and renders networks; built-in delete is disabled', async () => {
    render(<SwarmNetworksOverviewTable />);

    expect(screen.getByText('Loading networks...')).toBeInTheDocument();

    expect(await screen.findByTestId('row-net1')).toBeInTheDocument();
    expect(screen.getByTestId('name-net2')).toHaveTextContent('app-net');

    const deleteBuiltIn = within(screen.getByTestId('actions-net1')).getByRole('button', { name: 'Delete' });
    expect(deleteBuiltIn).toBeDisabled();

    const deleteCustom = within(screen.getByTestId('actions-net2')).getByRole('button', { name: 'Delete' });
    expect(deleteCustom).not.toBeDisabled();

    // scope cell highlights swarm scope
    expect(screen.getByTestId('cell-net2-scope')).toHaveTextContent('swarm');
  });

  it('deletes a custom network via row action', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<SwarmNetworksOverviewTable />);
    await screen.findByTestId('row-net2');

    const deleteCustom = within(screen.getByTestId('actions-net2')).getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteCustom);

    await waitFor(() => expect(swarmApiMocks.RemoveSwarmNetwork).toHaveBeenCalledWith('net2'));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Network app-net removed');
  });

  it('deletes a custom network via panel SwarmResourceActions', async () => {
    render(<SwarmNetworksOverviewTable />);
    await screen.findByTestId('row-net2');

    const panel = screen.getByTestId('panel-net2');
    const btn = within(panel).getByRole('button', { name: 'Delete' });
    fireEvent.click(btn);

    await waitFor(() => expect(swarmApiMocks.RemoveSwarmNetwork).toHaveBeenCalledWith('net2'));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Network app-net removed');
  });

  it('applies runtime updates when swarm:networks:update emits an array', async () => {
    render(<SwarmNetworksOverviewTable />);
    await screen.findByTestId('row-net1');

    act(() => {
      emit('swarm:networks:update', [
        {
          id: 'net3',
          name: 'other',
          driver: 'overlay',
          scope: 'swarm',
          attachable: false,
          internal: true,
          createdAt: new Date(2025, 0, 2, 3, 4, 5),
        },
      ]);
    });

    expect(await screen.findByTestId('row-net3')).toBeInTheDocument();
  });
});
