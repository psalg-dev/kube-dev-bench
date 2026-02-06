/**
 * Custom hook for safely subscribing to Wails events with automatic cleanup.
 * Consolidates duplicated event subscription cleanup pattern from 23+ components.
 */

import { useEffect } from 'react';
import type { DependencyList } from 'react';

type EventHandler<TArgs extends unknown[]> = (...args: TArgs) => void;
type SubscribeFn<TArgs extends unknown[]> = (handler: EventHandler<TArgs>) => (() => void) | void;

/**
 * Hook for safely subscribing to events with automatic cleanup.
 */
export function useEventSubscription<TArgs extends unknown[]>(
  subscribeFn: SubscribeFn<TArgs> | null | undefined,
  handler: EventHandler<TArgs>,
  deps: DependencyList = []
): void {
  useEffect(() => {
    if (typeof subscribeFn !== 'function') {
      return;
    }

    const unsubscribe = subscribeFn(handler);

    return () => {
      try {
        unsubscribe?.();
      } catch {
        // Ignore cleanup errors
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default useEventSubscription;
