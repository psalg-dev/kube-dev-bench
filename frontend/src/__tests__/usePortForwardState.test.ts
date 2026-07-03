import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePortForwardState } from '../hooks/usePortForwardState';

let eventHandler: ((payload: unknown) => void) | null = null;
const unsubscribe = vi.fn();

vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn((_eventName: string, handler: (payload: unknown) => void) => {
    eventHandler = handler;
    return unsubscribe; // per-listener unsubscribe
  }),
  EventsOff: vi.fn(),
}));

const listPortForwards = vi.fn(async () => [] as unknown[]);
vi.mock('../../wailsjs/go/main/App', () => ({
  ListPortForwards: (...args: unknown[]) => listPortForwards(...(args as [])),
}));

describe('usePortForwardState', () => {
  beforeEach(() => {
    eventHandler = null;
    unsubscribe.mockClear();
    listPortForwards.mockClear();
  });

  it('builds ns/pod -> remote -> [locals] map from a portforwards:update payload', async () => {
    const { result } = renderHook(() => usePortForwardState());

    await waitFor(() => expect(eventHandler).not.toBeNull());

    act(() => {
      eventHandler?.([
        { namespace: 'default', pod: 'web', remote: 8080, local: 20000 },
        { namespace: 'default', pod: 'web', remote: 8080, local: 20001 },
        { namespace: 'default', pod: 'db', remote: 5432, local: 25432 },
      ]);
    });

    expect(result.current).toEqual({
      'default/web': { 8080: [20000, 20001] },
      'default/db': { 5432: [25432] },
    });
  });

  it('tolerates capitalized field names', async () => {
    const { result } = renderHook(() => usePortForwardState());
    await waitFor(() => expect(eventHandler).not.toBeNull());

    act(() => {
      eventHandler?.([{ Namespace: 'ns1', Pod: 'p1', Remote: 80, Local: 8080 }]);
    });

    expect(result.current).toEqual({ 'ns1/p1': { 80: [8080] } });
  });

  it('cleanup calls the per-listener unsubscribe, not global EventsOff', async () => {
    const runtime = await import('../../wailsjs/runtime/runtime');
    const { unmount } = renderHook(() => usePortForwardState());
    await waitFor(() => expect(eventHandler).not.toBeNull());

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(runtime.EventsOff).not.toHaveBeenCalled();
  });
});
