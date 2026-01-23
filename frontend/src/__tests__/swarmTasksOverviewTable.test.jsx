import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';

const { runtimeHandlers, swarmApiMocks, holmesApiMocks, rowApis } = vi.hoisted(() => {
  return {
    runtimeHandlers: new Map(),
    swarmApiMocks: {
      GetSwarmTasks: vi.fn(),
      GetSwarmTaskLogs: vi.fn(),
      GetSwarmTaskHealthLogs: vi.fn(),
    },
    holmesApiMocks: {
      AnalyzeSwarmTask: vi.fn(),
    },
    rowApis: new Map(),
  };
});

vi.mock('../docker/swarmApi.js', () => swarmApiMocks);
vi.mock('../../../holmes/holmesApi', () => holmesApiMocks);

vi.mock('../utils/dateUtils.js', () => ({
  formatTimestampDMYHMS: (v) => `FMT(${v})`,
}));

vi.mock('../../wailsjs/runtime/runtime.js', () => ({
  EventsOn: vi.fn((eventName, cb) => {
    runtimeHandlers.set(eventName, cb);
    return vi.fn();
  }),
}));

vi.mock('../layout/overview/OverviewTableWithPanel.jsx', () => ({
  default: function OverviewTableWithPanelMock(props) {
    const { title, columns, data, getRowActions, renderPanelContent, tabs } = props;
    const rows = Array.isArray(data) ? data : [];

    return (
      <div>
        <div data-testid="title">{title}</div>
        <div data-testid="rows">
          {rows.map((row) => {
            const api = {
              openDetails: vi.fn(),
              setActiveTab: vi.fn(),
            };
            rowApis.set(row.id, api);

            const actions = typeof getRowActions === 'function' ? getRowActions(row, api) : [];
            const panelTabs = Array.isArray(tabs) ? tabs.map((t) => t.key) : [];

            return (
              <div key={row.id} data-testid={`row-${row.id}`}>
                <div data-testid={`cells-${row.id}`}>
                  {(columns || []).map((col) => {
                    const rawValue = row[col.key];
                    const content = col.cell
                      ? col.cell({ getValue: () => rawValue, row: { original: row } })
                      : rawValue ?? '-';
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

                <div data-testid={`panels-${row.id}`}>
                  {panelTabs.map((tabKey) => (
                    <div key={tabKey} data-testid={`panel-${row.id}-${tabKey}`}>
                      {renderPanelContent?.(row, tabKey, api)}
                    </div>
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

vi.mock('../QuickInfoSection.jsx', () => ({
  default: function QuickInfoSectionMock({ fields, data }) {
    return (
      <div data-testid="quick-info">
        {(fields || []).map((f) => {
          const value = f.getValue ? f.getValue(data) : data?.[f.key];
          const text = Array.isArray(value) ? value.join(' | ') : String(value ?? '-');
          return (
            <div key={f.key} data-testid={`q-${f.key}`}>
              {f.label}:{text}
            </div>
          );
        })}
      </div>
    );
  },
}));

vi.mock('../layout/bottompanel/SummaryTabHeader.jsx', () => ({
  default: function SummaryTabHeaderMock({ name, actions }) {
    return (
      <div data-testid="summary-tab-header">
        <div data-testid="header-name">{name}</div>
        <div data-testid="header-actions">{actions}</div>
      </div>
    );
  },
}));

vi.mock('../components/AggregateLogsTab.jsx', () => ({
  default: function AggregateLogsTabMock({ title, loadLogs }) {
    return (
      <div data-testid="agg-logs">
        <div data-testid="agg-title">{title}</div>
        <button type="button" onClick={() => loadLogs()}>Load</button>
      </div>
    );
  },
}));

vi.mock('../layout/bottompanel/ConsoleTab.jsx', () => ({
  default: function ConsoleTabMock({ swarmExec, swarmTaskId }) {
    return <div data-testid="console">exec:{String(swarmExec)} task:{swarmTaskId}</div>;
  },
}));

vi.mock('../docker/resources/tasks/HealthStatusBadge.jsx', () => ({
  default: function HealthStatusBadgeMock({ status }) {
    return <div data-testid="health-badge">{status || '-'}</div>;
  },
}));

vi.mock('../../../holmes/HolmesResponseRenderer.jsx', () => ({
  default: function HolmesResponseRendererMock() {
    return <div data-testid="holmes-renderer" />;
  },
}));

import SwarmTasksOverviewTable from '../docker/resources/tasks/SwarmTasksOverviewTable.jsx';

function emit(eventName, payload) {
  const cb = runtimeHandlers.get(eventName);
  if (!cb) throw new Error(`No handler registered for ${eventName}`);
  cb(payload);
}

describe('SwarmTasksOverviewTable', () => {
  beforeEach(() => {
    runtimeHandlers.clear();
    rowApis.clear();
    vi.clearAllMocks();

    swarmApiMocks.GetSwarmTasks.mockResolvedValue([
      {
        id: 'task1234567890abcdef',
        serviceId: 'svc1',
        serviceName: 'api',
        nodeId: 'node1',
        nodeName: 'worker-1',
        slot: 1,
        state: 'running',
        desiredState: 'running',
        containerId: 'cont1234567890abcdef',
        healthStatus: 'healthy',
        healthCheck: { test: ['CMD-SHELL', 'curl', '-f', 'http://localhost/health'], retries: 2 },
        networks: [{ networkId: 'net1234567890abcdef', addresses: ['10.0.0.2/24'] }],
        mounts: [{ type: 'volume', source: 'data', target: '/data', readOnly: false }],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:01:00Z',
        image: 'nginx:latest',
      },
      {
        id: 'task2',
        serviceName: 'web',
        nodeName: 'worker-2',
        slot: 2,
        state: 'failed',
        desiredState: 'shutdown',
        containerId: '',
        healthStatus: '',
        healthCheck: null,
      },
    ]);

    swarmApiMocks.GetSwarmTaskLogs.mockResolvedValue('ok');
    swarmApiMocks.GetSwarmTaskHealthLogs.mockResolvedValue([
      { exitCode: 1, end: '2026-01-01T00:00:10Z', output: 'fail' },
      { exitCode: 0, end: '2026-01-01T00:00:20Z', output: 'ok' },
    ]);
    holmesApiMocks.AnalyzeSwarmTask.mockResolvedValue({ response: 'analysis' });
  });

  it('loads and renders tasks with formatted cells', async () => {
    render(<SwarmTasksOverviewTable />);

    expect(screen.getByText('Loading Swarm tasks...')).toBeInTheDocument();

    expect(await screen.findByTestId('row-task1234567890abcdef')).toBeInTheDocument();

    expect(screen.getByTestId('cell-task1234567890abcdef-id')).toHaveTextContent('task12345678...');
    expect(screen.getByTestId('cell-task1234567890abcdef-containerId')).toHaveTextContent('cont12345678...');

    // state cell styling
    const stateCell = screen.getByTestId('cell-task1234567890abcdef-state');
    const stateSpan = within(stateCell).getByText('running');
    expect(stateSpan).toHaveStyle({ color: '#3fb950' });

    // health badge renderer
    expect(within(screen.getByTestId('cell-task1234567890abcdef-healthStatus')).getByTestId('health-badge')).toHaveTextContent('healthy');
  });

  it('reacts to runtime updates: array replaces, non-array triggers reload', async () => {
    render(<SwarmTasksOverviewTable />);
    await screen.findByTestId('row-task2');

    act(() => {
      emit('swarm:tasks:update', [
        { id: 'task3', serviceName: 'db', nodeName: 'worker-3', slot: 3, state: 'running', desiredState: 'running', containerId: 'c3' },
      ]);
    });

    expect(await screen.findByTestId('row-task3')).toBeInTheDocument();

    act(() => {
      emit('swarm:tasks:update', { reason: 'unknown' });
    });

    await waitFor(() => expect(swarmApiMocks.GetSwarmTasks).toHaveBeenCalledTimes(2));
  });

  it('row actions open details for eligible tasks', async () => {
    render(<SwarmTasksOverviewTable />);
    await screen.findByTestId('row-task1234567890abcdef');

    const a1 = screen.getByTestId('actions-task1234567890abcdef');
    fireEvent.click(within(a1).getByRole('button', { name: 'Logs' }));
    fireEvent.click(within(a1).getByRole('button', { name: 'Exec' }));

    const api1 = rowApis.get('task1234567890abcdef');
    expect(api1.openDetails).toHaveBeenCalledWith('logs');
    expect(api1.openDetails).toHaveBeenCalledWith('exec');

    const a2 = screen.getByTestId('actions-task2');
    expect(within(a2).getByRole('button', { name: 'Logs' })).toBeDisabled();
    expect(within(a2).getByRole('button', { name: 'Exec' })).toBeDisabled();
  });

  it('adds Ask Holmes action for tasks', async () => {
    render(<SwarmTasksOverviewTable />);
    await screen.findByTestId('row-task1234567890abcdef');

    const actions = within(screen.getByTestId('actions-task1234567890abcdef'));
    const askButton = actions.getByRole('button', { name: 'Ask Holmes' });
    await act(async () => {
      fireEvent.click(askButton);
    });

    expect(holmesApiMocks.AnalyzeSwarmTask).toHaveBeenCalledWith('task1234567890abcdef');
  });

  it('panel content: logs/exec branches and exec button sets active tab', async () => {
    render(<SwarmTasksOverviewTable />);
    await screen.findByTestId('row-task1234567890abcdef');

    // logs tab uses AggregateLogsTab and calls GetSwarmTaskLogs with 500
    const logsPanel = screen.getByTestId('panel-task1234567890abcdef-logs');
    expect(within(logsPanel).getByTestId('agg-title')).toHaveTextContent('Task Logs');
    fireEvent.click(within(logsPanel).getByRole('button', { name: 'Load' }));
    expect(swarmApiMocks.GetSwarmTaskLogs).toHaveBeenCalledWith('task1234567890abcdef', '500');

    // exec tab renders ConsoleTab for running tasks
    const execPanel = screen.getByTestId('panel-task1234567890abcdef-exec');
    expect(within(execPanel).getByTestId('console')).toHaveTextContent('task:task1234567890abcdef');

    // summary tab exec button should call setActiveTab('exec')
    const summaryPanel = screen.getByTestId('panel-task1234567890abcdef-summary');
    const execBtn = within(summaryPanel).getByRole('button', { name: 'Exec' });
    expect(execBtn).not.toBeDisabled();
    fireEvent.click(execBtn);

    const api = rowApis.get('task1234567890abcdef');
    expect(api.setActiveTab).toHaveBeenCalledWith('exec');

    // task without container shows no-container messages
    const t2Logs = screen.getByTestId('panel-task2-logs');
    expect(within(t2Logs).getByText(/No container associated/)).toBeInTheDocument();
    const t2Exec = screen.getByTestId('panel-task2-exec');
    expect(within(t2Exec).getByText(/No container associated/)).toBeInTheDocument();
  });

  it('health check section loads recent results only when container exists', async () => {
    render(<SwarmTasksOverviewTable />);
    await screen.findByTestId('row-task1234567890abcdef');

    const summaryPanel = screen.getByTestId('panel-task1234567890abcdef-summary');

    await waitFor(() => expect(swarmApiMocks.GetSwarmTaskHealthLogs).toHaveBeenCalledWith('task1234567890abcdef'));
    expect(within(summaryPanel).getByText('Configured')).toBeInTheDocument();
    expect(within(summaryPanel).getByText('Exit 0')).toBeInTheDocument();
    expect(within(summaryPanel).getByText('FMT(2026-01-01T00:00:20Z)')).toBeInTheDocument();
    expect(within(summaryPanel).getByText('ok')).toBeInTheDocument();

    // for task2 without container: should not fetch health logs
    expect(swarmApiMocks.GetSwarmTaskHealthLogs).not.toHaveBeenCalledWith('task2');
  });
});
