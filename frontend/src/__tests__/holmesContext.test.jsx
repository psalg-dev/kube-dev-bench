import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import './wailsMocks';
import { genericAPIMock, resetAllMocks } from './wailsMocks';
import { HolmesProvider, useHolmes } from '../holmes/HolmesContext';

// Test component that exposes context for testing
function TestConsumer({ onContext }) {
  const context = useHolmes();
  React.useEffect(() => {
    onContext(context);
  }, [context, onContext]);
  return null;
}

describe('HolmesContext', () => {
  beforeEach(() => {
    resetAllMocks();
    // Default mock for GetHolmesConfig
    genericAPIMock.mockImplementation((name, ...args) => {
      if (name === 'GetHolmesConfig') {
        return Promise.resolve({ enabled: false, endpoint: '', apiKey: '' });
      }
      return Promise.resolve(undefined);
    });
  });

  it('provides initial state', async () => {
    let capturedContext;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />
      </HolmesProvider>
    );

    await waitFor(() => {
      expect(capturedContext).toBeDefined();
      expect(capturedContext.state.showPanel).toBe(false);
      expect(capturedContext.state.showConfig).toBe(false);
      expect(capturedContext.state.loading).toBe(false);
    });
  });

  it('loads configuration on mount', async () => {
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHolmesConfig') {
        return Promise.resolve({ enabled: true, endpoint: 'http://test:8080', apiKey: '********' });
      }
      return Promise.resolve(undefined);
    });

    let capturedContext;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />
      </HolmesProvider>
    );

    await waitFor(() => {
      expect(capturedContext.state.enabled).toBe(true);
      expect(capturedContext.state.endpoint).toBe('http://test:8080');
      expect(capturedContext.state.configured).toBe(true);
    });
  });

  it('toggles panel visibility', async () => {
    let capturedContext;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />
      </HolmesProvider>
    );

    await waitFor(() => {
      expect(capturedContext.state.showPanel).toBe(false);
    });

    // Toggle panel on
    capturedContext.togglePanel();
    await waitFor(() => {
      expect(capturedContext.state.showPanel).toBe(true);
    });

    // Toggle panel off
    capturedContext.togglePanel();
    await waitFor(() => {
      expect(capturedContext.state.showPanel).toBe(false);
    });
  });

  it('shows and hides config modal', async () => {
    let capturedContext;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />
      </HolmesProvider>
    );

    await waitFor(() => {
      expect(capturedContext.state.showConfig).toBe(false);
    });

    capturedContext.showConfigModal();
    await waitFor(() => {
      expect(capturedContext.state.showConfig).toBe(true);
    });

    capturedContext.hideConfigModal();
    await waitFor(() => {
      expect(capturedContext.state.showConfig).toBe(false);
    });
  });

  it('askHolmes sends question and updates state', async () => {
    genericAPIMock.mockImplementation((name, ...args) => {
      if (name === 'GetHolmesConfig') {
        return Promise.resolve({ enabled: true, endpoint: 'http://test:8080', apiKey: '' });
      }
      if (name === 'AskHolmes') {
        return Promise.resolve({ response: 'Test answer from Holmes', query_id: 'q123' });
      }
      return Promise.resolve(undefined);
    });

    let capturedContext;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />
      </HolmesProvider>
    );

    await waitFor(() => {
      expect(capturedContext).toBeDefined();
    });

    const result = await capturedContext.askHolmes('test question');
    
    expect(result.response).toBe('Test answer from Holmes');
    await waitFor(() => {
      expect(capturedContext.state.response).toBeDefined();
      expect(capturedContext.state.response.response).toBe('Test answer from Holmes');
      expect(capturedContext.state.loading).toBe(false);
    });
  });

  it('askHolmes handles errors', async () => {
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHolmesConfig') {
        return Promise.resolve({ enabled: true, endpoint: 'http://test:8080', apiKey: '' });
      }
      if (name === 'AskHolmes') {
        return Promise.reject(new Error('Connection failed'));
      }
      return Promise.resolve(undefined);
    });

    let capturedContext;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />
      </HolmesProvider>
    );

    await waitFor(() => {
      expect(capturedContext).toBeDefined();
    });

    try {
      await capturedContext.askHolmes('test question');
    } catch (e) {
      // Expected error
    }

    await waitFor(() => {
      expect(capturedContext.state.error).toBe('Connection failed');
      expect(capturedContext.state.loading).toBe(false);
    });
  });

  it('clearResponse clears state', async () => {
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetHolmesConfig') {
        return Promise.resolve({ enabled: true, endpoint: 'http://test:8080', apiKey: '' });
      }
      if (name === 'AskHolmes') {
        return Promise.resolve({ response: 'Test answer' });
      }
      return Promise.resolve(undefined);
    });

    let capturedContext;
    render(
      <HolmesProvider>
        <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />
      </HolmesProvider>
    );

    await waitFor(() => {
      expect(capturedContext).toBeDefined();
    });

    await capturedContext.askHolmes('test question');
    await waitFor(() => {
      expect(capturedContext.state.response).toBeDefined();
    });

    capturedContext.clearResponse();
    await waitFor(() => {
      expect(capturedContext.state.response).toBe(null);
      expect(capturedContext.state.query).toBe('');
    });
  });

  it('throws error when useHolmes is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    function BadComponent() {
      useHolmes();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow('useHolmes must be used within HolmesProvider');
    
    consoleSpy.mockRestore();
  });
});
