import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  runtimeHandlers,
  swarmApiMocks,
  holmesApiMocks,
  notificationMocks,
  swarmStateMocks,
  holmesChatHandlerRef,
  holmesContextHandlerRef,
} = vi.hoisted(() => {
  return {
    runtimeHandlers: new Map<string, (_payload: unknown) => void>(),
    holmesChatHandlerRef: { current: null as ((_payload: unknown) => void) | null },
    holmesContextHandlerRef: { current: null as ((_payload: unknown) => void) | null },
    swarmApiMocks: {
      GetSwarmStacks: vi.fn(),
      GetSwarmStackServices: vi.fn(),
      GetSwarmStackResources: vi.fn(),
      RemoveSwarmStack: vi.fn(),
    },
    holmesApiMocks: {
      AnalyzeSwarmStackStream: vi.fn(),
      CancelHolmesStream: vi.fn(),
      onHolmesChatStream: vi.fn((cb: (_payload: unknown) => void) => {
        holmesChatHandlerRef.current = cb;
        return vi.fn();
      }),
      onHolmesContextProgress: vi.fn((cb: (_payload: unknown) => void) => {
        holmesContextHandlerRef.current = cb;
        return vi.fn();
      }),
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

vi.mock('../../wailsjs/runtime', () => ({
  EventsOn: vi.fn((eventName: string, cb: (_payload: unknown) => void) => {
    runtimeHandlers.set(eventName, cb);
    return vi.fn();
  }),
}));

vi.mock('../docker/swarmApi', () => swarmApiMocks);
vi.mock('../holmes/holmesApi', () => holmesApiMocks);
vi.mock('../notification', () => notificationMocks);
vi.mock('../docker/SwarmStateContext', () => swarmStateMocks);

vi.mock('../layout/overview/OverviewTableWithPanel', () => ({
  default: function OverviewTableWithPanelMock(props: {
    title: string;
    data?: Array<Record<string, unknown>>;
    tabCountsFetcher?: (_row: Record<string, unknown>) => Promise<Record<string, number>>;
    getRowActions?: (_row: Record<string, unknown>) => Array<{ label: string; onClick: () => void }>;
    renderPanelContent?: (_row: Record<string, unknown>, _tab: string) => React.ReactNode;
  }) {
    const rows = Array.isArray(props.data) ? props.data : [];
    const firstRow = rows[0];
    return (
      <div data-testid="overview-table">
        <div data-testid="title">{props.title}</div>
        {rows.map((row) => {
          const name = String((row as { name?: unknown }).name ?? '');
          const actions = props.getRowActions?.(row) || [];
          return (
            <div key={name} data-testid={`row-${name}`}>
              <span>{name}</span>
              {actions.map((a) => (
                <button key={`${name}-${a.label}`} type="button" onClick={a.onClick}>{a.label}</button>
              ))}
            </div>
          );
        })}

        {firstRow ? (
          <>
            <button
              type="button"
              onClick={async () => {
                const counts = await props.tabCountsFetcher?.(firstRow);
                (window as Window & { __testCounts?: Record<string, number> }).__testCounts = counts;
              }}
            >
              Fetch Counts
            </button>
            <div data-testid="panel-services">{props.renderPanelContent?.(firstRow, 'services')}</div>
            <div data-testid="panel-holmes">{props.renderPanelContent?.(firstRow, 'holmes')}</div>
          </>
        ) : null}
      </div>
    );
  },
}));

vi.mock('../docker/resources/stacks/StackServicesTab', () => ({
  default: function StackServicesTabMock({ stackName }: { stackName?: string }) {
    return <div data-testid="stack-services-tab">services:{stackName}</div>;
  },
}));

vi.mock('../docker/resources/stacks/StackResourcesTab', () => ({
  default: function StackResourcesTabMock({ stackName, resource }: { stackName?: string; resource?: string }) {
    return <div data-testid="stack-resources-tab">{resource}:{stackName}</div>;
  },
}));

vi.mock('../docker/resources/stacks/StackComposeTab', () => ({
  default: function StackComposeTabMock({ stackName }: { stackName?: string }) {
    return <div data-testid="stack-compose-tab">compose:{stackName}</div>;
  },
}));

vi.mock('../holmes/HolmesBottomPanel', () => ({
  default: function HolmesBottomPanelMock({
    onAnalyze,
    onCancel,
    loading,
    streamingText,
    error,
  }: {
    onAnalyze?: () => void;
    onCancel?: () => void;
    loading?: boolean;
    streamingText?: string;
    error?: string | null;
  }) {
    return (
      <div data-testid="holmes-panel">
        <button type="button" onClick={onAnalyze}>Analyze Holmes</button>
        {onCancel ? <button type="button" onClick={onCancel}>Cancel Holmes</button> : null}
        <span data-testid="holmes-loading">{loading ? 'loading' : 'idle'}</span>
        <span data-testid="holmes-stream">{streamingText || ''}</span>
        <span data-testid="holmes-error">{error || ''}</span>
      </div>
    );
  },
}));

import SwarmStacksOverviewTable from '../docker/resources/stacks/SwarmStacksOverviewTable';

function emitRuntime(eventName: string, payload: unknown) {
  const cb = runtimeHandlers.get(eventName);
  if (!cb) throw new Error(`No handler registered for ${eventName}`);
  cb(payload);
}

describe('SwarmStacksOverviewTable', () => {
  beforeEach(() => {
    runtimeHandlers.clear();
    holmesChatHandlerRef.current = null;
    holmesContextHandlerRef.current = null;
    delete (window as Window & { __testCounts?: Record<string, number> }).__testCounts;
    vi.clearAllMocks();

    swarmStateMocks.useSwarmState.mockReturnValue({ connected: true });
    swarmApiMocks.GetSwarmStacks.mockResolvedValue([
      { name: 'demo', services: 2, orchestrator: 'Swarm' },
    ]);
    swarmApiMocks.GetSwarmStackServices.mockResolvedValue([
      { id: 'svc1', name: 'demo_api' },
      { id: 'svc2', name: 'demo_worker' },
    ]);
    swarmApiMocks.GetSwarmStackResources.mockResolvedValue({
      networks: [{ id: 'n1' }],
      volumes: [{ id: 'v1' }, { id: 'v2' }],
      configs: [{ id: 'c1' }],
      secrets: [],
    });
    swarmApiMocks.RemoveSwarmStack.mockResolvedValue(undefined);
    holmesApiMocks.AnalyzeSwarmStackStream.mockResolvedValue(undefined);
    holmesApiMocks.CancelHolmesStream.mockResolvedValue(undefined);
  });

  it('shows disconnected state when swarm is not connected', () => {
    swarmStateMocks.useSwarmState.mockReturnValue({ connected: false });

    render(<SwarmStacksOverviewTable />);

    expect(screen.getByText('Not connected to Docker Swarm')).toBeInTheDocument();
  });

  it('loads stacks, resolves tab counts, and renders stack services tab panel', async () => {
    render(<SwarmStacksOverviewTable />);

    expect(await screen.findByTestId('row-demo')).toBeInTheDocument();
    expect(screen.getByTestId('title')).toHaveTextContent('Swarm Stacks');
    expect(screen.getByTestId('stack-services-tab')).toHaveTextContent('services:demo');

    fireEvent.click(screen.getByRole('button', { name: 'Fetch Counts' }));

    await waitFor(() => {
      expect(swarmApiMocks.GetSwarmStackServices).toHaveBeenCalledWith('demo');
      expect(swarmApiMocks.GetSwarmStackResources).toHaveBeenCalledWith('demo');
    });

    expect((window as Window & { __testCounts?: Record<string, number> }).__testCounts).toEqual({
      services: 2,
      networks: 1,
      volumes: 2,
      configs: 1,
      secrets: 0,
    });
  });

  it('deletes a stack from row action and refreshes list', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<SwarmStacksOverviewTable />);
    await screen.findByTestId('row-demo');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(swarmApiMocks.RemoveSwarmStack).toHaveBeenCalledWith('demo'));
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Removed stack "demo"');
    await waitFor(() => expect(swarmApiMocks.GetSwarmStacks).toHaveBeenCalledTimes(2));
  });

  it('updates rows from runtime events and refreshes for non-array payloads', async () => {
    render(<SwarmStacksOverviewTable />);
    await screen.findByTestId('row-demo');

    act(() => {
      emitRuntime('swarm:stacks:update', [{ name: 'next', services: 1, orchestrator: 'Swarm' }]);
    });
    expect(await screen.findByTestId('row-next')).toBeInTheDocument();

    act(() => {
      emitRuntime('swarm:stacks:update', { reason: 'poll' });
    });
    await waitFor(() => expect(swarmApiMocks.GetSwarmStacks).toHaveBeenCalledTimes(2));
  });

  it('starts Holmes analysis and streams ai_message content', async () => {
    render(<SwarmStacksOverviewTable />);
    await screen.findByTestId('row-demo');

    fireEvent.click(screen.getByRole('button', { name: 'Analyze Holmes' }));

    await waitFor(() => expect(holmesApiMocks.AnalyzeSwarmStackStream).toHaveBeenCalledWith('demo', expect.any(String)));

    act(() => {
      holmesChatHandlerRef.current?.({
        stream_id: (holmesApiMocks.AnalyzeSwarmStackStream.mock.calls[0]?.[1] as string),
        event: 'ai_message',
        data: JSON.stringify({ content: 'analysis line 1' }),
      });
    });

    expect(screen.getByTestId('holmes-stream')).toHaveTextContent('analysis line 1');
  });
});
