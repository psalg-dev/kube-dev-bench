/**
 * Tests for useEventSubscription hook
 */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEventSubscription } from '../hooks/useEventSubscription';

describe('useEventSubscription', () => {
  type SubscribeFn<TArgs extends unknown[] = unknown[]> = (_handler: (..._args: TArgs) => void) => (() => void) | void;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;
  let mockSubscribeFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    mockSubscribeFn = vi.fn().mockReturnValue(mockUnsubscribe);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call subscribeFn with handler on mount', () => {
    const handler = vi.fn();

    renderHook(() => useEventSubscription(mockSubscribeFn as unknown as SubscribeFn, handler, []));

    expect(mockSubscribeFn).toHaveBeenCalledTimes(1);
    expect(mockSubscribeFn).toHaveBeenCalledWith(handler);
  });

  it('should call unsubscribe on unmount', () => {
    const handler = vi.fn();

    const { unmount } = renderHook(() => useEventSubscription(mockSubscribeFn as unknown as SubscribeFn, handler, []));

    expect(mockUnsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should handle unsubscribe errors gracefully', () => {
    const handler = vi.fn();
    mockUnsubscribe.mockImplementation(() => {
      throw new Error('Unsubscribe failed');
    });

    const { unmount } = renderHook(() => useEventSubscription(mockSubscribeFn as unknown as SubscribeFn, handler, []));

    // Should not throw
    expect(() => unmount()).not.toThrow();
  });

  it('should handle null unsubscribe function', () => {
    const handler = vi.fn();
    mockSubscribeFn.mockReturnValue(null);

    const { unmount } = renderHook(() => useEventSubscription(mockSubscribeFn as unknown as SubscribeFn, handler, []));

    // Should not throw
    expect(() => unmount()).not.toThrow();
  });

  it('should handle undefined unsubscribe function', () => {
    const handler = vi.fn();
    mockSubscribeFn.mockReturnValue(undefined);

    const { unmount } = renderHook(() => useEventSubscription(mockSubscribeFn as unknown as SubscribeFn, handler, []));

    // Should not throw
    expect(() => unmount()).not.toThrow();
  });

  it('should re-subscribe when dependencies change', () => {
    const handler = vi.fn();
    let dep = 'first';

    const { rerender } = renderHook(
      () => useEventSubscription(mockSubscribeFn as unknown as SubscribeFn, handler, [dep])
    );

    expect(mockSubscribeFn).toHaveBeenCalledTimes(1);

    // Change dependency
    dep = 'second';
    rerender();

    // Should unsubscribe from old and subscribe to new
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribeFn).toHaveBeenCalledTimes(2);
  });

  it('should not subscribe if subscribeFn is not a function', () => {
    const handler = vi.fn();

    // Pass null as subscribeFn
    const { unmount } = renderHook(() => useEventSubscription(null, handler, []));

    // Should not throw and should not try to unsubscribe
    expect(() => unmount()).not.toThrow();
  });

  it('should pass handler to subscribeFn correctly', () => {
    const handler = vi.fn((data: number) => data * 2);

    renderHook(() => useEventSubscription(mockSubscribeFn as unknown as SubscribeFn<[number]>, handler, []));

    // Get the handler that was passed to subscribeFn
    const passedHandler = mockSubscribeFn.mock.calls[0][0] as (_value: number) => number;

    // Verify it's the same handler
    expect(passedHandler(5)).toBe(10);
  });

  it('should work with empty dependency array', () => {
    const handler = vi.fn();

    const { rerender } = renderHook(() => useEventSubscription(mockSubscribeFn as unknown as SubscribeFn, handler, []));

    // Initial subscription
    expect(mockSubscribeFn).toHaveBeenCalledTimes(1);

    // Rerender without dependency change
    rerender();

    // Should not re-subscribe
    expect(mockSubscribeFn).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).not.toHaveBeenCalled();
  });

  it('should cleanup properly with multiple subscriptions', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const unsubscribe1 = vi.fn();
    const unsubscribe2 = vi.fn();
    const subscribe1 = vi.fn().mockReturnValue(unsubscribe1);
    const subscribe2 = vi.fn().mockReturnValue(unsubscribe2);

    const { unmount: unmount1 } = renderHook(() => useEventSubscription(subscribe1, handler1, []));
    const { unmount: unmount2 } = renderHook(() => useEventSubscription(subscribe2, handler2, []));

    expect(subscribe1).toHaveBeenCalledTimes(1);
    expect(subscribe2).toHaveBeenCalledTimes(1);

    unmount1();
    expect(unsubscribe1).toHaveBeenCalledTimes(1);
    expect(unsubscribe2).not.toHaveBeenCalled();

    unmount2();
    expect(unsubscribe2).toHaveBeenCalledTimes(1);
  });
});
