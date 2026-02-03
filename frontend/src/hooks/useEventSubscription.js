/**
 * Custom hook for safely subscribing to Wails events with automatic cleanup.
 * Consolidates duplicated event subscription cleanup pattern from 23+ components.
 * 
 * This hook handles:
 * - Event subscription setup
 * - Automatic cleanup on unmount
 * - Safe unsubscribe with error handling
 * 
 * @example
 * // Before (8 lines)
 * useEffect(() => {
 *   const unsubscribe = onHolmesChatStream((payload) => {
 *     handleStream(payload);
 *   });
 *   return () => {
 *     try { unsubscribe?.(); } catch (_) {}
 *   };
 * }, []);
 * 
 * // After (1 line)
 * useEventSubscription(onHolmesChatStream, handleStream, []);
 */

import { useEffect } from 'react';

/**
 * Hook for safely subscribing to events with automatic cleanup.
 * 
 * @param {Function} subscribeFn - Function that subscribes to an event (returns unsubscribe function)
 * @param {Function} handler - Event handler function
 * @param {Array} deps - Dependency array for re-subscribing
 */
export function useEventSubscription(subscribeFn, handler, deps = []) {
  useEffect(() => {
    if (typeof subscribeFn !== 'function') {
      return;
    }

    const unsubscribe = subscribeFn(handler);

    return () => {
      try {
        unsubscribe?.();
      } catch (_) {
        // Ignore cleanup errors
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default useEventSubscription;
