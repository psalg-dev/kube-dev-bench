import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceCountsProvider, useResourceCounts } from '../state/ResourceCountsContext';

vi.mock('../state/ClusterStateContext', () => ({
  useClusterState: () => ({ selectedNamespaces: ['default'] }),
}));

const getResourceCounts = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({
    PodStatus: { Running: 1, Pending: 0, Failed: 0, Succeeded: 0, Unknown: 0, Total: 1 },
    Roles: 2,
    ClusterRoles: 3,
    RoleBindings: 4,
    ClusterRoleBindings: 5,
  }))
);

const onCallback = vi.hoisted(() => ({
  handler: undefined as ((_data: unknown) => void) | undefined,
}));
vi.mock('../k8s/resources/kubeApi', () => ({
  GetResourceCounts: getResourceCounts,
}));

vi.mock('../../wailsjs/runtime', () => ({
  EventsOn: vi.fn((eventName: string, cb: (_data: unknown) => void) => {
    onCallback.handler = cb;
    return () => {};
  }),
}));
describe('ResourceCountsProvider RBAC normalization', () => {
  beforeEach(() => {
    getResourceCounts.mockClear();
    onCallback.handler = undefined;
    (window as unknown).go = { main: { App: { GetResourceCounts: vi.fn() } } };
  });

  it('normalizes uppercase RBAC keys to camelCase and updates on events', async () => {
    const { result } = renderHook(() => useResourceCounts(), {
      wrapper: ({ children }) => <ResourceCountsProvider>{children}</ResourceCountsProvider>,
    });

    await waitFor(() => expect(result.current.counts).toBeTruthy());

    const counts = result.current.counts as unknown;
    expect(counts.roles).toBe(2);
    expect(counts.clusterroles).toBe(3);
    expect(counts.rolebindings).toBe(4);
    expect(counts.clusterrolebindings).toBe(5);

    expect(onCallback.handler).toBeDefined();
    if (onCallback.handler) {
      onCallback.handler({ Roles: 7, ClusterRoles: 0, RoleBindings: 1, ClusterRoleBindings: 2 });
    }

    await waitFor(() => {
      const updated = result.current.counts as unknown;
      expect(updated.roles).toBe(7);
      expect(updated.clusterroles).toBe(0);
      expect(updated.rolebindings).toBe(1);
      expect(updated.clusterrolebindings).toBe(2);
    });
  });
});
