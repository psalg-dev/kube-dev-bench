import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useResourceWatch } from '../hooks/useResourceWatch';

type TestItem = {
  metadata?: { uid?: string };
  name: string;
};

let eventHandler: ((payload: unknown) => void) | null = null;

vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn((_eventName: string, handler: (payload: unknown) => void) => {
    eventHandler = handler;
    return () => {
      eventHandler = null;
    };
  }),
}));

describe('useResourceWatch', () => {
  beforeEach(() => {
    eventHandler = null;
  });

  it('loads initial data and updates on array payloads', async () => {
    const initialFetch = vi.fn(async () => [{ metadata: { uid: '1' }, name: 'one' } as TestItem]);
    const { result } = renderHook(() => useResourceWatch<TestItem>('pods:update', initialFetch));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toHaveLength(1);
    });

    act(() => {
      eventHandler?.([
        { metadata: { uid: '2' }, name: 'two' },
      ]);
    });

    expect(result.current.data).toEqual([{ metadata: { uid: '2' }, name: 'two' }]);
  });

  it('handles incremental add/update/delete without duplicates', async () => {
    const initialFetch = vi.fn(async () => [{ metadata: { uid: '1' }, name: 'one' } as TestItem]);
    const { result } = renderHook(() =>
      useResourceWatch<TestItem>('pods:update', initialFetch, { mergeStrategy: 'incremental' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      eventHandler?.({ action: 'add', data: { metadata: { uid: '2' }, name: 'two' } });
      eventHandler?.({ action: 'add', data: { metadata: { uid: '2' }, name: 'two-duplicate' } });
      eventHandler?.({ action: 'update', data: { metadata: { uid: '1' }, name: 'one-updated' } });
      eventHandler?.({ action: 'delete', uid: '2' });
    });

    expect(result.current.data).toEqual([{ metadata: { uid: '1' }, name: 'one-updated' }]);
  });

  it('refetches on non-action signal when refetchOnSignal is enabled', async () => {
    const initialFetch = vi
      .fn<() => Promise<TestItem[]>>()
      .mockResolvedValueOnce([{ metadata: { uid: '1' }, name: 'one' }])
      .mockResolvedValueOnce([{ metadata: { uid: '2' }, name: 'two' }]);

    const { result } = renderHook(() =>
      useResourceWatch<TestItem>('resourceevents:update', initialFetch, {
        mergeStrategy: 'replace',
        refetchOnSignal: true,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual([{ metadata: { uid: '1' }, name: 'one' }]);
    });

    act(() => {
      eventHandler?.({ source: 'counts:refresh' });
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([{ metadata: { uid: '2' }, name: 'two' }]);
    });
  });
});
