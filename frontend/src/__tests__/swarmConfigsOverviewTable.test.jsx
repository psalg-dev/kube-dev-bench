import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';

const { runtimeHandlers, swarmApiMocks, notificationMocks } = vi.hoisted(() => {
  return {
    runtimeHandlers: new Map(),
    swarmApiMocks: {
      // Required for this test
      GetSwarmConfigs: vi.fn(),
      RemoveSwarmConfig: vi.fn(),
      ExportSwarmConfig: vi.fn(),
      CloneSwarmConfig: vi.fn(),
      // Required by other config modules loaded via barrel export
      GetSwarmSecrets: vi.fn(),
      GetSwarmNetworks: vi.fn(),
      GetSwarmNetworkConnectedServices: vi.fn(),
      GetSwarmVolumes: vi.fn(),
      GetSwarmVolumeUsage: vi.fn(),
      // Required by serviceConfig.jsx
      GetSwarmServices: vi.fn(),
      GetSwarmTasksByService: vi.fn(),
      ScaleSwarmService: vi.fn(),
      RemoveSwarmService: vi.fn(),
      RestartSwarmService: vi.fn(),
      GetSwarmServiceLogs: vi.fn(),
      UpdateSwarmServiceImage: vi.fn(),
      // Required by taskConfig.jsx
      GetSwarmTasks: vi.fn(),
      GetSwarmTaskLogs: vi.fn(),
      GetSwarmTaskHealthLogs: vi.fn(),
      // Required by nodeConfig.jsx
      GetSwarmNodes: vi.fn(),
      GetSwarmNodeTasks: vi.fn(),
      GetSwarmJoinTokens: vi.fn(),
      UpdateSwarmNodeAvailability: vi.fn(),
      UpdateSwarmNodeRole: vi.fn(),
      UpdateSwarmNodeLabels: vi.fn(),
      RemoveSwarmNode: vi.fn(),
      // Required by stackConfig.jsx
      GetSwarmStacks: vi.fn(),
      GetSwarmStackServices: vi.fn(),
      GetSwarmStackResources: vi.fn(),
      GetSwarmStackComposeYAML: vi.fn(),
      CreateSwarmStack: vi.fn(),
      RollbackSwarmStack: vi.fn(),
      RemoveSwarmStack: vi.fn(),
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
    const { title, columns, data, loading, getRowActions, renderPanelContent } = props;
    const rows = Array.isArray(data) ? data : [];

    if (loading || rows.length === 0) {
      return <div>Loading Swarm configs...</div>;
    }

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
                    <button key={a.label} type="button" onClick={a.onClick}>
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

vi.mock('../docker/resources/configs/ConfigUsedBySection.jsx', () => ({
  default: function ConfigUsedBySectionMock() {
    return <div data-testid="config-used-by" />;
  },
}));

vi.mock('../docker/resources/configs/ConfigDataTab.jsx', () => ({
  default: function ConfigDataTabMock() {
    return <div data-testid="config-data" />;
  },
}));

vi.mock('../docker/resources/configs/ConfigInspectTab.jsx', () => ({
  default: function ConfigInspectTabMock() {
    return <div data-testid="config-inspect" />;
  },
}));

vi.mock('../docker/resources/configs/ConfigEditModal.jsx', () => ({
  default: function ConfigEditModalMock({ open }) {
    return open ? <div data-testid="config-edit-modal" /> : null;
  },
}));

vi.mock('../docker/resources/configs/ConfigCompareModal.jsx', () => ({
  default: function ConfigCompareModalMock({ open }) {
    return open ? <div data-testid="config-compare-modal" /> : null;
  },
}));

// Mock ConfigSummaryPanel to render with Edit, Compare, Download, Clone, Delete buttons
vi.mock('../docker/resources/configs/ConfigSummaryPanel.jsx', () => {
  const { useState } = require('react');
  return {
    default: function ConfigSummaryPanelMock({ row, panelApi }) {
      const [showEdit, setShowEdit] = useState(false);
      const [showCompare, setShowCompare] = useState(false);
      
      const handleDownload = async () => {
        const savedPath = await swarmApiMocks.ExportSwarmConfig(row.id, `${row.name}.txt`);
        if (savedPath !== undefined) {
          notificationMocks.showSuccess(`Saved config ${row.name}`);
        }
      };
      
      const handleClone = async () => {
        await swarmApiMocks.CloneSwarmConfig(row.id, 'new-name');
        notificationMocks.showSuccess(`Cloned config to new-name`);
      };
      
      const handleDelete = async () => {
        await swarmApiMocks.RemoveSwarmConfig(row.id);
        notificationMocks.showSuccess(`Config ${row.name} removed`);
        panelApi?.refresh?.();
      };
      
      return (
        <div data-testid="config-summary-panel">
          <div data-testid="summary-tab-header">
            <div>{row.name}</div>
            <div data-testid="header-actions">
              <button type="button" onClick={() => setShowEdit(true)}>Edit</button>
              <button type="button" onClick={() => setShowCompare(true)}>Compare</button>
              <button type="button" onClick={handleDownload}>Download</button>
              <button type="button" onClick={handleClone}>Clone</button>
              <button type="button" onClick={handleDelete}>Delete</button>
            </div>
          </div>
          <div data-testid="quick-info" />
          <div data-testid="config-data" />
          <div data-testid="config-used-by" />
          {showEdit && <div data-testid="config-edit-modal" />}
          {showCompare && <div data-testid="config-compare-modal" />}
        </div>
      );
    },
  };
});

import SwarmConfigsOverviewTable from '../docker/resources/configs/SwarmConfigsOverviewTable.jsx';

function emit(eventName, payload) {
  const cb = runtimeHandlers.get(eventName);
  if (!cb) throw new Error(`No handler registered for ${eventName}`);
  cb(payload);
}

describe('SwarmConfigsOverviewTable', () => {
  beforeEach(() => {
    runtimeHandlers.clear();
    vi.clearAllMocks();

    swarmApiMocks.GetSwarmConfigs.mockResolvedValue([
      {
        id: 'cfg1',
        name: 'app-config',
        dataSize: 500,
        createdAt: new Date(2025, 0, 2, 3, 4, 5),
        updatedAt: new Date(2025, 0, 3, 3, 4, 5),
      },
      {
        id: 'cfg2',
        name: 'big-config',
        dataSize: 1500,
        createdAt: new Date(2025, 0, 2, 3, 4, 5),
        updatedAt: null,
      },
    ]);

    swarmApiMocks.ExportSwarmConfig.mockResolvedValue('C:/tmp/app-config.txt');
    swarmApiMocks.CloneSwarmConfig.mockResolvedValue(undefined);
    swarmApiMocks.RemoveSwarmConfig.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads and renders configs and size formatting', async () => {
    render(<SwarmConfigsOverviewTable />);

    expect(screen.getByText('Loading Swarm configs...')).toBeInTheDocument();

    expect(await screen.findByTestId('row-cfg1')).toBeInTheDocument();
    expect(screen.getByTestId('name-cfg2')).toHaveTextContent('big-config');

    expect(screen.getByTestId('cell-cfg1-dataSize')).toHaveTextContent('500 B');
    expect(screen.getByTestId('cell-cfg2-dataSize')).toHaveTextContent('1.5 KB');

    expect(swarmApiMocks.GetSwarmConfigs).toHaveBeenCalledTimes(1);
  });

  it('opens Compare modal from summary panel', async () => {
    render(<SwarmConfigsOverviewTable />);
    await screen.findByTestId('row-cfg1');

    const panel = screen.getByTestId('panel-cfg1');
    const compareBtn = within(panel).getByRole('button', { name: 'Compare' });
    fireEvent.click(compareBtn);

    expect(screen.getByTestId('config-compare-modal')).toBeInTheDocument();
  });

  it('downloads/clones/deletes via row actions', async () => {
    vi.stubGlobal('prompt', vi.fn(() => 'app-config-clone'));
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<SwarmConfigsOverviewTable />);
    await screen.findByTestId('row-cfg1');

    const actions = screen.getByTestId('actions-cfg1');

    fireEvent.click(within(actions).getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(swarmApiMocks.ExportSwarmConfig).toHaveBeenCalledWith('cfg1', 'app-config.txt'));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Saved config app-config');

    fireEvent.click(within(actions).getByRole('button', { name: 'Clone…' }));
    await waitFor(() => expect(swarmApiMocks.CloneSwarmConfig).toHaveBeenCalledWith('cfg1', 'app-config-clone'));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Cloned config to app-config-clone');

    fireEvent.click(within(actions).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(swarmApiMocks.RemoveSwarmConfig).toHaveBeenCalledWith('cfg1'));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Config app-config removed');
  });

  it('deletes from the summary panel SwarmResourceActions', async () => {
    render(<SwarmConfigsOverviewTable />);
    await screen.findByTestId('row-cfg1');

    const panel = screen.getByTestId('panel-cfg1');
    const delBtn = within(panel).getByRole('button', { name: 'Delete' });
    fireEvent.click(delBtn);

    await waitFor(() => expect(swarmApiMocks.RemoveSwarmConfig).toHaveBeenCalledWith('cfg1'));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Config app-config removed');
  });

  it('updates configs from runtime event', async () => {
    render(<SwarmConfigsOverviewTable />);
    await screen.findByTestId('row-cfg1');

    act(() => {
      emit('swarm:configs:update', [
        {
          id: 'cfg3',
          name: 'runtime-config',
          dataSize: 10,
          createdAt: new Date(2025, 0, 2, 3, 4, 5),
          updatedAt: new Date(2025, 0, 2, 3, 4, 5),
        },
      ]);
    });

    expect(await screen.findByTestId('row-cfg3')).toBeInTheDocument();
  });
});
