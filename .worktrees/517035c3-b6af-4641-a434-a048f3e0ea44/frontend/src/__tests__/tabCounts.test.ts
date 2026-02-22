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

const getAllTabCountsMock = AppAPI.GetAllTabCounts as unknown as ReturnType<typeof vi.fn>;
const getResourceEventsCountMock = AppAPI.GetResourceEventsCount as unknown as ReturnType<typeof vi.fn>;
const getPodsCountForResourceMock = AppAPI.GetPodsCountForResource as unknown as ReturnType<typeof vi.fn>;
const getConfigMapConsumersCountMock = AppAPI.GetConfigMapConsumersCount as unknown as ReturnType<typeof vi.fn>;
const getSecretConsumersCountMock = AppAPI.GetSecretConsumersCount as unknown as ReturnType<typeof vi.fn>;
const getPVCConsumersCountMock = AppAPI.GetPVCConsumersCount as unknown as ReturnType<typeof vi.fn>;
const getCronJobHistoryCountMock = AppAPI.GetCronJobHistoryCount as unknown as ReturnType<typeof vi.fn>;

describe('tabCounts API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAllTabCounts', () => {
    it('returns counts from GetAllTabCounts', async () => {
      const mockCounts = { events: 5, pods: 3, consumers: 2 };
      getAllTabCountsMock.mockResolvedValue(mockCounts);

      const result = await fetchAllTabCounts('Deployment', 'default', 'my-deployment');

      expect(getAllTabCountsMock).toHaveBeenCalledWith('default', 'Deployment', 'my-deployment');
      expect(result).toEqual(mockCounts);
    });

    it('returns empty object on error', async () => {
      getAllTabCountsMock.mockRejectedValue(new Error('API error'));

      const result = await fetchAllTabCounts('Deployment', 'default', 'my-deployment');

      expect(result).toEqual({});
    });

    it('returns empty object when API returns null', async () => {
      getAllTabCountsMock.mockResolvedValue(null);

      const result = await fetchAllTabCounts('Deployment', 'default', 'my-deployment');

      expect(result).toEqual({});
    });
  });

  describe('fetchEventsCount', () => {
    it('returns events count for a resource', async () => {
      getResourceEventsCountMock.mockResolvedValue(7);

      const result = await fetchEventsCount('ConfigMap', 'default', 'my-config');

      expect(getResourceEventsCountMock).toHaveBeenCalledWith('default', 'ConfigMap', 'my-config');
      expect(result).toBe(7);
    });

    it('returns null on error', async () => {
      getResourceEventsCountMock.mockRejectedValue(new Error('API error'));

      const result = await fetchEventsCount('ConfigMap', 'default', 'my-config');

      expect(result).toBeNull();
    });
  });

  describe('fetchPodsCount', () => {
    it('returns pods count for a workload', async () => {
      getPodsCountForResourceMock.mockResolvedValue(3);

      const result = await fetchPodsCount('Deployment', 'default', 'my-deployment');

      expect(getPodsCountForResourceMock).toHaveBeenCalledWith('default', 'Deployment', 'my-deployment');
      expect(result).toBe(3);
    });

    it('returns null on error', async () => {
      getPodsCountForResourceMock.mockRejectedValue(new Error('API error'));

      const result = await fetchPodsCount('Deployment', 'default', 'my-deployment');

      expect(result).toBeNull();
    });
  });

  describe('fetchConsumersCount', () => {
    it('returns consumers count for ConfigMap', async () => {
      getConfigMapConsumersCountMock.mockResolvedValue(4);

      const result = await fetchConsumersCount('ConfigMap', 'default', 'my-config');

      expect(getConfigMapConsumersCountMock).toHaveBeenCalledWith('default', 'my-config');
      expect(result).toBe(4);
    });

    it('returns consumers count for Secret', async () => {
      getSecretConsumersCountMock.mockResolvedValue(2);

      const result = await fetchConsumersCount('Secret', 'default', 'my-secret');

      expect(getSecretConsumersCountMock).toHaveBeenCalledWith('default', 'my-secret');
      expect(result).toBe(2);
    });

    it('returns consumers count for PersistentVolumeClaim', async () => {
      getPVCConsumersCountMock.mockResolvedValue(1);

      const result = await fetchConsumersCount('PersistentVolumeClaim', 'default', 'my-pvc');

      expect(getPVCConsumersCountMock).toHaveBeenCalledWith('default', 'my-pvc');
      expect(result).toBe(1);
    });

    it('returns null for unsupported resource kind', async () => {
      const result = await fetchConsumersCount('Deployment', 'default', 'my-deployment');

      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      getConfigMapConsumersCountMock.mockRejectedValue(new Error('API error'));

      const result = await fetchConsumersCount('ConfigMap', 'default', 'my-config');

      expect(result).toBeNull();
    });
  });

  describe('fetchCronJobHistoryCount', () => {
    it('returns history count for CronJob', async () => {
      getCronJobHistoryCountMock.mockResolvedValue(10);

      const result = await fetchCronJobHistoryCount('default', 'my-cronjob');

      expect(getCronJobHistoryCountMock).toHaveBeenCalledWith('default', 'my-cronjob');
      expect(result).toBe(10);
    });

    it('returns null on error', async () => {
      getCronJobHistoryCountMock.mockRejectedValue(new Error('API error'));

      const result = await fetchCronJobHistoryCount('default', 'my-cronjob');

      expect(result).toBeNull();
    });
  });

  describe('fetchTabCounts', () => {
    it('delegates to fetchAllTabCounts', async () => {
      const mockCounts = { events: 5, pods: 3 };
      getAllTabCountsMock.mockResolvedValue(mockCounts);

      const result = await fetchTabCounts('Deployment', 'default', 'my-deployment');

      expect(getAllTabCountsMock).toHaveBeenCalled();
      expect(result).toEqual(mockCounts);
    });
  });
});
