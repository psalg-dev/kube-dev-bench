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
