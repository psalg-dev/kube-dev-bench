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

  it('retries on initial fetch error with exponential backoff', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const initialFetch = vi
      .fn<() => Promise<TestItem[]>>()
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce([{ metadata: { uid: '1' }, name: 'one' }]);

    const { result } = renderHook(() =>
      useResourceWatch<TestItem>('pods:update', initialFetch)
    );

    // Wait for first failed attempt — shouldAdvanceTime lets waitFor's real timers work
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toEqual([]);
    });

    // Advance timer past the first retry delay (3000ms)
    await act(async () => {
      vi.advanceTimersByTime(3500);
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });

    vi.useRealTimers();
  });

  it('clears error state when event arrives after failed fetch', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const initialFetch = vi.fn<() => Promise<TestItem[]>>().mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() =>
      useResourceWatch<TestItem>('pods:update', initialFetch)
    );

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    act(() => {
      eventHandler?.([{ metadata: { uid: '1' }, name: 'recovered' }]);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual([{ metadata: { uid: '1' }, name: 'recovered' }]);
    vi.useRealTimers();
  });
});
