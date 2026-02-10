import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  GetMCPConfig,
  SetMCPConfig,
  GetMCPStatus,
  StartMCPServer,
  StopMCPServer,
} from './mcpApi';
import type { MCPConfig, MCPStatus } from './mcpApi';
import { showSuccess, showError } from '../notification';

// ─── State ───────────────────────────────────────────────────────────────────

interface MCPState {
  config: MCPConfig | null;
  status: MCPStatus | null;
  loading: boolean;
  error: string | null;
  showConfig: boolean;
}

const initialState: MCPState = {
  config: null,
  status: null,
  loading: false,
  error: null,
  showConfig: false,
};

// ─── Actions ─────────────────────────────────────────────────────────────────

type MCPAction =
  | { type: 'SET_CONFIG'; config: MCPConfig }
  | { type: 'SET_STATUS'; status: MCPStatus }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SHOW_CONFIG' }
  | { type: 'HIDE_CONFIG' };

function reducer(state: MCPState, action: MCPAction): MCPState {
  switch (action.type) {
    case 'SET_CONFIG':
      return { ...state, config: action.config, loading: false, error: null };
    case 'SET_STATUS':
      return { ...state, status: action.status };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };
    case 'SHOW_CONFIG':
      return { ...state, showConfig: true };
    case 'HIDE_CONFIG':
      return { ...state, showConfig: false };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface MCPContextValue {
  state: MCPState;
  loadConfig: () => Promise<void>;
  saveConfig: (config: MCPConfig) => Promise<void>;
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  showConfigModal: () => void;
  hideConfigModal: () => void;
}

const MCPContext = createContext<MCPContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function MCPProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load config on mount
  const loadConfig = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const config = await GetMCPConfig();
      dispatch({ type: 'SET_CONFIG', config });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dispatch({ type: 'SET_ERROR', error: msg });
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Poll status every 10s when enabled
  useEffect(() => {
    if (!state.config?.enabled) return;

    let active = true;
    const poll = async () => {
      try {
        const status = await GetMCPStatus();
        if (active) dispatch({ type: 'SET_STATUS', status });
      } catch {
        // Ignore polling errors
      }
    };
    poll();
    const id = setInterval(poll, 10_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [state.config?.enabled]);

  const saveConfig = useCallback(async (config: MCPConfig) => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      await SetMCPConfig(config);
      dispatch({ type: 'SET_CONFIG', config });
      showSuccess('MCP configuration saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dispatch({ type: 'SET_ERROR', error: msg });
      showError(`Failed to save MCP config: ${msg}`);
      throw err;
    }
  }, []);

  const startServer = useCallback(async () => {
    try {
      await StartMCPServer();
      const status = await GetMCPStatus();
      dispatch({ type: 'SET_STATUS', status });
      showSuccess('MCP server started');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showError(`Failed to start MCP server: ${msg}`);
    }
  }, []);

  const stopServer = useCallback(async () => {
    try {
      await StopMCPServer();
      const status = await GetMCPStatus();
      dispatch({ type: 'SET_STATUS', status });
      showSuccess('MCP server stopped');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showError(`Failed to stop MCP server: ${msg}`);
    }
  }, []);

  const showConfigModal = useCallback(() => {
    dispatch({ type: 'SHOW_CONFIG' });
  }, []);

  const hideConfigModal = useCallback(() => {
    dispatch({ type: 'HIDE_CONFIG' });
  }, []);

  const value: MCPContextValue = {
    state,
    loadConfig,
    saveConfig,
    startServer,
    stopServer,
    showConfigModal,
    hideConfigModal,
  };

  return <MCPContext.Provider value={value}>{children}</MCPContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useMCP(): MCPContextValue {
  const ctx = useContext(MCPContext);
  if (!ctx) {
    throw new Error('useMCP must be used within <MCPProvider>');
  }
  return ctx;
}
