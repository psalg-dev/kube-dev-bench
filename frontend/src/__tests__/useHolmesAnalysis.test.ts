import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import './wailsMocks';
import { eventsOnMock, resetAllMocks } from './wailsMocks';
import { useHolmesAnalysis } from '../hooks/useHolmesAnalysis';

describe('useHolmesAnalysis', () => {
  type AnalyzeFn = (...args: string[]) => Promise<void>;
  let mockAnalyzeFn: ReturnType<typeof vi.fn<AnalyzeFn>>;
  let chatStreamCallback: ((event: unknown) => void) | null;
  let contextProgressCallback: ((event: unknown) => void) | null;

  beforeEach(() => {
    resetAllMocks();
    mockAnalyzeFn = vi.fn<AnalyzeFn>().mockResolvedValue(undefined);
    chatStreamCallback = null;
    contextProgressCallback = null;

    // Mock EventsOn to capture callbacks
    eventsOnMock.mockImplementation((eventName: string, callback: (event: unknown) => void) => {
      if (eventName === 'holmes:chat:stream') {
        chatStreamCallback = callback;
      } else if (eventName === 'holmes:context:progress') {
        contextProgressCallback = callback;
      }
      return () => {}; // Return unsubscribe function
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should provide initial state', () => {
    const { result } = renderHook(() =>
      useHolmesAnalysis({ kind: 'Deployment', analyzeFn: mockAnalyzeFn })
    );

    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.response).toBeNull();
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.key).toBeNull();
    expect(result.current.state.streamId).toBeNull();
    expect(result.current.state.streamingText).toBe('');
    expect(result.current.state.reasoningText).toBe('');
    expect(result.current.state.queryTimestamp).toBeNull();
    expect(result.current.state.contextSteps).toEqual([]);
    expect(result.current.state.toolEvents).toEqual([]);
  });

  it('should call analyze function with namespace and name', async () => {
    const { result } = renderHook(() =>
      useHolmesAnalysis({ kind: 'Deployment', analyzeFn: mockAnalyzeFn })
    );

    await act(async () => {
      await result.current.analyze('test-namespace', 'test-name');
    });

    expect(mockAnalyzeFn).toHaveBeenCalledWith(
      'test-namespace',
      'test-name',
      expect.stringMatching(/^deployment-\d+$/)
    );
    expect(result.current.state.loading).toBe(true);
    expect(result.current.state.key).toBe('test-namespace/test-name');
    expect(result.current.state.streamId).toMatch(/^deployment-\d+$/);
  });

  it('should call analyze function with row object for K8s resource', async () => {
    const { result } = renderHook(() =>
      useHolmesAnalysis({ kind: 'Pod', analyzeFn: mockAnalyzeFn })
    );

    await act(async () => {
      await result.current.analyze({ namespace: 'my-ns', name: 'my-pod' });
    });

    expect(mockAnalyzeFn).toHaveBeenCalledWith(
      'my-ns',
      'my-pod',
      expect.stringMatching(/^pod-\d+$/)
    );
    expect(result.current.state.key).toBe('my-ns/my-pod');
  });

  it('should call analyze function with row object for Swarm resource', async () => {
    const { result } = renderHook(() =>
      useHolmesAnalysis({ kind: 'SwarmService', analyzeFn: mockAnalyzeFn })
    );

    await act(async () => {
      await result.current.analyze({ id: 'service-abc123' });
    });

    expect(mockAnalyzeFn).toHaveBeenCalledWith(
      'service-abc123',
      expect.stringMatching(/^swarmservice-\d+$/)
    );
    expect(result.current.state.key).toBe('service-abc123');
  });

  it('should handle analyze function error', async () => {
    const errorFn = vi.fn().mockRejectedValue(new Error('Analysis failed'));
    const { result } = renderHook(() =>
      useHolmesAnalysis({ kind: 'Deployment', analyzeFn: errorFn })
    );

    await act(async () => {
      await result.current.analyze('test-ns', 'test-name');
    });

    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.error).toBe('Analysis failed');
  });

  it('should handle streaming text from chat stream', async () => {
    const { result } = renderHook(() =>
      useHolmesAnalysis({ kind: 'Deployment', analyzeFn: mockAnalyzeFn })
    );

    await act(async () => {
      await result.current.analyze('test-ns', 'test-name');
    });

    const streamId = result.current.state.streamId;

    // Simulate streaming text event
    act(() => {
      chatStreamCallback?.({
        stream_id: streamId,
        event: 'ai_message',
        data: JSON.stringify({ content: 'Hello, this is analysis' }),
      });
    });

    expect(result.current.state.streamingText).toBe('Hello, this is analysis');
    expect(result.current.state.response).toEqual({ response: 'Hello, this is analysis' });
  });

  it('should handle stream end event', async () => {
    const { result } = renderHook(() =>
      useHolmesAnalysis({ kind: 'Deployment', analyzeFn: mockAnalyzeFn })
    );

    await act(async () => {
      await result.current.analyze('test-ns', 'test-name');
    });

    const streamId = result.current.state.streamId;

    // Simulate streaming text and stream end in same act block to ensure proper state updates
    await act(async () => {
      chatStreamCallback?.({
        stream_id: streamId,
        event: 'ai_message',
        data: JSON.stringify({ content: 'Final analysis result' }),
      });

      chatStreamCallback?.({
        stream_id: streamId,
        event: 'stream_end',
        data: null,
      });
    });

    await waitFor(() => {
      expect(result.current.state.loading).toBe(false);
    });
    expect(result.current.state.response).toEqual({ response: 'Final analysis result' });
  });

  it('should handle context progress events', async () => {
    const { result } = renderHook(() =>
      useHolmesAnalysis({ kind: 'Pod', analyzeFn: mockAnalyzeFn })
    );

    await act(async () => {
      await result.current.analyze('test-ns', 'test-pod');
    });

    const key = result.current.state.key;

    // Simulate context progress event
    act(() => {
      contextProgressCallback?.({
        key,
        step: 'Fetching pod status',
        status: 'running',
        detail: 'Getting pod metrics',
      });
    });

    expect(result.current.state.contextSteps).toHaveLength(1);
    expect(result.current.state.contextSteps[0]).toMatchObject({
      id: 'Fetching pod status',
      step: 'Fetching pod status',
      status: 'running',
      detail: 'Getting pod metrics',
    });
  });

  it('should handle tool events', async () => {
    const { result } = renderHook(() =>
      useHolmesAnalysis({ kind: 'Deployment', analyzeFn: mockAnalyzeFn })
    );

    await act(async () => {
      await result.current.analyze('test-ns', 'test-name');
    });

    const streamId = result.current.state.streamId;

    // Simulate tool start event
    act(() => {
      chatStreamCallback?.({
        stream_id: streamId,
        event: 'start_tool_calling',
        data: JSON.stringify({
          id: 'tool-1',
          tool_name: 'get_pod_logs',
          description: 'Fetching pod logs',
        }),
      });
    });

    expect(result.current.state.toolEvents).toHaveLength(1);
    expect(result.current.state.toolEvents[0]).toMatchObject({
      id: 'tool-1',
      name: 'get_pod_logs',
      status: 'running',
      description: 'Fetching pod logs',
    });

    // Simulate tool result event
    act(() => {
      chatStreamCallback?.({
        stream_id: streamId,
        event: 'tool_calling_result',
        data: JSON.stringify({
          tool_call_id: 'tool-1',
          status: 'done',
        }),
      });
    });

    expect(result.current.state.toolEvents[0].status).toBe('done');
  });

  it('should reset state when reset is called', async () => {
    const { result } = renderHook(() =>
      useHolmesAnalysis({ kind: 'Deployment', analyzeFn: mockAnalyzeFn })
    );

    await act(async () => {
      await result.current.analyze('test-ns', 'test-name');
    });

    expect(result.current.state.key).toBe('test-ns/test-name');

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.key).toBeNull();
    expect(result.current.state.streamId).toBeNull();
  });

  it('should ignore events from different stream IDs', async () => {
    const { result } = renderHook(() =>
      useHolmesAnalysis({ kind: 'Deployment', analyzeFn: mockAnalyzeFn })
    );

    await act(async () => {
      await result.current.analyze('test-ns', 'test-name');
    });

    // Simulate event with different stream ID
    act(() => {
      chatStreamCallback?.({
        stream_id: 'different-stream-id',
        event: 'ai_message',
        data: JSON.stringify({ content: 'Should be ignored' }),
      });
    });

    expect(result.current.state.streamingText).toBe('');
  });

  it('should handle cluster-scoped resources (no namespace)', async () => {
    const { result } = renderHook(() =>
      useHolmesAnalysis({ kind: 'PersistentVolume', analyzeFn: mockAnalyzeFn })
    );

    await act(async () => {
      await result.current.analyze({ name: 'my-pv' });
    });

    expect(mockAnalyzeFn).toHaveBeenCalledWith(
      'my-pv',
      expect.stringMatching(/^persistentvolume-\d+$/)
    );
    expect(result.current.state.key).toBe('my-pv');
  });
});
