import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../docker/swarmApi', () => ({
  GetSwarmMetricsHistory: vi.fn(() => Promise.resolve([{ timestamp: 't1', services: 1, tasks: 2, runningTasks: 1, nodes: 1, readyNodes: 1 }])),
}));

const handlers = new Map<string, (_payload: unknown) => void>();
vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn((_event: string, cb: (_payload: unknown) => void) => {
    handlers.set(_event, cb);
    return () => { handlers.delete(_event); };
  }),
  EventsOff: vi.fn(),
}));
import { MetricsStateProvider, useClusterMetrics } from '../docker/metrics/MetricsStateContext';

function Probe() {
  const { latest, history, services, nodes } = useClusterMetrics();
  return (
    <div>
      <div data-testid="latest">{latest ? String(latest.services) : 'none'}</div>
      <div data-testid="len">{String(history?.length ?? 0)}</div>
      <div data-testid="svc">{String(services?.length ?? 0)}</div>
      <div data-testid="nodes">{String(nodes?.length ?? 0)}</div>
    </div>
  );
}

describe('MetricsStateContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
  });

  it('loads initial history and updates from events', async () => {
    render(
      <MetricsStateProvider>
        <Probe />
      </MetricsStateProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('latest').textContent).toBe('1');
      expect(screen.getByTestId('len').textContent).toBe('1');
    });

    await act(async () => {
      handlers.get('swarm:metrics:update')?.({ timestamp: 't2', services: 5 });
    });

    await waitFor(() => {
      expect(screen.getByTestId('latest').textContent).toBe('5');
      expect(Number(screen.getByTestId('len').textContent)).toBe(2);
    });

    await act(async () => {
      handlers.get('swarm:metrics:breakdown')?.({
        timestamp: 't2',
        services: [{ serviceId: 's1', serviceName: 'svc', cpuPercent: 12.3 }],
        nodes: [{ nodeId: 'n1', hostname: 'node', cpuPercent: 1.1 }],
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('svc').textContent).toBe('1');
      expect(screen.getByTestId('nodes').textContent).toBe('1');
    });
  });
});
