import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';

const { runtimeHandlers, swarmApiMocks, notificationMocks, swarmStateMocks } =
  vi.hoisted(() => {
    return {
      runtimeHandlers: new Map(),
      swarmApiMocks: {
        GetSwarmVolumes: vi.fn(),
        BackupSwarmVolume: vi.fn(),
        RestoreSwarmVolume: vi.fn(),
        CloneSwarmVolume: vi.fn(),
        RemoveSwarmVolume: vi.fn(),
        GetSwarmVolumeUsage: vi.fn(),
      },
      notificationMocks: {
        showSuccess: vi.fn(),
        showError: vi.fn(),
      },
      swarmStateMocks: {
        useSwarmState: vi.fn(),
      },
    };
  });

vi.mock('../docker/swarmApi.js', () => swarmApiMocks);
vi.mock('../notification.js', () => notificationMocks);
vi.mock('../docker/SwarmStateContext.jsx', () => swarmStateMocks);

vi.mock('../utils/dateUtils.js', () => ({
  formatTimestampDMYHMS: (v) => `FMT(${v})`,
}));

vi.mock('../../wailsjs/runtime', () => ({
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
            const actions =
              typeof getRowActions === 'function' ? getRowActions(row) : [];
            return (
              <div key={row.name} data-testid={`row-${row.name}`}>
                <div data-testid={`cells-${row.name}`}>
                  {(columns || []).map((col) => {
                    const rawValue = row[col.key];
                    const content = col.cell
                      ? col.cell({ getValue: () => rawValue })
                      : (rawValue ?? '-');
                    return (
                      <div
                        key={col.key}
                        data-testid={`cell-${row.name}-${col.key}`}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>

                <div data-testid={`actions-${row.name}`}>
                  {actions.map((a) => (
                    <button key={a.label} type="button" onClick={a.onClick}>
                      {a.label}
                    </button>
                  ))}
                </div>

                <div data-testid={`panel-${row.name}`}>
                  {renderPanelContent?.(row, 'summary')}
                </div>
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
    return onDelete ? (
      <button type="button" onClick={onDelete}>
        Delete
      </button>
    ) : null;
  },
}));

vi.mock('../docker/resources/volumes/VolumeUsedBySection.jsx', () => ({
  default: function VolumeUsedBySectionMock() {
    return <div data-testid="used-by" />;
  },
}));

vi.mock('../docker/resources/volumes/VolumeFilesTab.jsx', () => ({
  default: function VolumeFilesTabMock() {
    return <div data-testid="volume-files" />;
  },
}));

vi.mock('../docker/resources/volumes/VolumeInspectTab.jsx', () => ({
  default: function VolumeInspectTabMock() {
    return <div data-testid="volume-inspect" />;
  },
}));

import SwarmVolumesOverviewTable from '../docker/resources/volumes/SwarmVolumesOverviewTable.jsx';

function emit(eventName, payload) {
  const cb = runtimeHandlers.get(eventName);
  if (!cb) throw new Error(`No handler registered for ${eventName}`);
  cb(payload);
}

describe('SwarmVolumesOverviewTable', () => {
  beforeEach(() => {
    runtimeHandlers.clear();
    vi.clearAllMocks();

    swarmStateMocks.useSwarmState.mockReturnValue({ connected: true });

    swarmApiMocks.GetSwarmVolumes.mockResolvedValue([
      {
        name: 'data',
        driver: 'local',
        scope: 'local',
        createdAt: '2026-01-01T12:00:00Z',
        labels: { a: '1', b: '2' },
        mountpoint: '/var/lib/docker/volumes/data/_data',
      },
    ]);

    swarmApiMocks.BackupSwarmVolume.mockResolvedValue('C:/tmp/backup.tar');
    swarmApiMocks.RestoreSwarmVolume.mockResolvedValue('C:/tmp/backup.tar');
    swarmApiMocks.CloneSwarmVolume.mockResolvedValue(undefined);
    swarmApiMocks.RemoveSwarmVolume.mockResolvedValue(undefined);
    swarmApiMocks.GetSwarmVolumeUsage.mockResolvedValue([]);
  });

  it('shows not-connected message when swarm disconnected', () => {
    swarmStateMocks.useSwarmState.mockReturnValue({ connected: false });

    render(<SwarmVolumesOverviewTable />);

    expect(
      screen.getByText('Not connected to Docker Swarm'),
    ).toBeInTheDocument();
  });

  it('loads and renders volumes with formatted cells', async () => {
    render(<SwarmVolumesOverviewTable />);

    expect(screen.getByText('Loading Swarm volumes...')).toBeInTheDocument();

    expect(await screen.findByTestId('row-data')).toBeInTheDocument();
    expect(screen.getByTestId('cell-data-createdAt')).toHaveTextContent(
      'FMT(2026-01-01T12:00:00Z)',
    );
    expect(screen.getByTestId('cell-data-labels')).toHaveTextContent(
      '2 labels',
    );
  });

  it('row actions call APIs and trigger refresh where expected', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'data-clone'),
    );

    render(<SwarmVolumesOverviewTable />);
    await screen.findByTestId('row-data');

    const actions = screen.getByTestId('actions-data');

    fireEvent.click(within(actions).getByRole('button', { name: 'Backup' }));
    await waitFor(() =>
      expect(swarmApiMocks.BackupSwarmVolume).toHaveBeenCalledWith('data'),
    );
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith(
      'Backed up volume "data"',
    );

    fireEvent.click(within(actions).getByRole('button', { name: 'Restore…' }));
    await waitFor(() =>
      expect(swarmApiMocks.RestoreSwarmVolume).toHaveBeenCalledWith('data'),
    );
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith(
      'Restored backup into volume "data"',
    );

    fireEvent.click(within(actions).getByRole('button', { name: 'Clone…' }));
    await waitFor(() =>
      expect(swarmApiMocks.CloneSwarmVolume).toHaveBeenCalledWith(
        'data',
        'data-clone',
      ),
    );
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith(
      'Cloned volume to "data-clone"',
    );

    fireEvent.click(within(actions).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(swarmApiMocks.RemoveSwarmVolume).toHaveBeenCalledWith(
        'data',
        false,
      ),
    );
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith(
      'Volume "data" deleted',
    );

    // clone + delete each call refresh() => another load
    await waitFor(() =>
      expect(swarmApiMocks.GetSwarmVolumes).toHaveBeenCalledTimes(3),
    );
  });

  it('summary panel delete checks usage list for confirm message', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );

    swarmApiMocks.GetSwarmVolumeUsage.mockResolvedValue([
      { serviceName: 'api', serviceId: 'svc1' },
      { serviceName: 'web', serviceId: 'svc2' },
    ]);

    render(<SwarmVolumesOverviewTable />);
    await screen.findByTestId('row-data');

    const panel = screen.getByTestId('panel-data');
    const header = within(panel).getByTestId('summary-tab-header');

    fireEvent.click(within(header).getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(swarmApiMocks.GetSwarmVolumeUsage).toHaveBeenCalledWith('data'),
    );
    await waitFor(() =>
      expect(swarmApiMocks.RemoveSwarmVolume).toHaveBeenCalledWith(
        'data',
        false,
      ),
    );

    expect(notificationMocks.showSuccess).toHaveBeenCalledWith(
      'Volume "data" deleted',
    );
    expect(globalThis.confirm).toHaveBeenCalled();

    // panel delete calls onRefresh which reloads
    await waitFor(() =>
      expect(swarmApiMocks.GetSwarmVolumes).toHaveBeenCalledTimes(2),
    );
  });

  it('applies runtime updates for swarm:volumes:update', async () => {
    render(<SwarmVolumesOverviewTable />);
    await screen.findByTestId('row-data');

    act(() => {
      emit('swarm:volumes:update', [
        {
          name: 'logs',
          driver: 'local',
          scope: 'local',
          createdAt: '2026-01-02T00:00:00Z',
          labels: {},
        },
      ]);
    });

    expect(await screen.findByTestId('row-logs')).toBeInTheDocument();

    act(() => {
      emit('swarm:volumes:update', { reason: 'unknown' });
    });

    await waitFor(() =>
      expect(swarmApiMocks.GetSwarmVolumes).toHaveBeenCalledTimes(2),
    );
  });
});
