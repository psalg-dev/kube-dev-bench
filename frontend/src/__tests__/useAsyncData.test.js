/**
 * Tests for useAsyncData hook
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAsyncData } from '../hooks/useAsyncData';

describe('useAsyncData', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with loading state', async () => {
    const fetchFn = vi.fn().mockResolvedValue('data');
    
    const { result } = renderHook(() => useAsyncData(fetchFn, []));
    
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should fetch data successfully', async () => {
    const mockData = { name: 'test', value: 123 };
    const fetchFn = vi.fn().mockResolvedValue(mockData);
    
    const { result } = renderHook(() => useAsyncData(fetchFn, []));
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBe(null);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('should handle fetch errors', async () => {
    const errorMessage = 'Failed to fetch data';
    const fetchFn = vi.fn().mockRejectedValue(new Error(errorMessage));
    
    const { result } = renderHook(() => useAsyncData(fetchFn, []));
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(errorMessage);
  });

  it('should handle string errors', async () => {
    const errorMessage = 'String error message';
    const fetchFn = vi.fn().mockRejectedValue(errorMessage);
    
    const { result } = renderHook(() => useAsyncData(fetchFn, []));
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.error).toBe(errorMessage);
  });

  it('should refetch data when refetch is called', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(`data-${callCount}`);
    });
    
    const { result } = renderHook(() => useAsyncData(fetchFn, []));
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.data).toBe('data-1');
    
    act(() => {
      result.current.refetch();
    });
    
    await waitFor(() => {
      expect(result.current.data).toBe('data-2');
    });
    
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('should re-fetch when dependencies change', async () => {
    const fetchFn = vi.fn().mockImplementation((id) => Promise.resolve(`data-for-${id}`));
    
    let testId = 'first';
    const { result, rerender } = renderHook(
      () => useAsyncData(() => fetchFn(testId), [testId])
    );
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.data).toBe('data-for-first');
    
    // Change dependency
    testId = 'second';
    rerender();
    
    await waitFor(() => {
      expect(result.current.data).toBe('data-for-second');
    });
    
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('should not update state after unmount', async () => {
    let resolvePromise;
    const fetchFn = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolvePromise = resolve;
      });
    });
    
    const { result, unmount } = renderHook(() => useAsyncData(fetchFn, []));
    
    expect(result.current.loading).toBe(true);
    
    // Unmount before the promise resolves
    unmount();
    
    // Resolve the promise after unmount
    resolvePromise('data');
    
    // Wait a bit and verify no errors occur
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Component is unmounted, so we can't check state
    // The test passes if no error is thrown
  });

  it('should return a refetch function', async () => {
    const fetchFn = vi.fn().mockResolvedValue('data');
    
    const { result } = renderHook(() => useAsyncData(fetchFn, []));
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(typeof result.current.refetch).toBe('function');
  });

  it('should handle null/undefined data', async () => {
    const fetchFn = vi.fn().mockResolvedValue(null);
    
    const { result } = renderHook(() => useAsyncData(fetchFn, []));
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should handle empty array data', async () => {
    const fetchFn = vi.fn().mockResolvedValue([]);
    
    const { result } = renderHook(() => useAsyncData(fetchFn, []));
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe(null);
  });
});
