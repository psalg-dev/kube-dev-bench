import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderPodOverviewTable } from '../k8s/resources/pods/PodOverviewEntry';

// Mock createRoot
const mockRender = vi.fn();
const mockRoot = { render: mockRender };

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => mockRoot),
}));

import { createRoot } from 'react-dom/client';

describe('PodOverviewEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renderPodOverviewTable', () => {
    it('returns null when container is null', () => {
      const result = renderPodOverviewTable({ container: null });
      
      expect(result).toBeNull();
      expect(createRoot).not.toHaveBeenCalled();
    });

    it('returns null when container is undefined', () => {
      const result = renderPodOverviewTable({ container: undefined });
      
      expect(result).toBeNull();
      expect(createRoot).not.toHaveBeenCalled();
    });

    it('creates root and renders when container is provided', () => {
      const container = document.createElement('div');
      
      const result = renderPodOverviewTable({
        container,
        namespace: 'default',
        namespaces: ['default', 'kube-system'],
        onCreateResource: vi.fn(),
      });
      
      expect(createRoot).toHaveBeenCalledWith(container);
      expect(mockRender).toHaveBeenCalled();
      expect(result).toBe(mockRoot);
    });

    it('reuses existing root for same container', () => {
      const container = document.createElement('div');
      
      renderPodOverviewTable({
        container,
        namespace: 'default',
        namespaces: [],
      });
      
      renderPodOverviewTable({
        container,
        namespace: 'kube-system',
        namespaces: [],
      });
      
      // createRoot should only be called once for the same container
      expect(createRoot).toHaveBeenCalledTimes(1);
      expect(mockRender).toHaveBeenCalledTimes(2);
    });

    it('creates new root for different containers', () => {
      const container1 = document.createElement('div');
      const container2 = document.createElement('div');
      
      renderPodOverviewTable({ container: container1, namespace: 'default', namespaces: [] });
      renderPodOverviewTable({ container: container2, namespace: 'default', namespaces: [] });
      
      expect(createRoot).toHaveBeenCalledTimes(2);
    });
  });
});
