import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Create a global mocks store before mocking
const globalMocks = {
  chatStreamCallback: null as any,
  contextProgressCallback: null as any,
};

vi.mock('../holmes/holmesApi', () => ({
  onHolmesChatStream: (cb: any) => {
    globalMocks.chatStreamCallback = cb;
    return () => { globalMocks.chatStreamCallback = null; };
  },
  onHolmesContextProgress: (cb: any) => {
    globalMocks.contextProgressCallback = cb;
    return () => { globalMocks.contextProgressCallback = null; };
  },
  CancelHolmesStream: vi.fn().mockResolvedValue(undefined),
}));

// Import after mock is set up
import { useHolmesStream } from '../hooks/useHolmesStream';
import * as holmesApi from '../holmes/holmesApi';
import type { HolmesStreamEvent, HolmesContextProgressEvent } from '../holmes/holmesApi';

// Access the mocked module to get the cancel function
const mockedHolmesApi = vi.mocked(holmesApi, { partial: true });

describe('useHolmesStream', () => {
  let mockCancelFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get the cancel mock from the module
    mockCancelFn = mockedHolmesApi.CancelHolmesStream as ReturnType<typeof vi.fn>;
  });

  const emitChatEvent = (event: HolmesStreamEvent) => {
    globalMocks.chatStreamCallback?.(event);
  };

  const emitContextEvent = (event: HolmesContextProgressEvent) => {
    globalMocks.contextProgressCallback?.(event);
  };

  it('initializes with default state', () => {
    const { result } = renderHook(() => useHolmesStream());
    expect(result.current.state).toEqual({
      loading: false,
      response: null,
      error: null,
      key: null,
      streamId: null,
      streamingText: '',
      reasoningText: '',
      queryTimestamp: null,
      contextSteps: [],
      toolEvents: [],
    });
  });

  it('analyze sets loading state and generates streamId', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    expect(result.current.state.loading).toBe(true);
    expect(result.current.state.key).toBe('test-key');
    expect(result.current.state.streamId).toBeTruthy();
    expect(result.current.state.streamingText).toBe('');
    expect(result.current.state.reasoningText).toBe('');
    expect(result.current.state.response).toBeNull();
    expect(result.current.state.error).toBeNull();
  });

  it('analyze calls run function with generated streamId', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    expect(runFn).toHaveBeenCalledWith(result.current.state.streamId);
  });

  it('ai_message content chunk appends to streamingText', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'ai_message',
        data: JSON.stringify({ content: 'Hello' }),
      });
    });

    expect(result.current.state.streamingText).toBe('Hello');
    expect(result.current.state.response?.response).toBe('Hello');
  });

  it('multiple ai_message content chunks accumulate with newline', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'ai_message',
        data: JSON.stringify({ content: 'Hello' }),
      });
    });

    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'ai_message',
        data: JSON.stringify({ content: 'World' }),
      });
    });

    expect(result.current.state.streamingText).toBe('Hello\nWorld');
  });

  it('ai_message reasoning accumulates into reasoningText', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'ai_message',
        data: JSON.stringify({ reasoning: 'Step 1' }),
      });
    });

    expect(result.current.state.reasoningText).toBe('Step 1');

    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'ai_message',
        data: JSON.stringify({ reasoning: 'Step 2' }),
      });
    });

    expect(result.current.state.reasoningText).toBe('Step 1\nStep 2');
  });

  it('start_tool_calling adds tool event', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'start_tool_calling',
        data: JSON.stringify({
          id: 'tool-1',
          tool_name: 'kubectl',
          description: 'Run kubectl command',
        }),
      });
    });

    expect(result.current.state.toolEvents).toHaveLength(1);
    expect(result.current.state.toolEvents[0]).toEqual({
      id: 'tool-1',
      name: 'kubectl',
      status: 'running',
      description: 'Run kubectl command',
    });
  });

  it('tool_calling_result updates tool event by id', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'start_tool_calling',
        data: JSON.stringify({
          id: 'tool-1',
          tool_name: 'kubectl',
        }),
      });
    });

    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'tool_calling_result',
        data: JSON.stringify({
          tool_call_id: 'tool-1',
          status: 'done',
          description: 'Command executed',
        }),
      });
    });

    expect(result.current.state.toolEvents[0].status).toBe('done');
    expect(result.current.state.toolEvents[0].description).toBe('Command executed');
  });

  it('ai_answer_end sets response and loading false', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'ai_answer_end',
        data: JSON.stringify({ analysis: 'Final answer' }),
      });
    });

    expect(result.current.state.response?.response).toBe('Final answer');
    expect(result.current.state.streamingText).toBe('Final answer');
    expect(result.current.state.loading).toBe(false);
  });

  it('stream_end finalizes from streamingText', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'ai_message',
        data: JSON.stringify({ content: 'Streamed text' }),
      });
    });

    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'stream_end',
      });
    });

    expect(result.current.state.response?.response).toBe('Streamed text');
    expect(result.current.state.loading).toBe(false);
  });

  it('stream_end without streamingText just sets loading false', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'stream_end',
      });
    });

    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.response).toBeNull();
  });

  it('error event sets error and loading false', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'error',
        error: 'Connection failed',
      });
    });

    expect(result.current.state.error).toBe('Connection failed');
    expect(result.current.state.loading).toBe(false);
  });

  it('context canceled error sets loading false with no error', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'error',
        error: 'context canceled',
      });
    });

    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.error).toBeNull();
  });

  it('context cancelled error sets loading false with no error', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'error',
        error: 'context cancelled',
      });
    });

    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.error).toBeNull();
  });

  it('cancel invokes cancel API and sets loading false', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    const streamId = result.current.state.streamId!;

    await act(async () => {
      await result.current.cancel();
    });

    expect(mockCancelFn).toHaveBeenCalledWith(streamId);
    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.streamId).toBeNull();
  });

  it('cancel with no active stream does nothing', async () => {
    const { result } = renderHook(() => useHolmesStream());

    await act(async () => {
      await result.current.cancel();
    });

    expect(mockCancelFn).not.toHaveBeenCalled();
  });

  it('ignores event with non-matching stream_id', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    await act(async () => {
      emitChatEvent({
        stream_id: 'different-stream-id',
        event: 'ai_message',
        data: JSON.stringify({ content: 'Should be ignored' }),
      });
    });

    expect(result.current.state.streamingText).toBe('');
  });

  it('context progress event upserts step by id', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    await act(async () => {
      emitContextEvent({
        key: 'test-key',
        kind: 'deployment',
        namespace: 'default',
        name: 'my-app',
        step: 'step-1',
        status: 'running',
        detail: 'Analyzing deployment...',
      });
    });

    expect(result.current.state.contextSteps).toHaveLength(1);
    expect(result.current.state.contextSteps[0]).toEqual({
      id: 'step-1',
      step: 'step-1',
      status: 'running',
      detail: 'Analyzing deployment...',
    });
  });

  it('context progress updates existing step by id', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    await act(async () => {
      emitContextEvent({
        key: 'test-key',
        kind: 'deployment',
        namespace: 'default',
        name: 'my-app',
        step: 'step-1',
        status: 'running',
        detail: 'Analyzing deployment...',
      });
    });

    await act(async () => {
      emitContextEvent({
        key: 'test-key',
        kind: 'deployment',
        namespace: 'default',
        name: 'my-app',
        step: 'step-1',
        status: 'done',
        detail: 'Analysis complete',
      });
    });

    expect(result.current.state.contextSteps).toHaveLength(1);
    expect(result.current.state.contextSteps[0].status).toBe('done');
    expect(result.current.state.contextSteps[0].detail).toBe('Analysis complete');
  });

  it('ignores context progress event with non-matching key', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    await act(async () => {
      emitContextEvent({
        key: 'different-key',
        kind: 'deployment',
        namespace: 'default',
        name: 'my-app',
        step: 'step-1',
        status: 'running',
        detail: 'Analyzing...',
      });
    });

    expect(result.current.state.contextSteps).toHaveLength(0);
  });

  it('analyze sets queryTimestamp', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);
    const beforeTime = new Date();

    await act(async () => {
      await result.current.analyze('test-key', runFn);
    });

    const afterTime = new Date();
    const timestamp = result.current.state.queryTimestamp;
    expect(timestamp).toBeTruthy();
    const parsedTime = new Date(timestamp!);
    expect(parsedTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(parsedTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });

  it('analyze resets error from previous run', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key-1', runFn);
    });

    // Set error in first run
    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'error',
        error: 'Error from first run',
      });
    });

    expect(result.current.state.error).toBe('Error from first run');

    // Start second run
    await act(async () => {
      await result.current.analyze('test-key-2', runFn);
    });

    expect(result.current.state.error).toBeNull();
  });

  it('analyze resets previous response', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const runFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.analyze('test-key-1', runFn);
    });

    // Set response in first run
    await act(async () => {
      emitChatEvent({
        stream_id: result.current.state.streamId!,
        event: 'ai_message',
        data: JSON.stringify({ content: 'Previous response' }),
      });
    });

    expect(result.current.state.response).toBeTruthy();

    // Start second run
    await act(async () => {
      await result.current.analyze('test-key-2', runFn);
    });

    expect(result.current.state.response).toBeNull();
  });

  it('analyze handles run function errors', async () => {
    const { result } = renderHook(() => useHolmesStream());
    const error = new Error('Run function failed');
    const runFn = vi.fn().mockRejectedValue(error);

    await act(async () => {
      try {
        await result.current.analyze('test-key', runFn);
      } catch {
        // Error is caught and stored in state
      }
    });

    expect(result.current.state.error).toBe('Run function failed');
    expect(result.current.state.loading).toBe(false);
  });
});
