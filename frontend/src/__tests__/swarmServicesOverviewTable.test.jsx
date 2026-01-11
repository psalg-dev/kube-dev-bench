import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';

const { runtimeHandlers, swarmApiMocks, notificationMocks } = vi.hoisted(() => {
  return {
    runtimeHandlers: new Map(),
    swarmApiMocks: {
      GetSwarmServices: vi.fn(),
      ScaleSwarmService: vi.fn(),
      RemoveSwarmService: vi.fn(),
      RestartSwarmService: vi.fn(),
      GetSwarmServiceLogs: vi.fn(),
      UpdateSwarmServiceImage: vi.fn(),
    },
    notificationMocks: {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    },
  };
});

vi.mock('../docker/swarmApi.js', () => swarmApiMocks);

// SwarmServicesOverviewTable imports runtime via "../../../../wailsjs/runtime/runtime.js"
vi.mock('../../wailsjs/runtime/runtime.js', () => ({
  EventsOn: vi.fn((eventName, cb) => {
    runtimeHandlers.set(eventName, cb);
    return vi.fn();
  }),
}));

// Minimal table mock that exercises column cell renderers.
vi.mock('../layout/overview/OverviewTableWithPanel.jsx', () => ({
  default: function OverviewTableWithPanelMock(props) {
    const { title, columns, data, getRowActions, headerActions } = props;

    return (
      <div data-testid="overview-table">
        <div data-testid="title">{title}</div>
        <div data-testid="header-actions">{headerActions}</div>

        <div data-testid="rows">
          {(data || []).map((row) => {
            const actions = typeof getRowActions === 'function' ? getRowActions(row) : [];
            return (
              <div key={row.id} data-testid={`row-${row.id}`}>
                <div data-testid={`row-name-${row.id}`}>{row.name}</div>

                <div data-testid={`row-cells-${row.id}`}>
                  {(columns || []).map((col) => {
                    const rawValue = row[col.key];
                    const content = col.cell
                      ? col.cell({ getValue: () => rawValue })
                      : rawValue ?? '-';
                    return (
                      <div key={col.key} data-testid={`cell-${row.id}-${col.key}`}>
                        {content}
                      </div>
                    );
                  })}
                </div>

                <div data-testid={`row-digests-${row.id}`}>
                  <div data-testid={`localDigest-${row.id}`}>{row.imageLocalDigest || ''}</div>
                  <div data-testid={`remoteDigest-${row.id}`}>{row.imageRemoteDigest || ''}</div>
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
              </div>
            );
          })}
        </div>
      </div>
    );
  },
}));

vi.mock('../components/AggregateLogsTab.jsx', () => ({
  default: function AggregateLogsTabMock() {
    return <div data-testid="aggregate-logs" />;
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
        <div>{actions}</div>
      </div>
    );
  },
}));

vi.mock('../docker/resources/SwarmResourceActions.jsx', () => ({
  default: function SwarmResourceActionsMock() {
    return <div data-testid="swarm-resource-actions" />;
  },
}));

vi.mock('../docker/resources/services/UpdateServiceImageModal.jsx', () => ({
  default: function UpdateServiceImageModalMock({ open }) {
    return open ? <div data-testid="update-image-modal" /> : null;
  },
}));

vi.mock('../docker/resources/services/ImageUpdateModal.jsx', () => ({
  default: function ImageUpdateModalMock({ open, service, onClose }) {
    if (!open) return null;
    return (
      <div data-testid="image-update-modal">
        <div>service:{service?.name || '-'}</div>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    );
  },
}));

vi.mock('../docker/resources/services/ImageUpdateSettingsModal.jsx', () => ({
  default: function ImageUpdateSettingsModalMock({ open }) {
    return open ? <div data-testid="image-update-settings-modal" /> : null;
  },
}));

vi.mock('../notification.js', () => notificationMocks);

import SwarmServicesOverviewTable from '../docker/resources/services/SwarmServicesOverviewTable.jsx';

function emit(eventName, payload) {
  const cb = runtimeHandlers.get(eventName);
  if (!cb) throw new Error(`No handler registered for ${eventName}`);
  cb(payload);
}

describe('SwarmServicesOverviewTable', () => {
  beforeEach(() => {
    runtimeHandlers.clear();
    vi.clearAllMocks();

    swarmApiMocks.GetSwarmServices.mockResolvedValue([
      {
        id: 'svc1',
        name: 'api',
        image: 'nginx:1.2.3',
        mode: 'replicated',
        replicas: 2,
        runningTasks: 2,
        ports: [{ publishedPort: 8080, targetPort: 80, protocol: 'tcp' }],
        createdAt: new Date(2025, 0, 2, 3, 4, 5),
      },
      {
        id: 'svc2',
        name: 'worker',
        image: 'busybox:latest',
        mode: 'global',
        replicas: undefined,
        runningTasks: 1,
        ports: [],
        createdAt: null,
      },
    ]);

    swarmApiMocks.ScaleSwarmService.mockResolvedValue(undefined);
    swarmApiMocks.RestartSwarmService.mockResolvedValue(undefined);
    swarmApiMocks.RemoveSwarmService.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads services and renders rows/cells', async () => {
    render(<SwarmServicesOverviewTable />);

    expect(screen.getByText('Loading Swarm services...')).toBeInTheDocument();

    expect(await screen.findByTestId('row-svc1')).toBeInTheDocument();
    expect(screen.getByTestId('row-name-svc1')).toHaveTextContent('api');

    // image cell rendered (ellipsis span exists)
    const imageCell = screen.getByTestId('cell-svc1-image');
    expect(imageCell).toHaveTextContent('nginx:1.2.3');

    // ports cell rendered
    expect(screen.getByTestId('cell-svc1-ports')).toHaveTextContent('8080:80/tcp');

    // created cell formatted in local time via Date object
    expect(screen.getByTestId('cell-svc1-createdAt')).toHaveTextContent('02.01.2025');

    // second service has no createdAt
    expect(screen.getByTestId('cell-svc2-createdAt')).toHaveTextContent('-');

    expect(swarmApiMocks.GetSwarmServices).toHaveBeenCalledTimes(1);
  });

  it('opens image update settings modal from header button', async () => {
    render(<SwarmServicesOverviewTable />);
    await screen.findByTestId('row-svc1');

    const header = screen.getByTestId('header-actions');
    const button = within(header).getByRole('button', { name: 'Image Updates' });
    fireEvent.click(button);

    expect(screen.getByTestId('image-update-settings-modal')).toBeInTheDocument();
  });

  it('row actions call APIs and emit notifications', async () => {
    vi.stubGlobal('prompt', vi.fn(() => '5'));
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<SwarmServicesOverviewTable />);
    await screen.findByTestId('row-svc1');

    const actions = screen.getByTestId('actions-svc1');

    fireEvent.click(within(actions).getByRole('button', { name: 'Restart' }));
    await waitFor(() => expect(swarmApiMocks.RestartSwarmService).toHaveBeenCalledWith('svc1'));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Restarted service api');

    fireEvent.click(within(actions).getByRole('button', { name: 'Scale…' }));
    await waitFor(() => expect(swarmApiMocks.ScaleSwarmService).toHaveBeenCalledWith('svc1', 5));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Scaled service api to 5 replicas');

    fireEvent.click(within(actions).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(swarmApiMocks.RemoveSwarmService).toHaveBeenCalledWith('svc1'));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Removed service api');

    // Scale is disabled for non-replicated services
    const actions2 = screen.getByTestId('actions-svc2');
    const scale2 = within(actions2).getByRole('button', { name: 'Scale…' });
    expect(scale2).toBeDisabled();
  });

  it('clicking ImageUpdateBadge opens the details modal', async () => {
    render(<SwarmServicesOverviewTable />);
    await screen.findByTestId('row-svc1');

    // The ImageUpdateBadge renders a button; clicking should call onOpenDetails.
    // If the internal markup changes, this test can be adapted to call the handler directly.
    const updateCell = screen.getByTestId('cell-svc1-imageUpdate');
    const btn = within(updateCell).getByRole('button');
    fireEvent.click(btn);

    expect(await screen.findByTestId('image-update-modal')).toBeInTheDocument();
    expect(screen.getByText('service:api')).toBeInTheDocument();

    fireEvent.click(within(screen.getByTestId('image-update-modal')).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByTestId('image-update-modal')).not.toBeInTheDocument());
  });

  it('applies runtime updates for services and image digests', async () => {
    render(<SwarmServicesOverviewTable />);
    await screen.findByTestId('row-svc1');

    // services update replaces rows
    act(() => {
      emit('swarm:services:update', [
        {
          id: 'svc3',
          name: 'new',
          image: 'alpine:3',
          mode: 'replicated',
          replicas: 1,
          runningTasks: 1,
          ports: [],
          createdAt: new Date(2025, 5, 6, 7, 8, 9),
        },
      ]);
    });

    expect(await screen.findByTestId('row-svc3')).toBeInTheDocument();

    // image update event merges digests
    act(() => {
      emit('swarm:image:updates', {
        svc3: {
          updateAvailable: true,
          localDigest: 'sha256:local',
          remoteDigest: 'sha256:remote',
          checkedAt: '2025-01-01T00:00:00Z',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('localDigest-svc3')).toHaveTextContent('sha256:local');
      expect(screen.getByTestId('remoteDigest-svc3')).toHaveTextContent('sha256:remote');
    });
  });
});
