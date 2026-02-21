/**
 * Tests for MCPContext (MCPProvider + useMCP hook)
 * Covers: config loading, start/stop server, error handling, status polling
 */
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks ──────────────────────────────────────────────────────────────

const mockGetMCPConfig = vi.fn();
const mockSetMCPConfig = vi.fn();
const mockGetMCPStatus = vi.fn();
const mockStartMCPServer = vi.fn();
const mockStopMCPServer = vi.fn();

vi.mock('../mcp/mcpApi', () => ({
  GetMCPConfig: (...args: unknown[]) => mockGetMCPConfig(...args),
  SetMCPConfig: (...args: unknown[]) => mockSetMCPConfig(...args),
  GetMCPStatus: (...args: unknown[]) => mockGetMCPStatus(...args),
  StartMCPServer: (...args: unknown[]) => mockStartMCPServer(...args),
  StopMCPServer: (...args: unknown[]) => mockStopMCPServer(...args),
}));

vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────────

import { MCPProvider, useMCP } from '../mcp/MCPContext';
import * as notification from '../notification';
import type { MCPConfig } from '../mcp/mcpApi';

// ─── Test consumer component ───────────────────────────────────────────────────

type MCPContextValue = ReturnType<typeof useMCP>;

function TestConsumer({ onContext }: { onContext: (_ctx: MCPContextValue) => void }) {
  const ctx = useMCP();
  useEffect(() => {
    onContext(ctx);
  }, [ctx, onContext]);
  return null;
}

// ─── Default config fixture ────────────────────────────────────────────────────

const defaultConfig: MCPConfig = {
  enabled: false,
  host: 'localhost',
  port: 3000,
  transportMode: 'http',
  allowDestructive: false,
  requireConfirm: true,
  maxLogLines: 1000,
};

const defaultStatus = {
  running: false,
  enabled: false,
  transport: 'http',
  address: '',
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('MCPContext – initial state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMCPConfig.mockResolvedValue(defaultConfig);
    mockGetMCPStatus.mockResolvedValue(defaultStatus);
  });

  it('loads config on mount and exposes it in state', async () => {
    let capturedCtx: MCPContextValue | undefined;

    render(
      <MCPProvider>
        <TestConsumer onContext={(ctx) => { capturedCtx = ctx; }} />
      </MCPProvider>
    );

    // Wait for config to be loaded (initially null, then populated)
    await waitFor(() => {
      expect(capturedCtx?.state.config).not.toBeNull();
    });

    expect(mockGetMCPConfig).toHaveBeenCalledTimes(1);
    expect(capturedCtx?.state.config?.port).toBe(3000);
    expect(capturedCtx?.state.config?.host).toBe('localhost');
    expect(capturedCtx?.state.config?.enabled).toBe(false);
  });

  it('exposes showConfig=false initially', async () => {
    let capturedCtx: MCPContextValue | undefined;

    render(
      <MCPProvider>
        <TestConsumer onContext={(ctx) => { capturedCtx = ctx; }} />
      </MCPProvider>
    );

    await waitFor(() => { expect(capturedCtx?.state.config).not.toBeNull(); });

    expect(capturedCtx?.state.showConfig).toBe(false);
  });

  it('showConfigModal / hideConfigModal toggle showConfig', async () => {
    let capturedCtx: MCPContextValue | undefined;

    render(
      <MCPProvider>
        <TestConsumer onContext={(ctx) => { capturedCtx = ctx; }} />
      </MCPProvider>
    );

    await waitFor(() => { expect(capturedCtx?.state.config).not.toBeNull(); });

    await act(async () => { capturedCtx?.showConfigModal(); });
    await waitFor(() => { expect(capturedCtx?.state.showConfig).toBe(true); });

    await act(async () => { capturedCtx?.hideConfigModal(); });
    await waitFor(() => { expect(capturedCtx?.state.showConfig).toBe(false); });
  });
});

describe('MCPContext – saveConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMCPConfig.mockResolvedValue(defaultConfig);
    mockSetMCPConfig.mockResolvedValue(undefined);
    mockGetMCPStatus.mockResolvedValue(defaultStatus);
  });

  it('calls SetMCPConfig and updates state on success', async () => {
    let capturedCtx: MCPContextValue | undefined;

    render(
      <MCPProvider>
        <TestConsumer onContext={(ctx) => { capturedCtx = ctx; }} />
      </MCPProvider>
    );

    await waitFor(() => { expect(capturedCtx?.state.config).not.toBeNull(); });

    const newConfig: MCPConfig = { ...defaultConfig, port: 4000, enabled: true };

    await act(async () => {
      await capturedCtx?.saveConfig(newConfig);
    });

    expect(mockSetMCPConfig).toHaveBeenCalledWith(newConfig);
    await waitFor(() => {
      expect(capturedCtx?.state.config?.port).toBe(4000);
    });
    expect(notification.showSuccess).toHaveBeenCalledWith('MCP configuration saved');
  });

  it('shows error notification and re-throws when SetMCPConfig fails', async () => {
    mockSetMCPConfig.mockRejectedValue(new Error('disk full'));
    let capturedCtx: MCPContextValue | undefined;

    render(
      <MCPProvider>
        <TestConsumer onContext={(ctx) => { capturedCtx = ctx; }} />
      </MCPProvider>
    );

    await waitFor(() => { expect(capturedCtx?.state.config).not.toBeNull(); });

    await expect(
      act(async () => { await capturedCtx?.saveConfig(defaultConfig); })
    ).rejects.toThrow();

    expect(notification.showError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to save MCP config')
    );
  });
});

describe('MCPContext – startServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMCPConfig.mockResolvedValue(defaultConfig);
    mockStartMCPServer.mockResolvedValue(undefined);
  });

  it('calls StartMCPServer, fetches status, and shows success notification', async () => {
    // Always return running status so the assertion is predictable
    const runningStatus = { running: true, enabled: true, transport: 'http', address: 'localhost:3000' };
    mockGetMCPStatus.mockResolvedValue(runningStatus);

    let capturedCtx: MCPContextValue | undefined;

    render(
      <MCPProvider>
        <TestConsumer onContext={(ctx) => { capturedCtx = ctx; }} />
      </MCPProvider>
    );

    await waitFor(() => { expect(capturedCtx?.state.config).not.toBeNull(); });

    await act(async () => { await capturedCtx?.startServer(); });

    expect(mockStartMCPServer).toHaveBeenCalledTimes(1);
    expect(mockGetMCPStatus).toHaveBeenCalled();
    expect(notification.showSuccess).toHaveBeenCalledWith('MCP server started');

    await waitFor(() => {
      expect(capturedCtx?.state.status?.running).toBe(true);
    });
  });

  it('shows error notification when StartMCPServer fails', async () => {
    mockGetMCPStatus.mockResolvedValue(defaultStatus);
    mockStartMCPServer.mockRejectedValue(new Error('port in use'));

    let capturedCtx: MCPContextValue | undefined;

    render(
      <MCPProvider>
        <TestConsumer onContext={(ctx) => { capturedCtx = ctx; }} />
      </MCPProvider>
    );

    await waitFor(() => { expect(capturedCtx?.state.config).not.toBeNull(); });

    await act(async () => { await capturedCtx?.startServer(); });

    expect(notification.showError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to start MCP server')
    );
  });

  it('does not show success when StartMCPServer throws', async () => {
    mockGetMCPStatus.mockResolvedValue(defaultStatus);
    mockStartMCPServer.mockRejectedValue(new Error('connection refused'));

    let capturedCtx: MCPContextValue | undefined;

    render(
      <MCPProvider>
        <TestConsumer onContext={(ctx) => { capturedCtx = ctx; }} />
      </MCPProvider>
    );

    await waitFor(() => { expect(capturedCtx?.state.config).not.toBeNull(); });

    await act(async () => { await capturedCtx?.startServer(); });

    expect(notification.showSuccess).not.toHaveBeenCalled();
    expect(notification.showError).toHaveBeenCalled();
  });
});

describe('MCPContext – stopServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMCPConfig.mockResolvedValue({ ...defaultConfig, enabled: true });
    mockStopMCPServer.mockResolvedValue(undefined);
    mockGetMCPStatus.mockResolvedValue({ running: false, enabled: false, transport: 'http', address: '' });
  });

  it('calls StopMCPServer and shows success notification', async () => {
    let capturedCtx: MCPContextValue | undefined;

    render(
      <MCPProvider>
        <TestConsumer onContext={(ctx) => { capturedCtx = ctx; }} />
      </MCPProvider>
    );

    await waitFor(() => { expect(capturedCtx?.state.config).not.toBeNull(); });

    await act(async () => { await capturedCtx?.stopServer(); });

    expect(mockStopMCPServer).toHaveBeenCalledTimes(1);
    expect(notification.showSuccess).toHaveBeenCalledWith('MCP server stopped');
  });

  it('shows error notification when StopMCPServer fails', async () => {
    mockStopMCPServer.mockRejectedValue(new Error('already stopped'));

    let capturedCtx: MCPContextValue | undefined;

    render(
      <MCPProvider>
        <TestConsumer onContext={(ctx) => { capturedCtx = ctx; }} />
      </MCPProvider>
    );

    await waitFor(() => { expect(capturedCtx?.state.config).not.toBeNull(); });

    await act(async () => { await capturedCtx?.stopServer(); });

    expect(notification.showError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to stop MCP server')
    );
  });
});

describe('MCPContext – status polling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMCPStatus.mockResolvedValue(defaultStatus);
  });

  it('polls GetMCPStatus immediately when MCP config is enabled', async () => {
    mockGetMCPConfig.mockResolvedValue({ ...defaultConfig, enabled: true });

    let capturedCtx: MCPContextValue | undefined;

    render(
      <MCPProvider>
        <TestConsumer onContext={(ctx) => { capturedCtx = ctx; }} />
      </MCPProvider>
    );

    // Let the initial config load and polling effect run
    await waitFor(() => {
      expect(capturedCtx?.state.config?.enabled).toBe(true);
    });

    // Allow the async poll() call to complete
    await act(async () => { await Promise.resolve(); });

    // The immediate poll() call should have fired GetMCPStatus
    expect(mockGetMCPStatus).toHaveBeenCalled();
  });

  it('does NOT call GetMCPStatus when MCP is disabled', async () => {
    mockGetMCPConfig.mockResolvedValue({ ...defaultConfig, enabled: false });

    let capturedCtx: MCPContextValue | undefined;

    render(
      <MCPProvider>
        <TestConsumer onContext={(ctx) => { capturedCtx = ctx; }} />
      </MCPProvider>
    );

    await waitFor(() => {
      expect(capturedCtx?.state.config).not.toBeNull();
    });

    // Give some time for any erroneous polling
    await act(async () => { await Promise.resolve(); });

    expect(mockGetMCPStatus).not.toHaveBeenCalled();
  });

  it('does NOT call GetMCPStatus when config is null (not yet loaded)', async () => {
    // Never resolves — keeps config at null
    mockGetMCPConfig.mockImplementation(() => new Promise(() => {}));

    let capturedCtx: MCPContextValue | undefined;

    render(
      <MCPProvider>
        <TestConsumer onContext={(ctx) => { capturedCtx = ctx; }} />
      </MCPProvider>
    );

    await act(async () => { await Promise.resolve(); });

    expect(capturedCtx?.state.config).toBeNull();
    expect(mockGetMCPStatus).not.toHaveBeenCalled();
  });
});

describe('MCPContext – useMCP outside provider', () => {
  it('throws when useMCP is used outside MCPProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function BadComponent() {
      useMCP();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow('useMCP must be used within <MCPProvider>');

    consoleSpy.mockRestore();
  });
});
