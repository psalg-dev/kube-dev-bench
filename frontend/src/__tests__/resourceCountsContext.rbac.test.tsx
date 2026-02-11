import { describe, it, expect, vi, act, waitFor, beforeAll, afterAll } from 'vitest';
import { render } from '@testing-library/react';
import { ResourceCountsProvider, useResourceCounts } from '../state/ResourceCountsContext';

vi.mock('../../wailsjs/runtime', () => {
  let handler: ((payload: unknown) => void) | null = null;
  return {
    EventsOn: (event: string, cb: (payload: unknown) => void) => {
      if (event === 'resourcecounts:update') handler = cb;
      return () => { handler = null; };
    },
    __emit: (payload: unknown) => { if (handler) handler(payload); },
  };
});

vi.mock('../k8s/resources/kubeApi', () => ({
  GetResourceCounts: () => Promise.resolve({
    podStatus: { running: 0, pending: 0, failed: 0, succeeded: 0, unknown: 0, total: 0 },
    deployments: 1,
    roles: 1,
    clusterroles: 0,
    rolebindings: 0,
    clusterrolebindings: 0,
  }),
}));

// Expose fake Wails binding for waitForWailsBinding
beforeAll(() => {
  (window as any).go = { main: { App: { GetResourceCounts: () => Promise.resolve({}) } } };
});
afterAll(() => { delete (window as any).go; });

function Probe() {
  const { counts, lastUpdated } = useResourceCounts();
  return <pre data-testid="counts">{JSON.stringify({ counts, lastUpdated })}</pre> as any;
}

describe('ResourceCountsContext RBAC updates', () => {
  it('updates when RBAC counts change', async () => {
    const { findByTestId } = render(
      <ResourceCountsProvider>
        <Probe />
      </ResourceCountsProvider>
    );

    const pre = await findByTestId('counts');

    await waitFor(() => {
      const parsed = JSON.parse(pre.textContent || '{}');
      expect(parsed.counts.roles).toBe(1);
      expect(parsed.counts.deployments).toBe(1);
    });

    const initial = JSON.parse(pre.textContent || '{}');
    const initialUpdated = initial.lastUpdated;

    const runtime = await import('../../wailsjs/runtime');
    const emitter = runtime as unknown as { __emit: (payload: unknown) => void };

    await act(async () => {
      emitter.__emit({ roles: 2 });
    });

    const updated = JSON.parse(pre.textContent || '{}');
    expect(updated.counts.roles).toBe(2);
    expect(updated.lastUpdated).toBeGreaterThan(initialUpdated);
  });
});
