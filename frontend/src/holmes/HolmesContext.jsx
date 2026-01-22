import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { AskHolmes, GetHolmesConfig, SetHolmesConfig, TestHolmesConnection } from './holmesApi';
import { showSuccess, showError } from '../notification';

const HolmesContext = createContext(null);

const initialState = {
  enabled: false,
  configured: false,
  endpoint: '',
  loading: false,
  query: '',
  response: null,
  error: null,
  showConfig: false,
  showPanel: false,
};

function holmesReducer(state, action) {
  switch (action.type) {
    case 'SET_CONFIG':
      return {
        ...state,
        enabled: action.config.enabled,
        configured: action.config.enabled && !!action.config.endpoint,
        endpoint: action.config.endpoint || '',
      };
    case 'SET_QUERY':
      return { ...state, query: action.query };
    case 'SET_RESPONSE':
      return { ...state, response: action.response, loading: false, error: null };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };
    case 'SHOW_CONFIG':
      return { ...state, showConfig: true };
    case 'HIDE_CONFIG':
      return { ...state, showConfig: false };
    case 'SHOW_PANEL':
      return { ...state, showPanel: true };
    case 'HIDE_PANEL':
      return { ...state, showPanel: false };
    case 'TOGGLE_PANEL':
      return { ...state, showPanel: !state.showPanel };
    case 'CLEAR_RESPONSE':
      return { ...state, response: null, error: null, query: '' };
    default:
      return state;
  }
}

export function HolmesProvider({ children }) {
  const [state, dispatch] = useReducer(holmesReducer, initialState);

  const loadConfig = useCallback(async () => {
    try {
      const config = await GetHolmesConfig();
      dispatch({ type: 'SET_CONFIG', config });
    } catch (err) {
      console.error('Failed to load Holmes config:', err);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const askHolmes = useCallback(async (question) => {
    if (!question || !question.trim()) {
      return;
    }
    dispatch({ type: 'SET_LOADING', loading: true });
    dispatch({ type: 'SET_QUERY', query: question });

    try {
      const response = await AskHolmes(question);
      dispatch({ type: 'SET_RESPONSE', response });
      return response;
    } catch (err) {
      const errorMsg = err.message || String(err);
      dispatch({ type: 'SET_ERROR', error: errorMsg });
      showError('Holmes query failed: ' + errorMsg);
      throw err;
    }
  }, []);

  const saveConfig = useCallback(async (config) => {
    try {
      await SetHolmesConfig(config);
      dispatch({ type: 'SET_CONFIG', config });
      showSuccess('Holmes configuration saved');
      dispatch({ type: 'HIDE_CONFIG' });
    } catch (err) {
      const errorMsg = err.message || String(err);
      showError('Failed to save Holmes config: ' + errorMsg);
      throw err;
    }
  }, []);

  const testConnection = useCallback(async () => {
    try {
      const status = await TestHolmesConnection();
      if (status.connected) {
        showSuccess('Holmes connection successful');
      } else {
        showError('Holmes connection failed: ' + (status.error || 'Unknown error'));
      }
      return status;
    } catch (err) {
      const errorMsg = err.message || String(err);
      showError('Connection test failed: ' + errorMsg);
      throw err;
    }
  }, []);

  const showConfigModal = useCallback(() => dispatch({ type: 'SHOW_CONFIG' }), []);
  const hideConfigModal = useCallback(() => dispatch({ type: 'HIDE_CONFIG' }), []);
  const showPanel = useCallback(() => dispatch({ type: 'SHOW_PANEL' }), []);
  const hidePanel = useCallback(() => dispatch({ type: 'HIDE_PANEL' }), []);
  const togglePanel = useCallback(() => dispatch({ type: 'TOGGLE_PANEL' }), []);
  const clearResponse = useCallback(() => dispatch({ type: 'CLEAR_RESPONSE' }), []);

  const value = {
    state,
    askHolmes,
    saveConfig,
    testConnection,
    showConfigModal,
    hideConfigModal,
    showPanel,
    hidePanel,
    togglePanel,
    clearResponse,
    loadConfig,
  };

  return <HolmesContext.Provider value={value}>{children}</HolmesContext.Provider>;
}

export function useHolmes() {
  const context = useContext(HolmesContext);
  if (!context) {
    throw new Error('useHolmes must be used within HolmesProvider');
  }
  return context;
}

export default HolmesContext;
