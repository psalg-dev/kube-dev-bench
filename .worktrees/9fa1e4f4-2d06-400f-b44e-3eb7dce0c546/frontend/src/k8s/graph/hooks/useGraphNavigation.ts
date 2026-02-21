import { useCallback } from 'react';

/**
 * Hook to handle graph node navigation
 * Dispatches navigate-to-resource CustomEvent to navigate to clicked resource
 * @returns Click handler function
 */
export function useGraphNavigation() {
  const handleNodeClick = useCallback((nodeData: unknown) => {
    // Dispatch navigate-to-resource event (existing pattern in AppContainer.tsx)
    const event = new CustomEvent('navigate-to-resource', {
      detail: {
        kind: nodeData.kind,
        namespace: nodeData.namespace,
        name: nodeData.name
      }
    });
    window.dispatchEvent(event);
  }, []);

  return { handleNodeClick };
}
