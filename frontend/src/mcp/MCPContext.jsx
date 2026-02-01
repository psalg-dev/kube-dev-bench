import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import {
  GetMCPConfig,
  SetMCPConfig,
  GetMCPStatus,
  DefaultMCPConfig,
} from './mcpApi';
import { showSuccess, showError } from '../notification';

const MCPContext = createContext(null);

const initialState = {
  enabled: false,
  configured: false,
  host: 'localhost',
  port: 3000,
  allowDestructive: false,
  requireConfirm: true,
  maxLogLines: 1000,
  loading: false,
  error: null,
  serverStatus: {
    running: false,
    enabled: false,
    transport: 'http',
  },
  showConfig: false,
};

function mcpReducer(state, action) {
  switch (action.type) {
    case 'SET_CONFIG':
      return {
        ...state,
        enabled: action.config.enabled,
        configured: action.config.enabled,
        host: action.config.host || 'localhost',
        port: action.config.port || 3000,
        allowDestructive: action.config.allowDestructive,
        requireConfirm: action.config.requireConfirm,
        maxLogLines: action.config.maxLogLines,
      };
    case 'SET_STATUS':
      return {
        ...state,
        serverStatus: action.status,
      };
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

export function MCPProvider({ children }) {
  const [state, dispatch] = useReducer(mcpReducer, initialState);

  const loadConfig = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const config = await GetMCPConfig();
      dispatch({ type: 'SET_CONFIG', config });
    } catch (err) {
      console.error('Failed to load MCP config:', err);
      dispatch({ type: 'SET_ERROR', error: err.message });
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, []);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Poll server status every 5 seconds if enabled
  useEffect(() => {
    if (!state.enabled) return;

    const pollStatus = async () => {
      try {
        const status = await GetMCPStatus();
        dispatch({ type: 'SET_STATUS', status });
      } catch (err) {
        console.error('Failed to get MCP status:', err);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [state.enabled]);

  const saveConfig = useCallback(async (config) => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      await SetMCPConfig(config);
      dispatch({ type: 'SET_CONFIG', config });
      dispatch({ type: 'HIDE_CONFIG' });
      showSuccess('MCP configuration saved');
    } catch (err) {
      console.error('Failed to save MCP config:', err);
      showError(`Failed to save MCP config: ${err.message}`);
      dispatch({ type: 'SET_ERROR', error: err.message });
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, []);

  const showConfigModal = useCallback(() => {
    console.log('MCPContext showConfigModal called, dispatching SHOW_CONFIG');
    dispatch({ type: 'SHOW_CONFIG' });
    console.log('MCPContext dispatch completed');
  }, []);

  const hideConfigModal = useCallback(() => {
    dispatch({ type: 'HIDE_CONFIG' });
  }, []);

  const value = {
    state,
    loadConfig,
    saveConfig,
    showConfigModal,
    hideConfigModal,
  };

  return (
    <MCPContext.Provider value={value}>
      {children}
    </MCPContext.Provider>
  );
}

export function useMCP() {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCP must be used within an MCPProvider');
  }
  return context;
}

export default MCPContext;
