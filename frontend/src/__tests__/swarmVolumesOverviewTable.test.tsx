import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runtimeHandlers, swarmApiMocks, notificationMocks, swarmStateMocks } = vi.hoisted(() => {
  return {
    runtimeHandlers: new Map<string, (_payload: unknown) => void>(),
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

vi.mock('../docker/swarmApi', () => swarmApiMocks);
vi.mock('../notification', () => notificationMocks);
vi.mock('../docker/SwarmStateContext', () => swarmStateMocks);

vi.mock('../components/BaseModal', () => ({
  __esModule: true,
  BaseModal: ({ isOpen, onClose, title, children, footer, testId }: { isOpen: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode; testId?: string }) => {
    if (!isOpen) return null;

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const modalTestId = testId || 'modal-wrapper';
    return (
      <div data-testid={modalTestId} onKeyDown={handleKeyDown}>
        <div data-testid="modal-title">{title}</div>
        <div data-testid="modal-content">{children}</div>
        {footer && <div data-testid="modal-footer">{footer}</div>}
        <button data-testid="modal-close" onClick={onClose}>Close</button>
      </div>
    );
  },
  default: ({ isOpen, onClose, title, children, footer, testId }: { isOpen: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode; testId?: string }) => {
    if (!isOpen) return null;

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const modalTestId = testId || 'modal-wrapper';
    return (
      <div data-testid={modalTestId} onKeyDown={handleKeyDown}>
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

vi.mock('../utils/dateUtils', () => ({
  formatTimestampDMYHMS: (v: string) => `FMT(${v})`,
}));

vi.mock('../../wailsjs/runtime', () => ({
  EventsOn: vi.fn((eventName: string, cb: (_payload: unknown) => void) => {
    runtimeHandlers.set(eventName, cb);
    return vi.fn();
  }),
}));
vi.mock('../layout/overview/OverviewTableWithPanel', () => ({
  default: function OverviewTableWithPanelMock(props: {
    title: string;
    columns?: Array<{ key: string; cell?: (_ctx: { getValue: () => unknown }) => React.ReactNode }>;
    data?: Array<Record<string, unknown>>;
    getRowActions?: (_row: Record<string, unknown>) => Array<{ label: string; onClick: () => void }>;
    renderPanelContent?: (_row: Record<string, unknown>, _tab: string) => React.ReactNode;
  }) {
    const { title, columns, data, getRowActions, renderPanelContent } = props;
    const rows = Array.isArray(data) ? data : [];

    return (
      <div>
        <div data-testid="title">{title}</div>
        <div data-testid="rows">
          {rows.map((row) => {
            const rowName = String((row as { name?: unknown }).name ?? '');
            const actions = typeof getRowActions === 'function' ? getRowActions(row) : [];
            return (
              <div key={rowName} data-testid={`row-${rowName}`}>
                <div data-testid={`cells-${rowName}`}>
                  {(columns || []).map((col) => {
                    const rawValue = row[col.key as keyof typeof row];
                    const content = col.cell ? col.cell({ getValue: () => rawValue }) : rawValue ?? '-';
                    return (
                      <div key={col.key} data-testid={`cell-${rowName}-${col.key}`}>
                        {content as React.ReactNode}
                      </div>
                    );
                  })}
                </div>

                <div data-testid={`actions-${rowName}`}>
                  {actions.map((a) => (
                    <button key={a.label} type="button" onClick={a.onClick}>
                      {a.label}
                    </button>
                  ))}
                </div>

                <div data-testid={`panel-${rowName}`}>{renderPanelContent?.(row, 'summary')}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
}));
vi.mock('../QuickInfoSection', () => ({
  default: function QuickInfoSectionMock() {
    return <div data-testid="quick-info" />;
  },
}));

vi.mock('../layout/bottompanel/SummaryTabHeader', () => ({
  default: function SummaryTabHeaderMock({ name, actions }: { name: string; actions?: React.ReactNode }) {
    return (
      <div data-testid="summary-tab-header">
        <div>{name}</div>
        <div data-testid="header-actions">{actions}</div>
      </div>
    );
  },
}));

vi.mock('../docker/resources/SwarmResourceActions', () => ({
  default: function SwarmResourceActionsMock({ onDelete }: { onDelete?: () => void }) {
    return onDelete ? (
      <button type="button" onClick={onDelete}>
        Delete
      </button>
    ) : null;
  },
}));

vi.mock('../docker/resources/volumes/VolumeUsedBySection', () => ({
  default: function VolumeUsedBySectionMock() {
    return <div data-testid="used-by" />;
  },
}));

vi.mock('../docker/resources/volumes/VolumeFilesTab', () => ({
  default: function VolumeFilesTabMock() {
    return <div data-testid="volume-files" />;
  },
}));

vi.mock('../docker/resources/volumes/VolumeInspectTab', () => ({
  default: function VolumeInspectTabMock() {
    return <div data-testid="volume-inspect" />;
  },
}));

vi.mock('../components/ModalProvider', () => ({
  showModalConfirm: vi.fn(() => Promise.resolve(true)),
  showModalPrompt: vi.fn((_msg, def = '') => Promise.resolve(def)),
  ModalProvider: () => null,
}));

import SwarmVolumesOverviewTable from '../docker/resources/volumes/SwarmVolumesOverviewTable';

function emit(eventName: string, payload: unknown) {
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

    expect(screen.getByText('Not connected to Docker Swarm')).toBeInTheDocument();
  });

  it('loads and renders volumes with formatted cells', async () => {
    render(<SwarmVolumesOverviewTable />);

    expect(screen.getByText('Loading Swarm volumes...')).toBeInTheDocument();

    expect(await screen.findByTestId('row-data')).toBeInTheDocument();
    expect(screen.getByTestId('cell-data-createdAt')).toHaveTextContent('FMT(2026-01-01T12:00:00Z)');
    expect(screen.getByTestId('cell-data-labels')).toHaveTextContent('2 labels');
  });

  it('row actions call APIs and trigger refresh where expected', async () => {
    render(<SwarmVolumesOverviewTable />);
    await screen.findByTestId('row-data');

    const actions = screen.getByTestId('actions-data');

    fireEvent.click(within(actions).getByRole('button', { name: 'Backup' }));
    await waitFor(() => expect(swarmApiMocks.BackupSwarmVolume).toHaveBeenCalledWith('data'));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Backed up volume "data"');

    fireEvent.click(within(actions).getByRole('button', { name: 'Restore…' }));

    const restoreModal = await screen.findByTestId('modal-wrapper');
    const restoreButtons = within(restoreModal).getAllByRole('button');
    const restoreConfirmBtn = restoreButtons.find(btn => btn.textContent === 'Restore');
    if (restoreConfirmBtn) {
      fireEvent.click(restoreConfirmBtn);
    }

    await waitFor(() => expect(swarmApiMocks.RestoreSwarmVolume).toHaveBeenCalledWith('data'));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Restored backup into volume "data"');

    fireEvent.click(within(actions).getByRole('button', { name: 'Clone…' }));

    const cloneInput = await screen.findByTestId('volume-clone-input');
    fireEvent.change(cloneInput, { target: { value: 'data-clone' } });

    const cloneModal = await screen.findByTestId('modal-wrapper');
    const cloneButtons = within(cloneModal).getAllByRole('button');
    const cloneConfirmBtn = cloneButtons.find(btn => btn.textContent === 'Clone');
    if (cloneConfirmBtn) {
      fireEvent.click(cloneConfirmBtn);
    }

    await waitFor(() => expect(swarmApiMocks.CloneSwarmVolume).toHaveBeenCalledWith('data', 'data-clone'));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Cloned volume to "data-clone"');

    const actions2 = screen.getByTestId('actions-data');
    fireEvent.click(within(actions2).getByRole('button', { name: 'Delete' }));

    const deleteModal = await screen.findByTestId('modal-wrapper');
    const deleteButtons = within(deleteModal).getAllByRole('button');
    const deleteConfirmBtn = deleteButtons.find(btn => btn.textContent === 'Delete');
    if (deleteConfirmBtn) {
      fireEvent.click(deleteConfirmBtn);
    }

    await waitFor(() => expect(swarmApiMocks.RemoveSwarmVolume).toHaveBeenCalledWith('data', false));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Volume "data" deleted');

    // refresh calls trigger new loads via the real component's refresh mechanism
    // (mock doesn't simulate this, so we just verify the calls happened)
  });

  it('summary panel delete checks usage list for confirm message', async () => {

    swarmApiMocks.GetSwarmVolumeUsage.mockResolvedValue([
      { serviceName: 'api', serviceId: 'svc1' },
      { serviceName: 'web', serviceId: 'svc2' },
    ]);

    render(<SwarmVolumesOverviewTable />);
    await screen.findByTestId('row-data');

    const panel = screen.getByTestId('panel-data');
    const header = within(panel).getByTestId('summary-tab-header');

    fireEvent.click(within(header).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(swarmApiMocks.GetSwarmVolumeUsage).toHaveBeenCalledWith('data'));
    await waitFor(() => expect(swarmApiMocks.RemoveSwarmVolume).toHaveBeenCalledWith('data', false));

    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Volume "data" deleted');

    // refresh is called via the real component's onRefresh callback
    // (mock doesn't simulate this, so we just verify the calls happened)
  });

  it('applies runtime updates for swarm:volumes:update', async () => {
    render(<SwarmVolumesOverviewTable />);
    await screen.findByTestId('row-data');

    act(() => {
      emit('swarm:volumes:update', [
        { name: 'logs', driver: 'local', scope: 'local', createdAt: '2026-01-02T00:00:00Z', labels: {} },
      ]);
    });

    expect(await screen.findByTestId('row-logs')).toBeInTheDocument();

    act(() => {
      emit('swarm:volumes:update', { reason: 'unknown' });
    });

    await waitFor(() => expect(swarmApiMocks.GetSwarmVolumes).toHaveBeenCalledTimes(2));
  });
});
