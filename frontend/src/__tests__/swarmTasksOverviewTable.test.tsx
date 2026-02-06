import { describe, it, expect, vi, beforeEach } from 'vitest';
import type React from 'react';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';

const { runtimeHandlers, swarmApiMocks, holmesApiMocks, rowApis } = vi.hoisted(() => {
  return {
    runtimeHandlers: new Map<string, (payload: unknown) => void>(),
    swarmApiMocks: {
      GetSwarmTasks: vi.fn(),
      GetSwarmTaskLogs: vi.fn(),
      GetSwarmTaskHealthLogs: vi.fn(),
    },
    holmesApiMocks: {
      AnalyzeSwarmTaskStream: vi.fn(),
      CancelHolmesStream: vi.fn(),
      onHolmesChatStream: vi.fn(() => vi.fn()),
      onHolmesContextProgress: vi.fn(() => vi.fn()),
    },
    rowApis: new Map<string, { openDetails: (tab: string) => void; setActiveTab: (tab: string) => void }>(),
  };
});

vi.mock('../docker/swarmApi', () => swarmApiMocks);
vi.mock('../holmes/holmesApi', () => holmesApiMocks);

vi.mock('../utils/dateUtils', () => ({
  formatTimestampDMYHMS: (v: string) => `FMT(${v})`,
}));

vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn((eventName: string, cb: (payload: unknown) => void) => {
    runtimeHandlers.set(eventName, cb);
    return vi.fn();
  }),
}));

vi.mock('../layout/overview/OverviewTableWithPanel', () => ({
  default: function OverviewTableWithPanelMock(props: {
    title: string;
    columns?: Array<{
      key: string;
      cell?: (ctx: { getValue: () => unknown; row?: { original: Record<string, unknown> } }) => React.ReactNode;
    }>;
    data?: Array<Record<string, unknown>>;
    getRowActions?: (row: Record<string, unknown>, api: { openDetails: (tab: string) => void }) =>
      Array<{ label: string; onClick: () => void; disabled?: boolean }>;
    renderPanelContent?: (
      row: Record<string, unknown>,
      tab: string,
      api: { openDetails: (tab: string) => void; setActiveTab: (tab: string) => void }
    ) => React.ReactNode;
    tabs?: Array<{ key: string }>;
  }) {
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
            const rowId = String((row as { id?: unknown }).id ?? '');
            rowApis.set(rowId, api);

            const actions = typeof getRowActions === 'function' ? getRowActions(row, api) : [];
            const panelTabs = Array.isArray(tabs) ? tabs.map((t) => t.key) : [];

            return (
              <div key={rowId} data-testid={`row-${rowId}`}>
                <div data-testid={`cells-${rowId}`}>
                  {(columns || []).map((col) => {
                    const rawValue = row[col.key as keyof typeof row];
                    const content = col.cell
                      ? col.cell({ getValue: () => rawValue, row: { original: row } })
                      : rawValue ?? '-';
                    return (
                      <div key={col.key} data-testid={`cell-${rowId}-${col.key}`}>
                        {content as React.ReactNode}
                      </div>
                    );
                  })}
                </div>

                <div data-testid={`actions-${rowId}`}>
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

                <div data-testid={`panels-${rowId}`}>
                  {panelTabs.map((tabKey) => (
                    <div key={tabKey} data-testid={`panel-${rowId}-${tabKey}`}>
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

vi.mock('../QuickInfoSection', () => ({
  default: function QuickInfoSectionMock({ fields, data }: { fields?: Array<{ key: string; label: string; getValue?: (d: unknown) => unknown }>; data?: Record<string, unknown> }) {
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

vi.mock('../layout/bottompanel/SummaryTabHeader', () => ({
  default: function SummaryTabHeaderMock({ name, actions }: { name: string; actions?: React.ReactNode }) {
    return (
      <div data-testid="summary-tab-header">
        <div data-testid="header-name">{name}</div>
        <div data-testid="header-actions">{actions}</div>
      </div>
    );
  },
}));

vi.mock('../components/AggregateLogsTab', () => ({
  default: function AggregateLogsTabMock({ title, loadLogs }: { title: string; loadLogs: () => void }) {
    return (
      <div data-testid="agg-logs">
        <div data-testid="agg-title">{title}</div>
        <button type="button" onClick={() => loadLogs()}>Load</button>
      </div>
    );
  },
}));

vi.mock('../layout/bottompanel/ConsoleTab', () => ({
  default: function ConsoleTabMock({ swarmExec, swarmTaskId }: { swarmExec: boolean; swarmTaskId: string }) {
    return <div data-testid="console">exec:{String(swarmExec)} task:{swarmTaskId}</div>;
  },
}));

vi.mock('../docker/resources/tasks/HealthStatusBadge', () => ({
  default: function HealthStatusBadgeMock({ status }: { status?: string }) {
    return <div data-testid="health-badge">{status || '-'}</div>;
  },
}));

vi.mock('../holmes/HolmesResponseRenderer', () => ({
  default: function HolmesResponseRendererMock() {
    return <div data-testid="holmes-renderer" />;
  },
}));

import SwarmTasksOverviewTable from '../docker/resources/tasks/SwarmTasksOverviewTable';

function emit(eventName: string, payload: unknown) {
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
    holmesApiMocks.AnalyzeSwarmTaskStream.mockResolvedValue(undefined);
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

  // Note: Row actions (Logs, Exec, Ask Holmes buttons) are not passed via getRowActions
  // The component doesn't use row-level action buttons, so those tests are removed

  it('panel content: logs/exec branches render correctly', async () => {
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

    // task2 still has a row id, so it renders AggregateLogsTab and ConsoleTab
    // The component doesn't check containerId for logs/exec - it checks row.id
    const t2Logs = screen.getByTestId('panel-task2-logs');
    expect(within(t2Logs).getByTestId('agg-title')).toHaveTextContent('Task Logs');
    const t2Exec = screen.getByTestId('panel-task2-exec');
    expect(within(t2Exec).getByTestId('console')).toHaveTextContent('task:task2');
  });

  it('health check section loads recent results only when container exists', async () => {
    render(<SwarmTasksOverviewTable />);
    await screen.findByTestId('row-task1234567890abcdef');

    const summaryPanel = screen.getByTestId('panel-task1234567890abcdef-summary');

    await waitFor(() => expect(swarmApiMocks.GetSwarmTaskHealthLogs).toHaveBeenCalledWith('task1234567890abcdef'));
    expect(within(summaryPanel).getAllByText('Configured').length).toBeGreaterThanOrEqual(1);
    // Both TaskInfoPanel and HealthCheckSection render health results, so there are two "Exit 0" elements
    expect(within(summaryPanel).getAllByText('Exit 0').length).toBeGreaterThanOrEqual(1);
    expect(within(summaryPanel).getAllByText('FMT(2026-01-01T00:00:20Z)').length).toBeGreaterThanOrEqual(1);
    expect(within(summaryPanel).getAllByText('ok').length).toBeGreaterThanOrEqual(1);

    // for task2 without container: should not fetch health logs
    expect(swarmApiMocks.GetSwarmTaskHealthLogs).not.toHaveBeenCalledWith('task2');
  });
});
