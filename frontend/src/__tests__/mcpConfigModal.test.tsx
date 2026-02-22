/**
 * Tests for MCPConfigModal
 * Covers: rendering, save/cancel, port validation, transport mode, start/stop server
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock useMCP ───────────────────────────────────────────────────────────────

const mockSaveConfig = vi.fn();
const mockHideConfigModal = vi.fn();
const mockStartServer = vi.fn();
const mockStopServer = vi.fn();
const mockLoadConfig = vi.fn();

// We use a factory function so each test can supply its own state slice
let mockState = {
  config: {
    enabled: false,
    host: 'localhost',
    port: 3000,
    transportMode: 'http',
    allowDestructive: false,
    requireConfirm: true,
    maxLogLines: 1000,
  },
  status: null as { running: boolean; address?: string } | null,
  loading: false,
  error: null as string | null,
  showConfig: true,
};

vi.mock('../mcp/MCPContext', () => ({
  useMCP: () => ({
    state: mockState,
    saveConfig: mockSaveConfig,
    startServer: mockStartServer,
    stopServer: mockStopServer,
    hideConfigModal: mockHideConfigModal,
    loadConfig: mockLoadConfig,
  }),
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────────

import MCPConfigModal from '../mcp/MCPConfigModal';

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('MCPConfigModal – visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      config: {
        enabled: false,
        host: 'localhost',
        port: 3000,
        transportMode: 'http',
        allowDestructive: false,
        requireConfirm: true,
        maxLogLines: 1000,
      },
      status: null,
      loading: false,
      error: null,
      showConfig: true,
    };
  });

  it('renders when showConfig is true', () => {
    render(<MCPConfigModal />);
    expect(screen.getByText('MCP Server Configuration')).toBeInTheDocument();
  });

  it('does NOT render when showConfig is false', () => {
    mockState = { ...mockState, showConfig: false };
    render(<MCPConfigModal />);
    expect(screen.queryByText('MCP Server Configuration')).not.toBeInTheDocument();
  });

  it('calls hideConfigModal when the ✕ close button is clicked', async () => {
    render(<MCPConfigModal />);
    fireEvent.click(screen.getByTitle('Close'));
    expect(mockHideConfigModal).toHaveBeenCalledTimes(1);
  });

  it('calls hideConfigModal when the Cancel button is clicked', async () => {
    render(<MCPConfigModal />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockHideConfigModal).toHaveBeenCalledTimes(1);
  });

  it('calls hideConfigModal when backdrop is clicked', async () => {
    render(<MCPConfigModal />);
    // The backdrop is the outermost element with class "mcp-config-backdrop"
    const backdrop = document.querySelector('.mcp-config-backdrop')!;
    fireEvent.click(backdrop);
    expect(mockHideConfigModal).toHaveBeenCalledTimes(1);
  });

  it('calls hideConfigModal when Escape key is pressed', async () => {
    render(<MCPConfigModal />);
    const backdrop = document.querySelector('.mcp-config-backdrop')!;
    fireEvent.keyDown(backdrop, { key: 'Escape' });
    expect(mockHideConfigModal).toHaveBeenCalledTimes(1);
  });
});

describe('MCPConfigModal – save (valid input)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveConfig.mockResolvedValue(undefined);
    mockState = {
      config: {
        enabled: true,
        host: 'localhost',
        port: 3000,
        transportMode: 'http',
        allowDestructive: false,
        requireConfirm: true,
        maxLogLines: 1000,
      },
      status: null,
      loading: false,
      error: null,
      showConfig: true,
    };
  });

  it('calls saveConfig with form data when Save is submitted', async () => {
    const user = userEvent.setup();
    render(<MCPConfigModal />);

    // Submit the form (Save button is type="submit")
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockSaveConfig).toHaveBeenCalledTimes(1);
    });

    expect(mockSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        host: 'localhost',
        port: 3000,
        transportMode: 'http',
      })
    );
  });

  it('saves with updated port when user changes port field', async () => {
    const user = userEvent.setup();
    render(<MCPConfigModal />);

    const portInput = screen.getByLabelText(/^Port$/i);
    await user.clear(portInput);
    await user.type(portInput, '8080');

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockSaveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ port: 8080 })
      );
    });
  });

  it('disables Save button while saving is in progress', async () => {
    // never resolves — keeps saving=true
    mockSaveConfig.mockImplementation(() => new Promise(() => {}));

    const user = userEvent.setup();
    render(<MCPConfigModal />);

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    });
  });
});

describe('MCPConfigModal – port validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveConfig.mockResolvedValue(undefined);
    // Enable the form so port field is active (not disabled)
    mockState = {
      config: {
        enabled: true,
        host: 'localhost',
        port: 3000,
        transportMode: 'http',
        allowDestructive: false,
        requireConfirm: true,
        maxLogLines: 1000,
      },
      status: null,
      loading: false,
      error: null,
      showConfig: true,
    };
  });

  it('rejects port value of 0 – SetMCPConfig is NOT called', async () => {
    const user = userEvent.setup();
    render(<MCPConfigModal />);

    // Port input: min=1, max=65535. Setting to 0 violates min constraint.
    const portInput = screen.getByLabelText(/^Port$/i);
    await user.clear(portInput);
    await user.type(portInput, '0');

    // userEvent simulates real browser form submission, which checks validity.
    // Since port=0 < min=1, HTML5 validation prevents onSubmit from firing.
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    // Give React time to process any pending promises
    await act(async () => { await Promise.resolve(); });

    expect(mockSaveConfig).not.toHaveBeenCalled();
  });

  it('rejects port value above 65535 – SetMCPConfig is NOT called', async () => {
    const user = userEvent.setup();
    render(<MCPConfigModal />);

    const portInput = screen.getByLabelText(/^Port$/i);
    await user.clear(portInput);
    await user.type(portInput, '99999');

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await act(async () => { await Promise.resolve(); });

    expect(mockSaveConfig).not.toHaveBeenCalled();
  });

  it('accepts a valid port value and calls saveConfig', async () => {
    const user = userEvent.setup();
    render(<MCPConfigModal />);

    const portInput = screen.getByLabelText(/^Port$/i);
    await user.clear(portInput);
    await user.type(portInput, '8080');

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockSaveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ port: 8080 })
      );
    });
  });
});

describe('MCPConfigModal – transport mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      config: {
        enabled: true,
        host: 'localhost',
        port: 3000,
        transportMode: 'http',
        allowDestructive: false,
        requireConfirm: true,
        maxLogLines: 1000,
      },
      status: null,
      loading: false,
      error: null,
      showConfig: true,
    };
  });

  it('shows Host and Port fields when transport mode is http', () => {
    render(<MCPConfigModal />);
    expect(screen.getByLabelText(/^Host$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Port$/i)).toBeInTheDocument();
  });

  it('hides Host and Port fields when transport mode is changed to stdio', async () => {
    render(<MCPConfigModal />);

    const transportSelect = screen.getByLabelText(/Transport/i);
    fireEvent.change(transportSelect, { target: { value: 'stdio' } });

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Host$/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^Port$/i)).not.toBeInTheDocument();
    });
  });
});

describe('MCPConfigModal – server start/stop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartServer.mockResolvedValue(undefined);
    mockStopServer.mockResolvedValue(undefined);
    mockLoadConfig.mockResolvedValue(undefined);
  });

  it('shows Stopped status and Start button when server is not running', () => {
    mockState = {
      config: { enabled: true, host: 'localhost', port: 3000, transportMode: 'http', allowDestructive: false, requireConfirm: true, maxLogLines: 1000 },
      status: { running: false },
      loading: false,
      error: null,
      showConfig: true,
    };

    render(<MCPConfigModal />);

    expect(screen.getByText(/stopped/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^start$/i })).toBeInTheDocument();
  });

  it('shows Running status and Stop button when server is running', () => {
    mockState = {
      config: { enabled: true, host: 'localhost', port: 3000, transportMode: 'http', allowDestructive: false, requireConfirm: true, maxLogLines: 1000 },
      status: { running: true, address: 'localhost:3000' },
      loading: false,
      error: null,
      showConfig: true,
    };

    render(<MCPConfigModal />);

    expect(screen.getByText(/running/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^stop$/i })).toBeInTheDocument();
  });

  it('calls startServer when Start button is clicked', async () => {
    mockState = {
      config: { enabled: true, host: 'localhost', port: 3000, transportMode: 'http', allowDestructive: false, requireConfirm: true, maxLogLines: 1000 },
      status: { running: false },
      loading: false,
      error: null,
      showConfig: true,
    };

    render(<MCPConfigModal />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
    });

    expect(mockStartServer).toHaveBeenCalledTimes(1);
    expect(mockLoadConfig).toHaveBeenCalled();
  });

  it('calls stopServer when Stop button is clicked', async () => {
    mockState = {
      config: { enabled: true, host: 'localhost', port: 3000, transportMode: 'http', allowDestructive: false, requireConfirm: true, maxLogLines: 1000 },
      status: { running: true },
      loading: false,
      error: null,
      showConfig: true,
    };

    render(<MCPConfigModal />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^stop$/i }));
    });

    expect(mockStopServer).toHaveBeenCalledTimes(1);
    expect(mockLoadConfig).toHaveBeenCalled();
  });
});
