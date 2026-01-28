import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as AppAPI from '../../wailsjs/go/main/App';
import {
  fetchAllTabCounts,
  fetchEventsCount,
  fetchPodsCount,
  fetchConsumersCount,
  fetchCronJobHistoryCount,
  fetchTabCounts,
} from '../api/tabCounts';

// Mock the Wails App API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetAllTabCounts: vi.fn(),
  GetResourceEventsCount: vi.fn(),
  GetPodsCountForResource: vi.fn(),
  GetConfigMapConsumersCount: vi.fn(),
  GetSecretConsumersCount: vi.fn(),
  GetPVCConsumersCount: vi.fn(),
  GetCronJobHistoryCount: vi.fn(),
}));

describe('tabCounts API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAllTabCounts', () => {
    it('returns counts from GetAllTabCounts', async () => {
      const mockCounts = { events: 5, pods: 3, consumers: 2 };
      AppAPI.GetAllTabCounts.mockResolvedValue(mockCounts);

      const result = await fetchAllTabCounts(
        'Deployment',
        'default',
        'my-deployment',
      );

      expect(AppAPI.GetAllTabCounts).toHaveBeenCalledWith(
        'default',
        'Deployment',
        'my-deployment',
      );
      expect(result).toEqual(mockCounts);
    });

    it('returns empty object on error', async () => {
      AppAPI.GetAllTabCounts.mockRejectedValue(new Error('API error'));

      const result = await fetchAllTabCounts(
        'Deployment',
        'default',
        'my-deployment',
      );

      expect(result).toEqual({});
    });

    it('returns empty object when API returns null', async () => {
      AppAPI.GetAllTabCounts.mockResolvedValue(null);

      const result = await fetchAllTabCounts(
        'Deployment',
        'default',
        'my-deployment',
      );

      expect(result).toEqual({});
    });
  });

  describe('fetchEventsCount', () => {
    it('returns events count for a resource', async () => {
      AppAPI.GetResourceEventsCount.mockResolvedValue(7);

      const result = await fetchEventsCount(
        'ConfigMap',
        'default',
        'my-config',
      );

      expect(AppAPI.GetResourceEventsCount).toHaveBeenCalledWith(
        'default',
        'ConfigMap',
        'my-config',
      );
      expect(result).toBe(7);
    });

    it('returns null on error', async () => {
      AppAPI.GetResourceEventsCount.mockRejectedValue(new Error('API error'));

      const result = await fetchEventsCount(
        'ConfigMap',
        'default',
        'my-config',
      );

      expect(result).toBeNull();
    });
  });

  describe('fetchPodsCount', () => {
    it('returns pods count for a workload', async () => {
      AppAPI.GetPodsCountForResource.mockResolvedValue(3);

      const result = await fetchPodsCount(
        'Deployment',
        'default',
        'my-deployment',
      );

      expect(AppAPI.GetPodsCountForResource).toHaveBeenCalledWith(
        'default',
        'Deployment',
        'my-deployment',
      );
      expect(result).toBe(3);
    });

    it('returns null on error', async () => {
      AppAPI.GetPodsCountForResource.mockRejectedValue(new Error('API error'));

      const result = await fetchPodsCount(
        'Deployment',
        'default',
        'my-deployment',
      );

      expect(result).toBeNull();
    });
  });

  describe('fetchConsumersCount', () => {
    it('returns consumers count for ConfigMap', async () => {
      AppAPI.GetConfigMapConsumersCount.mockResolvedValue(4);

      const result = await fetchConsumersCount(
        'ConfigMap',
        'default',
        'my-config',
      );

      expect(AppAPI.GetConfigMapConsumersCount).toHaveBeenCalledWith(
        'default',
        'my-config',
      );
      expect(result).toBe(4);
    });

    it('returns consumers count for Secret', async () => {
      AppAPI.GetSecretConsumersCount.mockResolvedValue(2);

      const result = await fetchConsumersCount(
        'Secret',
        'default',
        'my-secret',
      );

      expect(AppAPI.GetSecretConsumersCount).toHaveBeenCalledWith(
        'default',
        'my-secret',
      );
      expect(result).toBe(2);
    });

    it('returns consumers count for PersistentVolumeClaim', async () => {
      AppAPI.GetPVCConsumersCount.mockResolvedValue(1);

      const result = await fetchConsumersCount(
        'PersistentVolumeClaim',
        'default',
        'my-pvc',
      );

      expect(AppAPI.GetPVCConsumersCount).toHaveBeenCalledWith(
        'default',
        'my-pvc',
      );
      expect(result).toBe(1);
    });

    it('returns null for unsupported resource kind', async () => {
      const result = await fetchConsumersCount(
        'Deployment',
        'default',
        'my-deployment',
      );

      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      AppAPI.GetConfigMapConsumersCount.mockRejectedValue(
        new Error('API error'),
      );

      const result = await fetchConsumersCount(
        'ConfigMap',
        'default',
        'my-config',
      );

      expect(result).toBeNull();
    });
  });

  describe('fetchCronJobHistoryCount', () => {
    it('returns history count for CronJob', async () => {
      AppAPI.GetCronJobHistoryCount.mockResolvedValue(10);

      const result = await fetchCronJobHistoryCount('default', 'my-cronjob');

      expect(AppAPI.GetCronJobHistoryCount).toHaveBeenCalledWith(
        'default',
        'my-cronjob',
      );
      expect(result).toBe(10);
    });

    it('returns null on error', async () => {
      AppAPI.GetCronJobHistoryCount.mockRejectedValue(new Error('API error'));

      const result = await fetchCronJobHistoryCount('default', 'my-cronjob');

      expect(result).toBeNull();
    });
  });

  describe('fetchTabCounts', () => {
    it('delegates to fetchAllTabCounts', async () => {
      const mockCounts = { events: 5, pods: 3 };
      AppAPI.GetAllTabCounts.mockResolvedValue(mockCounts);

      const result = await fetchTabCounts(
        'Deployment',
        'default',
        'my-deployment',
      );

      expect(AppAPI.GetAllTabCounts).toHaveBeenCalled();
      expect(result).toEqual(mockCounts);
    });
  });
});
