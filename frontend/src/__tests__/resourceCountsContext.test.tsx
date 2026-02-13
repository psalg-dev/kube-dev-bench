import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResourceCountsProvider, useResourceCounts } from '../state/ResourceCountsContext';

vi.mock('../state/ClusterStateContext', () => ({
  useClusterState: () => ({ selectedNamespaces: ['default'] }),
}));

vi.mock('../../wailsjs/runtime', () => {
  let handler: ((_payload: unknown) => void) | null = null;
  return {
    EventsOn: (event: string, cb: (_payload: unknown) => void) => {
      if (event === 'resourcecounts:update') handler = cb;
      return () => {
        handler = null;
      };
    },
    __emit: (payload: unknown) => {
      if (handler) handler(payload);
    },
  };
});

vi.mock('../k8s/resources/kubeApi', () => ({
  GetResourceCounts: () =>
    Promise.resolve({
      podStatus: { running: 1, pending: 0, failed: 0, succeeded: 0, unknown: 0, total: 1 },
      deployments: 2,
    }),
}));

// Expose a fake Wails binding on window so the provider's waitForWailsBinding check passes
beforeAll(() => {
  (window as unknown).go = {
    main: {
      App: {
        GetResourceCounts: () => Promise.resolve({}),
      },
    },
  };
});

afterAll(() => {
  delete (window as unknown).go;
});

function Probe() {
  const { counts } = useResourceCounts();
  return <pre data-testid="counts">{JSON.stringify(counts || null)}</pre>;
}

describe('ResourceCountsContext', () => {
  it('provides initial counts and updates on event', async () => {
    const { findByTestId } = render(
      <ResourceCountsProvider>
        <Probe />
      </ResourceCountsProvider>
    );
    const pre = await findByTestId('counts');

    // Wait for the async provider to fetch and populate counts
    await waitFor(() => {
      const parsed = JSON.parse(pre.textContent || 'null');
      expect(parsed).not.toBeNull();
      expect(parsed.podStatus.running).toBe(1);
    });
    const initial = JSON.parse(pre.textContent || 'null');
    expect(initial.podStatus.running).toBe(1);
    expect(initial.deployments).toBe(2);

    const runtime = await import('../../wailsjs/runtime');
    const emitter = runtime as unknown as { __emit: (_payload: unknown) => void };
    await act(async () => {
      emitter.__emit({
        podStatus: { running: 3, pending: 1, failed: 0, succeeded: 0, unknown: 0, total: 4 },
        deployments: 5,
      });
    });
    const updated = JSON.parse(pre.textContent || 'null');
    expect(updated.podStatus.running).toBe(3);
    expect(updated.podStatus.pending).toBe(1);
    expect(updated.deployments).toBe(5);
  });
});
