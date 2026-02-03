/**
 * Resource Context Factory
 * 
 * Creates resource contexts with shared patterns to reduce duplication
 * between ClusterStateContext and SwarmStateContext.
 * 
 * Features:
 * - Shared reducer pattern (SET_LOADING, SET_CONNECTION_STATUS, etc.)
 * - Dynamic SET_* handling
 * - Configurable refresh functions
 * - Error handling patterns
 */
import { createContext, useReducer, useMemo, useCallback, useContext, useRef, useEffect, useState } from 'react';

/**
 * Standard action types used across resource contexts
 */
export const ActionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_CONNECTION_STATUS: 'SET_CONNECTION_STATUS',
  SET_ERROR: 'SET_ERROR',
  SET_DATA: 'SET_DATA',
  RESET: 'RESET',
};

/**
 * Creates a reducer that handles standard actions plus dynamic SET_* actions
 * @param {Object} customReducers - Optional custom reducer functions keyed by action type
 * @returns {Function} Reducer function
 */
export function createResourceReducer(customReducers = {}) {
  return function reducer(state, action) {
    // Check for custom reducers first
    if (customReducers[action.type]) {
      return customReducers[action.type](state, action);
    }

    switch (action.type) {
      case ActionTypes.SET_LOADING:
        return { ...state, loading: action.loading };
      
      case ActionTypes.SET_CONNECTION_STATUS:
        return { ...state, connectionStatus: action.status };
      
      case ActionTypes.SET_ERROR:
        return { ...state, error: action.error };
      
      case ActionTypes.SET_DATA:
        return { ...state, data: action.data };
      
      case ActionTypes.RESET:
        return action.initialState || state;
      
      default:
        // Dynamic SET_* handling: SET_PODS -> sets state.pods
        if (action.type.startsWith('SET_')) {
          const key = action.type.replace('SET_', '').toLowerCase();
          return { ...state, [key]: action.data !== undefined ? action.data : [] };
        }
        return state;
    }
  };
}

/**
 * Creates a resource context with provider, hooks, and refresh handlers
 * 
 * @param {Object} config - Configuration object
 * @param {string} config.name - Context name for debugging
 * @param {Object} config.initialState - Initial state object
 * @param {Object} [config.refreshFunctions] - Map of refresh function names to async fetch functions
 * @param {Object} [config.eventMappings] - Map of event names to action types for EventsOn handlers
 * @param {Object} [config.customReducers] - Custom reducer functions keyed by action type
 * @returns {{ Context, Provider, useContext: Function }}
 */
export function createResourceContext(config) {
  const {
    name,
    initialState,
    refreshFunctions = {},
    eventMappings = {},
    customReducers = {},
  } = config;

  const Context = createContext(null);
  Context.displayName = name || 'ResourceContext';

  const reducer = createResourceReducer(customReducers);

  function Provider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);
    const mountedRef = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
      };
    }, []);

    // Create refresh handlers from config
    const refreshHandlers = useMemo(() => {
      return Object.entries(refreshFunctions).reduce((acc, [key, fn]) => {
        acc[`refresh${key.charAt(0).toUpperCase()}${key.slice(1)}`] = async () => {
          if (!mountedRef.current) return;
          try {
            dispatch({ type: ActionTypes.SET_LOADING, loading: true });
            const data = await fn();
            if (mountedRef.current) {
              dispatch({ type: `SET_${key.toUpperCase()}`, data });
            }
          } catch (error) {
            if (mountedRef.current) {
              dispatch({ type: `SET_${key.toUpperCase()}`, data: [] });
              dispatch({ type: ActionTypes.SET_ERROR, error: error.message });
            }
          } finally {
            if (mountedRef.current) {
              dispatch({ type: ActionTypes.SET_LOADING, loading: false });
            }
          }
        };
        return acc;
      }, {});
    }, []); // refreshFunctions should be stable

    // Set up event listeners if EventsOn is available
    useEffect(() => {
      const cleanups = [];
      
      try {
        // Dynamic import to avoid issues in non-Wails environments
        import('../../wailsjs/runtime').then(({ EventsOn }) => {
          if (!mountedRef.current) return;
          
          Object.entries(eventMappings).forEach(([eventName, actionType]) => {
            const off = EventsOn(eventName, (data) => {
              if (!mountedRef.current) return;
              dispatch({ type: actionType, data });
            });
            if (typeof off === 'function') {
              cleanups.push(off);
            }
          });
        }).catch(() => {
          // EventsOn not available (tests, non-Wails env)
        });
      } catch (_) {
        // Ignore runtime import errors
      }

      return () => {
        cleanups.forEach(off => {
          try { off(); } catch (_) {}
        });
      };
    }, []); // eventMappings should be stable

    // Memoize context value to prevent unnecessary re-renders
    const value = useMemo(() => ({
      state,
      dispatch,
      ...refreshHandlers,
    }), [state, refreshHandlers]);

    return (
      <Context.Provider value={value}>
        {children}
      </Context.Provider>
    );
  }

  // Custom hook for consuming the context
  function useResourceContext() {
    const context = useContext(Context);
    if (!context) {
      throw new Error(`use${name} must be used within a ${name}Provider`);
    }
    return context;
  }

  return {
    Context,
    Provider,
    useContext: useResourceContext,
  };
}

/**
 * Creates a simple data context for holding fetched data with loading states
 * 
 * @param {Object} config - Configuration object
 * @param {string} config.name - Context name
 * @param {Function} config.fetchFn - Async function to fetch data
 * @param {string} [config.eventName] - Event name to listen for updates
 * @param {Function} [config.normalizeFn] - Function to normalize fetched data
 * @param {Function} [config.signatureFn] - Function to compute data signature for change detection
 * @returns {{ Context, Provider, useData: Function, useRefetch: Function }}
 */
export function createDataContext(config) {
  const {
    name,
    fetchFn,
    eventName,
    normalizeFn = (data) => data,
    signatureFn = (data) => JSON.stringify(data),
  } = config;

  const Context = createContext({ data: null, loading: false, error: null, refetch: () => {} });
  Context.displayName = name;

  function Provider({ children }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const lastSigRef = useRef(null);
    const mountedRef = useRef(true);

    const applyData = useCallback((rawData) => {
      const normalized = normalizeFn(rawData);
      const sig = signatureFn(normalized);
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig;
        if (mountedRef.current) {
          setData(normalized);
        }
      }
    }, []);

    const refetch = useCallback(async () => {
      if (!mountedRef.current) return;
      try {
        setLoading(true);
        setError(null);
        const result = await fetchFn();
        applyData(result);
      } catch (err) {
        if (mountedRef.current) {
          setError(err.message);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }, [applyData]);

    useEffect(() => {
      mountedRef.current = true;
      refetch();

      // Set up event listener if configured
      let cleanup;
      if (eventName) {
        try {
          import('../../wailsjs/runtime').then(({ EventsOn }) => {
            if (!mountedRef.current) return;
            cleanup = EventsOn(eventName, (eventData) => {
              if (mountedRef.current) {
                applyData(eventData);
              }
            });
          }).catch(() => {});
        } catch (_) {}
      }

      return () => {
        mountedRef.current = false;
        if (typeof cleanup === 'function') {
          try { cleanup(); } catch (_) {}
        }
      };
    }, [refetch, applyData]);

    const value = useMemo(() => ({
      data,
      loading,
      error,
      refetch,
    }), [data, loading, error, refetch]);

    return (
      <Context.Provider value={value}>
        {children}
      </Context.Provider>
    );
  }

  function useData() {
    const context = useContext(Context);
    return context.data;
  }

  function useRefetch() {
    const context = useContext(Context);
    return context.refetch;
  }

  return {
    Context,
    Provider,
    useData,
    useRefetch,
  };
}

export default createResourceContext;
