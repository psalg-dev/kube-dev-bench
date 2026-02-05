import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import './wailsMocks';
import { eventsOnMock, resetAllMocks } from './wailsMocks';
import { useResourceData, createNormalizer } from '../hooks/useResourceData';

describe('useResourceData', () => {
  let mockFetchFn;
  let eventCallback;

  beforeEach(() => {
    resetAllMocks();
    mockFetchFn = vi.fn();
    eventCallback = null;

    // Mock EventsOn to capture callback
    eventsOnMock.mockImplementation((eventName, callback) => {
      eventCallback = callback;
      return () => {}; // Return unsubscribe function
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should provide initial loading state', async () => {
    mockFetchFn.mockResolvedValue([]);
    
    const { result } = renderHook(() =>
      useResourceData({
        fetchFn: mockFetchFn,
        eventName: 'test:update',
        namespace: 'default',
      })
    );

    // Initially loading should be true, then becomes false after fetch
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data).toEqual([]);
  });

  it('should fetch data with single namespace', async () => {
    const mockData = [
      { name: 'item1', namespace: 'default' },
      { name: 'item2', namespace: 'default' },
    ];
    mockFetchFn.mockResolvedValue(mockData);

    const { result } = renderHook(() =>
      useResourceData({
        fetchFn: mockFetchFn,
        eventName: 'test:update',
        namespace: 'default',
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchFn).toHaveBeenCalledWith('default');
    expect(result.current.data).toEqual(mockData);
  });

  it('should fetch data from multiple namespaces', async () => {
    mockFetchFn.mockImplementation((ns) => {
      if (ns === 'ns1') return Promise.resolve([{ name: 'item1', namespace: 'ns1' }]);
      if (ns === 'ns2') return Promise.resolve([{ name: 'item2', namespace: 'ns2' }]);
      return Promise.resolve([]);
    });

    const { result } = renderHook(() =>
      useResourceData({
        fetchFn: mockFetchFn,
        eventName: 'test:update',
        namespaces: ['ns1', 'ns2'],
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });
    
    expect(mockFetchFn).toHaveBeenCalledWith('ns1');
    expect(mockFetchFn).toHaveBeenCalledWith('ns2');
  });

  it('should handle cluster-scoped resources', async () => {
    const mockData = [{ name: 'pv1' }, { name: 'pv2' }];
    mockFetchFn.mockResolvedValue(mockData);

    const { result } = renderHook(() =>
      useResourceData({
        fetchFn: mockFetchFn,
        eventName: 'pv:update',
        clusterScoped: true,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchFn).toHaveBeenCalledWith();
    expect(result.current.data).toEqual(mockData);
  });

  it('should apply normalize function to fetched data', async () => {
    const mockData = [
      { Name: 'ITEM1', Namespace: 'DEFAULT' },
      { Name: 'ITEM2', Namespace: 'DEFAULT' },
    ];
    mockFetchFn.mockResolvedValue(mockData);

    const normalize = (d) => ({
      name: (d.name ?? d.Name ?? '').toLowerCase(),
      namespace: (d.namespace ?? d.Namespace ?? '').toLowerCase(),
    });

    const { result } = renderHook(() =>
      useResourceData({
        fetchFn: mockFetchFn,
        eventName: 'test:update',
        namespace: 'DEFAULT',
        normalize,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([
      { name: 'item1', namespace: 'default' },
      { name: 'item2', namespace: 'default' },
    ]);
  });

  it('should handle event updates', async () => {
    mockFetchFn.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useResourceData({
        fetchFn: mockFetchFn,
        eventName: 'test:update',
        namespace: 'default',
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Simulate event update
    const newData = [{ name: 'new-item', namespace: 'default' }];
    act(() => {
      eventCallback(newData);
    });

    expect(result.current.data).toEqual(newData);
  });

  it('should apply normalize to event updates', async () => {
    mockFetchFn.mockResolvedValue([]);

    const normalize = (d) => ({
      name: d.name ?? d.Name,
      namespace: d.namespace ?? d.Namespace,
    });

    const { result } = renderHook(() =>
      useResourceData({
        fetchFn: mockFetchFn,
        eventName: 'test:update',
        namespace: 'default',
        normalize,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Simulate event update with PascalCase data
    act(() => {
      eventCallback([{ Name: 'EventItem', Namespace: 'prod' }]);
    });

    expect(result.current.data).toEqual([{ name: 'EventItem', namespace: 'prod' }]);
  });

  it('should handle fetch errors gracefully', async () => {
    mockFetchFn.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useResourceData({
        fetchFn: mockFetchFn,
        eventName: 'test:update',
        namespace: 'default',
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
  });

  it('should provide refresh function', async () => {
    mockFetchFn
      .mockResolvedValueOnce([{ name: 'initial' }])
      .mockResolvedValueOnce([{ name: 'refreshed' }]);

    const { result } = renderHook(() =>
      useResourceData({
        fetchFn: mockFetchFn,
        eventName: 'test:update',
        namespace: 'default',
      })
    );

    await waitFor(() => {
      expect(result.current.data).toEqual([{ name: 'initial' }]);
    });

    // Call refresh
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.data).toEqual([{ name: 'refreshed' }]);
    expect(mockFetchFn).toHaveBeenCalledTimes(2);
  });

  it('should not fetch when no namespace provided for namespace-scoped resources', async () => {
    const { result } = renderHook(() =>
      useResourceData({
        fetchFn: mockFetchFn,
        eventName: 'test:update',
        // No namespace or namespaces provided
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchFn).not.toHaveBeenCalled();
  });
});

describe('createNormalizer', () => {
  it('should create normalizer that handles camelCase fields', () => {
    const normalize = createNormalizer({
      name: '',
      namespace: '',
      replicas: 0,
    });

    const item = { name: 'test', namespace: 'default', replicas: 3 };
    expect(normalize(item)).toEqual({ name: 'test', namespace: 'default', replicas: 3 });
  });

  it('should create normalizer that handles PascalCase fields', () => {
    const normalize = createNormalizer({
      name: '',
      namespace: '',
      replicas: 0,
    });

    const item = { Name: 'test', Namespace: 'default', Replicas: 3 };
    expect(normalize(item)).toEqual({ name: 'test', namespace: 'default', replicas: 3 });
  });

  it('should use default values when field is missing', () => {
    const normalize = createNormalizer({
      name: 'unknown',
      namespace: '',
      replicas: 0,
      age: '-',
    });

    const item = { name: 'test' };
    expect(normalize(item)).toEqual({
      name: 'test',
      namespace: '',
      replicas: 0,
      age: '-',
    });
  });

  it('should prefer camelCase over PascalCase when both exist', () => {
    const normalize = createNormalizer({
      name: '',
    });

    const item = { name: 'camel', Name: 'pascal' };
    expect(normalize(item)).toEqual({ name: 'camel' });
  });

  it('should return null for null input', () => {
    const normalize = createNormalizer({ name: '' });
    expect(normalize(null)).toBeNull();
  });
});
