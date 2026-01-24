import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';

const { runtimeHandlers, swarmApiMocks, notificationMocks, swarmStateMock } = vi.hoisted(() => {
  return {
    runtimeHandlers: new Map(),
    swarmApiMocks: {
      GetSwarmSecrets: vi.fn(),
      RemoveSwarmSecret: vi.fn(),
    },
    notificationMocks: {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    },
    swarmStateMock: {
      connected: true,
    },
  };
});

vi.mock('../docker/swarmApi.js', () => swarmApiMocks);
vi.mock('../notification.js', () => notificationMocks);

// SwarmSecretsOverviewTable imports EventsOn from "../../../../wailsjs/runtime"
vi.mock('../../wailsjs/runtime', () => ({
  EventsOn: vi.fn((eventName, cb) => {
    runtimeHandlers.set(eventName, cb);
    return vi.fn();
  }),
}));

vi.mock('../docker/SwarmStateContext.jsx', () => ({
  useSwarmState: () => swarmStateMock,
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

vi.mock('../docker/resources/secrets/SecretUsedBySection.jsx', () => ({
  default: function SecretUsedBySectionMock() {
    return <div data-testid="secret-used-by" />;
  },
}));

vi.mock('../docker/resources/secrets/SecretInspectTab.jsx', () => ({
  default: function SecretInspectTabMock() {
    return <div data-testid="secret-inspect" />;
  },
}));

vi.mock('../docker/resources/secrets/SecretEditModal.jsx', () => ({
  default: function SecretEditModalMock({ open, titleVerb = 'Edit' }) {
    return open ? <div data-testid="secret-edit-modal">{titleVerb}</div> : null;
  },
}));

vi.mock('../docker/resources/secrets/SecretCloneModal.jsx', () => ({
  default: function SecretCloneModalMock({ open }) {
    return open ? <div data-testid="secret-clone-modal" /> : null;
  },
}));

import SwarmSecretsOverviewTable from '../docker/resources/secrets/SwarmSecretsOverviewTable.jsx';

function emit(eventName, payload) {
  const cb = runtimeHandlers.get(eventName);
  if (!cb) throw new Error(`No handler registered for ${eventName}`);
  cb(payload);
}

describe('SwarmSecretsOverviewTable', () => {
  beforeEach(() => {
    runtimeHandlers.clear();
    vi.clearAllMocks();
    swarmStateMock.connected = true;

    swarmApiMocks.GetSwarmSecrets.mockResolvedValue([
      {
        id: 'sec1',
        name: 'db-password',
        createdAt: new Date(2025, 0, 2, 3, 4, 5),
        updatedAt: null,
        labels: { a: '1', b: '2' },
      },
    ]);

    swarmApiMocks.RemoveSwarmSecret.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows not-connected state without calling API', async () => {
    swarmStateMock.connected = false;

    render(<SwarmSecretsOverviewTable />);

    expect(screen.getByText('Not connected to Docker Swarm')).toBeInTheDocument();
    expect(swarmApiMocks.GetSwarmSecrets).not.toHaveBeenCalled();
  });

  it('loads and renders secrets including labels count', async () => {
    render(<SwarmSecretsOverviewTable />);

    expect(screen.getByText('Loading Swarm secrets...')).toBeInTheDocument();

    expect(await screen.findByTestId('row-sec1')).toBeInTheDocument();
    expect(screen.getByTestId('name-sec1')).toHaveTextContent('db-password');
    expect(screen.getByTestId('cell-sec1-labels')).toHaveTextContent('2 labels');

    expect(swarmApiMocks.GetSwarmSecrets).toHaveBeenCalledTimes(1);
  });

  it('deletes via row action', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<SwarmSecretsOverviewTable />);
    await screen.findByTestId('row-sec1');

    const actions = screen.getByTestId('actions-sec1');
    fireEvent.click(within(actions).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(swarmApiMocks.RemoveSwarmSecret).toHaveBeenCalledWith('sec1'));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Secret "db-password" deleted');

    // refresh() should trigger a reload
    await waitFor(() => expect(swarmApiMocks.GetSwarmSecrets).toHaveBeenCalledTimes(2));
  });

  it('opens edit/rotate/clone modals from summary panel and deletes from panel actions', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<SwarmSecretsOverviewTable />);
    await screen.findByTestId('row-sec1');

    const panel = screen.getByTestId('panel-sec1');

    // open edit
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit' }));
    expect(screen.getByTestId('secret-edit-modal')).toHaveTextContent('Edit');

    // open rotate (second edit modal)
    fireEvent.click(within(panel).getByRole('button', { name: 'Rotate' }));
    const editModals = screen.getAllByTestId('secret-edit-modal');
    expect(editModals.some((n) => n.textContent === 'Rotate')).toBe(true);

    // open clone
    fireEvent.click(within(panel).getByRole('button', { name: 'Clone' }));
    expect(screen.getByTestId('secret-clone-modal')).toBeInTheDocument();

    // delete via SwarmResourceActions mock
    fireEvent.click(within(panel).getAllByRole('button', { name: 'Delete' })[0]);
    await waitFor(() => expect(swarmApiMocks.RemoveSwarmSecret).toHaveBeenCalledWith('sec1'));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Secret "db-password" deleted');
  });

  it('applies runtime updates when swarm:secrets:update emits an array', async () => {
    render(<SwarmSecretsOverviewTable />);
    await screen.findByTestId('row-sec1');

    act(() => {
      emit('swarm:secrets:update', [
        {
          id: 'sec2',
          name: 'api-key',
          createdAt: new Date(2025, 0, 2, 3, 4, 5),
          updatedAt: new Date(2025, 0, 2, 3, 4, 5),
          labels: {},
        },
      ]);
    });

    expect(await screen.findByTestId('row-sec2')).toBeInTheDocument();
  });
});
