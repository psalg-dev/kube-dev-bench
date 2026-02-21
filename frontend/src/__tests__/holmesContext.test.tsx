import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HolmesProvider, useHolmes } from '../holmes/HolmesContext';
import './wailsMocks';
import { eventsOnMock, genericAPIMock, resetAllMocks } from './wailsMocks';

const toUndefinedPromise = <T,>(value: T) => Promise.resolve(value as unknown as undefined);

type HolmesContextValue = ReturnType<typeof useHolmes>;

type TestConsumerProps = {
  onContext: (_ctx: HolmesContextValue) => void;
};
function TestConsumer({ onContext }: TestConsumerProps) {
  const context = useHolmes();
  useEffect(() => {
    onContext(context);
  }, [context, onContext]);
  return null;
}

describe('HolmesContext', () => {
  beforeEach(() => {
    resetAllMocks();
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHolmesConfig') {
        return toUndefinedPromise({
          enabled: false,
          endpoint: '',
          apiKey: '',
          modelKey: '',
          responseFormat: '',
        });
      }
      return toUndefinedPromise(undefined);
    });
  });

  it('provides initial state', async () => {
    let capturedContext: HolmesContextValue | undefined;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => {
          capturedContext = ctx;
        }} />
      </HolmesProvider>
    );

    await waitFor(() => {
      expect(capturedContext).toBeDefined();
      expect(capturedContext?.state.showPanel).toBe(false);
      expect(capturedContext?.state.showConfig).toBe(false);
      expect(capturedContext?.state.loading).toBe(false);
    });
  });

  it('loads configuration on mount', async () => {
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHolmesConfig') {
        return toUndefinedPromise({
          enabled: true,
          endpoint: 'http://test:8080',
          apiKey: '********',
          modelKey: 'fast-model',
          responseFormat: '',
        });
      }
      return toUndefinedPromise(undefined);
    });

    let capturedContext: HolmesContextValue | undefined;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => {
          capturedContext = ctx;
        }} />
      </HolmesProvider>
    );

    await waitFor(() => {
      expect(capturedContext?.state.enabled).toBe(true);
      expect(capturedContext?.state.endpoint).toBe('http://test:8080');
      expect(capturedContext?.state.configured).toBe(true);
    });
  });

  it('toggles panel visibility', async () => {
    let capturedContext: HolmesContextValue | undefined;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => {
          capturedContext = ctx;
        }} />
      </HolmesProvider>
    );

    await waitFor(() => {
      expect(capturedContext?.state.showPanel).toBe(false);
    });

    await act(async () => {
      await capturedContext?.togglePanel();
    });
    await waitFor(() => {
      expect(capturedContext?.state.showPanel).toBe(true);
    });

    await act(async () => {
      await capturedContext?.togglePanel();
    });
    await waitFor(() => {
      expect(capturedContext?.state.showPanel).toBe(false);
    });
  });

  it('shows and hides config modal', async () => {
    let capturedContext: HolmesContextValue | undefined;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => {
          capturedContext = ctx;
        }} />
      </HolmesProvider>
    );

    await waitFor(() => {
      expect(capturedContext?.state.showConfig).toBe(false);
    });

    await act(async () => {
      await capturedContext?.showConfigModal();
    });
    await waitFor(() => {
      expect(capturedContext?.state.showConfig).toBe(true);
    });

    await act(async () => {
      await capturedContext?.hideConfigModal();
    });
    await waitFor(() => {
      expect(capturedContext?.state.showConfig).toBe(false);
    });
  });

  it('askHolmes sends question and updates state', async () => {
    let streamCallback: ((_payload: { event: string; data: string }) => void) | undefined;
    eventsOnMock.mockImplementation((event: string, callback: (_payload: { event: string; data: string }) => void) => {
      if (event === 'holmes:chat:stream') {
        streamCallback = callback;
      }
      return () => {};
    });
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHolmesConfig') {
        return toUndefinedPromise({ enabled: true, endpoint: 'http://test:8080', apiKey: '', modelKey: '', responseFormat: '' });
      }
      if (name === 'AskHolmesStream') {
        return toUndefinedPromise(undefined);
      }
      return toUndefinedPromise(undefined);
    });

    let capturedContext: HolmesContextValue | undefined;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => {
          capturedContext = ctx;
        }} />
      </HolmesProvider>
    );

    await waitFor(() => {
      expect(capturedContext).toBeDefined();
    });

    await act(async () => {
      await capturedContext?.askHolmes('test question');
      streamCallback?.({
        event: 'ai_answer_end',
        data: JSON.stringify({ analysis: 'Test answer from Holmes' }),
      });
    });

    await waitFor(() => {
      expect(capturedContext?.state.response).toBeDefined();
      expect(capturedContext?.state.response?.response).toBe('Test answer from Holmes');
      expect(capturedContext?.state.loading).toBe(false);
    });
  });

  it('askHolmes handles errors', async () => {
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHolmesConfig') {
        return toUndefinedPromise({ enabled: true, endpoint: 'http://test:8080', apiKey: '', modelKey: '', responseFormat: '' });
      }
      if (name === 'AskHolmesStream') {
        return Promise.reject(new Error('Connection failed'));
      }
      return toUndefinedPromise(undefined);
    });

    let capturedContext: HolmesContextValue | undefined;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => {
          capturedContext = ctx;
        }} />
      </HolmesProvider>
    );

    await waitFor(() => {
      expect(capturedContext).toBeDefined();
    });

    try {
      await act(async () => {
        await capturedContext?.askHolmes('test question');
      });
    } catch {
      // Expected error
    }

    await waitFor(() => {
      expect(document.body).toHaveTextContent('Holmes query failed: Connection failed');
      expect(capturedContext?.state.loading).toBe(false);
    });
  });

  it('clearResponse clears state', async () => {
    let streamCallback: ((_payload: { event: string; data: string }) => void) | undefined;
    eventsOnMock.mockImplementation((event: string, callback: (_payload: { event: string; data: string }) => void) => {
      if (event === 'holmes:chat:stream') {
        streamCallback = callback;
      }
      return () => {};
    });
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHolmesConfig') {
        return toUndefinedPromise({ enabled: true, endpoint: 'http://test:8080', apiKey: '', modelKey: '', responseFormat: '' });
      }
      if (name === 'AskHolmesStream') {
        return toUndefinedPromise(undefined);
      }
      return toUndefinedPromise(undefined);
    });

    let capturedContext: HolmesContextValue | undefined;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => {
          capturedContext = ctx;
        }} />
      </HolmesProvider>
    );

    await waitFor(() => {
      expect(capturedContext).toBeDefined();
    });

    await act(async () => {
      await capturedContext?.askHolmes('test question');
      streamCallback?.({
        event: 'ai_answer_end',
        data: JSON.stringify({ analysis: 'Test answer' }),
      });
    });
    await waitFor(() => {
      expect(capturedContext?.state.response).toBeDefined();
    });

    await act(async () => {
      capturedContext?.clearResponse();
    });
    await waitFor(() => {
      expect(capturedContext?.state.response).toBe(null);
      expect(capturedContext?.state.query).toBe('');
    });
  });

  it('throws error when useHolmes is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function BadComponent() {
      useHolmes();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow('useHolmes must be used within HolmesProvider');

    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Extended tests: streaming path, partial-response accumulation, abort-on-unmount
// ─────────────────────────────────────────

describe('HolmesContext – streaming path', () => {
  beforeEach(() => {
    resetAllMocks();
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHolmesConfig') {
        return toUndefinedPromise({ enabled: true, endpoint: 'http://test:8080', apiKey: '', modelKey: '', responseFormat: '' });
      }
      if (name === 'AskHolmesStream') {
        return toUndefinedPromise(undefined);
      }
      return toUndefinedPromise(undefined);
    });
  });

  it('accumulates partial response text from multiple ai_message events', async () => {
    let streamCallback: ((_payload: { stream_id?: string; event?: string; data?: string | null; error?: string }) => void) | undefined;

    eventsOnMock.mockImplementation((event: string, callback: typeof streamCallback) => {
      if (event === 'holmes:chat:stream') {
        streamCallback = callback;
      }
      return () => {};
    });

    let capturedContext: HolmesContextValue | undefined;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />
      </HolmesProvider>
    );

    await waitFor(() => { expect(capturedContext).toBeDefined(); });

    // Start a query
    await act(async () => {
      await capturedContext?.askHolmes('partial test question');
    });

    // Send first partial ai_message
    await act(async () => {
      streamCallback?.({ event: 'ai_message', data: JSON.stringify({ content: 'Hello' }) });
    });

    await waitFor(() => {
      expect(capturedContext?.state.streamingText).toBe('Hello');
    });

    // Send second partial ai_message – should be appended
    await act(async () => {
      streamCallback?.({ event: 'ai_message', data: JSON.stringify({ content: 'World' }) });
    });

    await waitFor(() => {
      expect(capturedContext?.state.streamingText).toBe('Hello\nWorld');
    });

    // The response should also reflect the accumulated streaming text
    expect(capturedContext?.state.response?.response).toBe('Hello\nWorld');
  });

  it('accumulates reasoning text separately from content', async () => {
    let streamCallback: ((_payload: { stream_id?: string; event?: string; data?: string | null; error?: string }) => void) | undefined;

    eventsOnMock.mockImplementation((event: string, callback: typeof streamCallback) => {
      if (event === 'holmes:chat:stream') streamCallback = callback;
      return () => {};
    });

    let capturedContext: HolmesContextValue | undefined;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />
      </HolmesProvider>
    );

    await waitFor(() => { expect(capturedContext).toBeDefined(); });

    await act(async () => { await capturedContext?.askHolmes('reasoning test'); });

    await act(async () => {
      streamCallback?.({ event: 'ai_message', data: JSON.stringify({ reasoning: 'Step 1' }) });
    });

    await waitFor(() => { expect(capturedContext?.state.reasoningText).toBe('Step 1'); });

    await act(async () => {
      streamCallback?.({ event: 'ai_message', data: JSON.stringify({ reasoning: 'Step 2' }) });
    });

    await waitFor(() => { expect(capturedContext?.state.reasoningText).toBe('Step 1\nStep 2'); });
    // Content should be unchanged since only reasoning was sent
    expect(capturedContext?.state.streamingText).toBe('');
  });

  it('cleans up onHolmesChatStream listener on unmount (abort-on-unmount)', async () => {
    const unsubscribeSpy = vi.fn();

    eventsOnMock.mockImplementation((event: string) => {
      // Return a unique spy for the chat stream event
      if (event === 'holmes:chat:stream' || event === 'holmes:deployment:status') {
        return unsubscribeSpy;
      }
      return () => {};
    });

    let capturedContext: HolmesContextValue | undefined;
    const { unmount } = render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />
      </HolmesProvider>
    );

    await waitFor(() => { expect(capturedContext).toBeDefined(); });

    // Unmount should trigger useEffect cleanup → call the unsubscribe function
    unmount();

    expect(unsubscribeSpy).toHaveBeenCalled();
  });

  it('handles stream_end event and finalises loading state', async () => {
    let streamCallback: ((_payload: { stream_id?: string; event?: string; data?: string | null; error?: string }) => void) | undefined;

    eventsOnMock.mockImplementation((event: string, callback: typeof streamCallback) => {
      if (event === 'holmes:chat:stream') streamCallback = callback;
      return () => {};
    });

    let capturedContext: HolmesContextValue | undefined;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />
      </HolmesProvider>
    );

    await waitFor(() => { expect(capturedContext).toBeDefined(); });

    await act(async () => { await capturedContext?.askHolmes('stream end test'); });

    // Accumulate some text first
    await act(async () => {
      streamCallback?.({ event: 'ai_message', data: JSON.stringify({ content: 'Final answer' }) });
    });

    await waitFor(() => { expect(capturedContext?.state.loading).toBe(true); });

    // Now send stream_end – this should stop loading
    await act(async () => {
      streamCallback?.({ event: 'stream_end' });
    });

    await waitFor(() => {
      expect(capturedContext?.state.loading).toBe(false);
    });
  });

  it('dispatches ADD_TOOL_EVENT and UPDATE_TOOL_EVENT for tool calls', async () => {
    let streamCallback: ((_payload: { stream_id?: string; event?: string; data?: string | null; error?: string }) => void) | undefined;

    eventsOnMock.mockImplementation((event: string, callback: typeof streamCallback) => {
      if (event === 'holmes:chat:stream') streamCallback = callback;
      return () => {};
    });

    let capturedContext: HolmesContextValue | undefined;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />
      </HolmesProvider>
    );

    await waitFor(() => { expect(capturedContext).toBeDefined(); });

    await act(async () => { await capturedContext?.askHolmes('tool test'); });

    // Tool call started
    await act(async () => {
      streamCallback?.({
        event: 'start_tool_calling',
        data: JSON.stringify({ id: 'tool-1', tool_name: 'kubectl_get', description: 'Getting pods' }),
      });
    });

    await waitFor(() => {
      const toolEvents = capturedContext?.state.toolEvents ?? [];
      expect(toolEvents).toHaveLength(1);
      expect(toolEvents[0]).toMatchObject({ id: 'tool-1', name: 'kubectl_get', status: 'running' });
    });

    // Tool call completed
    await act(async () => {
      streamCallback?.({
        event: 'tool_calling_result',
        data: JSON.stringify({ tool_call_id: 'tool-1', name: 'kubectl_get', result: { status: 'success' } }),
      });
    });

    await waitFor(() => {
      const toolEvents = capturedContext?.state.toolEvents ?? [];
      expect(toolEvents[0]).toMatchObject({ id: 'tool-1', status: 'success' });
    });
  });

  it('handles STREAM_ERROR events and shows error notification', async () => {
    let streamCallback: ((_payload: { stream_id?: string; event?: string; data?: string | null; error?: string }) => void) | undefined;

    eventsOnMock.mockImplementation((event: string, callback: typeof streamCallback) => {
      if (event === 'holmes:chat:stream') streamCallback = callback;
      return () => {};
    });

    let capturedContext: HolmesContextValue | undefined;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />
      </HolmesProvider>
    );

    await waitFor(() => { expect(capturedContext).toBeDefined(); });

    await act(async () => { await capturedContext?.askHolmes('error test'); });

    await act(async () => {
      streamCallback?.({ event: 'error', data: null, error: 'Internal server error' });
    });

    await waitFor(() => {
      expect(capturedContext?.state.loading).toBe(false);
      expect(capturedContext?.state.error).toBe('Internal server error');
    });

    expect(document.body).toHaveTextContent('Holmes query failed: Internal server error');
  });
});
