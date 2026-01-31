import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeBulkAction, hasProductionNamespace, prepareConfirmItems } from '../api/bulkOperations.js';
import './wailsMocks.js';

// Get the mocks
const mockBulkDeleteResources = vi.fn();
const mockBulkRestartResources = vi.fn();
const mockBulkScaleResources = vi.fn();
const mockBulkSuspendCronJobs = vi.fn();
const mockBulkResumeCronJobs = vi.fn();
const mockBulkRemoveSwarmResources = vi.fn();
const mockBulkScaleSwarmServices = vi.fn();
const mockBulkRestartSwarmServices = vi.fn();
const mockBulkSetNodeAvailability = vi.fn();

// Mock the App API
vi.mock('../../wailsjs/go/main/App', () => ({
  BulkDeleteResources: (...args) => mockBulkDeleteResources(...args),
  BulkRestartResources: (...args) => mockBulkRestartResources(...args),
  BulkScaleResources: (...args) => mockBulkScaleResources(...args),
  BulkSuspendCronJobs: (...args) => mockBulkSuspendCronJobs(...args),
  BulkResumeCronJobs: (...args) => mockBulkResumeCronJobs(...args),
  BulkRemoveSwarmResources: (...args) => mockBulkRemoveSwarmResources(...args),
  BulkScaleSwarmServices: (...args) => mockBulkScaleSwarmServices(...args),
  BulkRestartSwarmServices: (...args) => mockBulkRestartSwarmServices(...args),
  BulkSetNodeAvailability: (...args) => mockBulkSetNodeAvailability(...args),
}));

describe('bulkOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeBulkAction', () => {
    describe('empty input', () => {
      it('returns empty response for empty selectedRows', async () => {
        const result = await executeBulkAction('k8s', 'delete', []);
        expect(result).toEqual({ results: [], successCount: 0, errorCount: 0 });
      });

      it('returns empty response for null selectedRows', async () => {
        const result = await executeBulkAction('k8s', 'delete', null);
        expect(result).toEqual({ results: [], successCount: 0, errorCount: 0 });
      });
    });

    describe('Kubernetes actions', () => {
      const sampleRows = [
        { name: 'pod-1', namespace: 'default' },
        { name: 'pod-2', namespace: 'test' },
      ];

      it('calls BulkDeleteResources for delete action', async () => {
        mockBulkDeleteResources.mockResolvedValue({ results: [], successCount: 2, errorCount: 0 });
        
        await executeBulkAction('k8s', 'delete', sampleRows, { resourceKind: 'pod' });
        
        expect(mockBulkDeleteResources).toHaveBeenCalledWith([
          { kind: 'pod', name: 'pod-1', namespace: 'default' },
          { kind: 'pod', name: 'pod-2', namespace: 'test' },
        ]);
      });

      it('calls BulkRestartResources for restart action', async () => {
        mockBulkRestartResources.mockResolvedValue({ results: [], successCount: 2, errorCount: 0 });
        
        await executeBulkAction('k8s', 'restart', sampleRows, { resourceKind: 'deployment' });
        
        expect(mockBulkRestartResources).toHaveBeenCalled();
      });

      it('calls BulkScaleResources for scale action with replicas', async () => {
        mockBulkScaleResources.mockResolvedValue({ results: [], successCount: 2, errorCount: 0 });
        
        await executeBulkAction('k8s', 'scale', sampleRows, { resourceKind: 'deployment', replicas: 5 });
        
        expect(mockBulkScaleResources).toHaveBeenCalledWith(
          expect.any(Array),
          5
        );
      });

      it('throws error for scale without replicas', async () => {
        await expect(executeBulkAction('k8s', 'scale', sampleRows, { resourceKind: 'deployment' }))
          .rejects.toThrow('Replicas count is required');
      });

      it('calls BulkSuspendCronJobs for suspend action', async () => {
        mockBulkSuspendCronJobs.mockResolvedValue({ results: [], successCount: 1, errorCount: 0 });
        
        await executeBulkAction('k8s', 'suspend', sampleRows, { resourceKind: 'cronjob' });
        
        expect(mockBulkSuspendCronJobs).toHaveBeenCalled();
      });

      it('calls BulkResumeCronJobs for resume action', async () => {
        mockBulkResumeCronJobs.mockResolvedValue({ results: [], successCount: 1, errorCount: 0 });
        
        await executeBulkAction('k8s', 'resume', sampleRows, { resourceKind: 'cronjob' });
        
        expect(mockBulkResumeCronJobs).toHaveBeenCalled();
      });

      it('throws for unknown action', async () => {
        await expect(executeBulkAction('k8s', 'unknown', sampleRows))
          .rejects.toThrow('Unknown action: unknown');
      });
    });

    describe('Swarm actions', () => {
      const sampleRows = [
        { id: 'svc-1', name: 'service-1' },
        { id: 'svc-2', name: 'service-2' },
      ];

      it('calls BulkRemoveSwarmResources for delete action', async () => {
        mockBulkRemoveSwarmResources.mockResolvedValue({ results: [], successCount: 2, errorCount: 0 });
        
        await executeBulkAction('swarm', 'delete', sampleRows, { resourceKind: 'service' });
        
        expect(mockBulkRemoveSwarmResources).toHaveBeenCalled();
      });

      it('calls BulkRestartSwarmServices for restart action', async () => {
        mockBulkRestartSwarmServices.mockResolvedValue({ results: [], successCount: 2, errorCount: 0 });
        
        await executeBulkAction('swarm', 'restart', sampleRows, { resourceKind: 'service' });
        
        expect(mockBulkRestartSwarmServices).toHaveBeenCalled();
      });

      it('calls BulkScaleSwarmServices for scale action', async () => {
        mockBulkScaleSwarmServices.mockResolvedValue({ results: [], successCount: 2, errorCount: 0 });
        
        await executeBulkAction('swarm', 'scale', sampleRows, { resourceKind: 'service', replicas: 3 });
        
        expect(mockBulkScaleSwarmServices).toHaveBeenCalledWith(expect.any(Array), 3);
      });

      it('calls BulkSetNodeAvailability for drain action', async () => {
        mockBulkSetNodeAvailability.mockResolvedValue({ results: [], successCount: 1, errorCount: 0 });
        
        const nodeRows = [{ id: 'node-1', name: 'node-1' }];
        await executeBulkAction('swarm', 'drain', nodeRows, { resourceKind: 'node' });
        
        expect(mockBulkSetNodeAvailability).toHaveBeenCalledWith(expect.any(Array), 'drain');
      });

      it('calls BulkSetNodeAvailability for pause action', async () => {
        mockBulkSetNodeAvailability.mockResolvedValue({ results: [], successCount: 1, errorCount: 0 });
        
        const nodeRows = [{ id: 'node-1', name: 'node-1' }];
        await executeBulkAction('swarm', 'pause', nodeRows, { resourceKind: 'node' });
        
        expect(mockBulkSetNodeAvailability).toHaveBeenCalledWith(expect.any(Array), 'pause');
      });

      it('calls BulkSetNodeAvailability for activate action', async () => {
        mockBulkSetNodeAvailability.mockResolvedValue({ results: [], successCount: 1, errorCount: 0 });
        
        const nodeRows = [{ id: 'node-1', name: 'node-1' }];
        await executeBulkAction('swarm', 'activate', nodeRows, { resourceKind: 'node' });
        
        expect(mockBulkSetNodeAvailability).toHaveBeenCalledWith(expect.any(Array), 'active');
      });
    });
  });

  describe('hasProductionNamespace', () => {
    it('returns true for production namespace', () => {
      const rows = [{ name: 'test', namespace: 'production' }];
      expect(hasProductionNamespace(rows)).toBe(true);
    });

    it('returns true for kube-system namespace', () => {
      const rows = [{ name: 'test', namespace: 'kube-system' }];
      expect(hasProductionNamespace(rows)).toBe(true);
    });

    it('returns true for default namespace', () => {
      const rows = [{ name: 'test', namespace: 'default' }];
      expect(hasProductionNamespace(rows)).toBe(true);
    });

    it('returns false for development namespace', () => {
      const rows = [{ name: 'test', namespace: 'development' }];
      expect(hasProductionNamespace(rows)).toBe(false);
    });

    it('returns true if any row is in production namespace', () => {
      const rows = [
        { name: 'test-1', namespace: 'development' },
        { name: 'test-2', namespace: 'production' },
      ];
      expect(hasProductionNamespace(rows)).toBe(true);
    });
  });

  describe('prepareConfirmItems', () => {
    it('returns formatted items', () => {
      const rows = [
        { name: 'item-1', namespace: 'default' },
        { name: 'item-2', namespace: 'test' },
      ];
      
      const items = prepareConfirmItems(rows);
      
      expect(items).toEqual([
        { key: 'default/item-1', name: 'item-1', namespace: 'default' },
        { key: 'test/item-2', name: 'item-2', namespace: 'test' },
      ]);
    });

    it('handles items without namespace', () => {
      const rows = [{ name: 'volume-1' }];
      
      const items = prepareConfirmItems(rows);
      
      expect(items).toEqual([
        { key: 'volume-1', name: 'volume-1', namespace: '' },
      ]);
    });

    it('handles capitalized property names', () => {
      const rows = [{ Name: 'item-1', Namespace: 'default' }];
      
      const items = prepareConfirmItems(rows);
      
      expect(items[0].name).toBe('item-1');
      expect(items[0].namespace).toBe('default');
    });
  });
});
