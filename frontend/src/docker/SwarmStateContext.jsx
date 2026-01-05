import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react';
import {
  GetDockerConnectionStatus,
  ConnectToDocker,
  TestDockerConnection,
  DisconnectDocker,
  GetDockerConfig,
  AutoConnectDocker,
  GetSwarmServices,
  GetSwarmTasks,
  GetSwarmNodes,
  GetSwarmNetworks,
  GetSwarmConfigs,
  GetSwarmSecrets,
  GetSwarmStacks,
  GetSwarmVolumes,
} from './swarmApi.js';
import { showError, showSuccess, showWarning } from '../notification';
import { EventsOn } from '../../wailsjs/runtime';

const SwarmStateContext = createContext(null);

const initialState = {
  connected: false,
  swarmActive: false,
  nodeId: '',
  isManager: false,
  serverVersion: '',
  error: '',
  loading: false,
  showWizard: false,
  initialized: false,
  config: null, // Docker connection config
  // Resource data
  services: [],
  tasks: [],
  nodes: [],
  networks: [],
  configs: [],
  secrets: [],
  stacks: [],
  volumes: [],
};

export { initialState };

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        connected: action.status?.connected || false,
        swarmActive: action.status?.swarmActive || false,
        nodeId: action.status?.nodeId || '',
        isManager: action.status?.isManager || false,
        serverVersion: action.status?.serverVersion || '',
        error: action.status?.error || '',
      };
    case 'SET_SHOW_WIZARD':
      return { ...state, showWizard: action.value };
    case 'SET_INITIALIZED':
      return { ...state, initialized: true };
    case 'SET_CONFIG':
      return { ...state, config: action.config };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'DISCONNECT':
      return {
        ...state,
        connected: false,
        swarmActive: false,
        nodeId: '',
        isManager: false,
        serverVersion: '',
        error: '',
        services: [],
        tasks: [],
        nodes: [],
        networks: [],
        configs: [],
        secrets: [],
        stacks: [],
        volumes: [],
      };
    case 'SET_SERVICES':
      return { ...state, services: action.data || [] };
    case 'SET_TASKS':
      return { ...state, tasks: action.data || [] };
    case 'SET_NODES':
      return { ...state, nodes: action.data || [] };
    case 'SET_NETWORKS':
      return { ...state, networks: action.data || [] };
    case 'SET_CONFIGS':
      return { ...state, configs: action.data || [] };
    case 'SET_SECRETS':
      return { ...state, secrets: action.data || [] };
    case 'SET_STACKS':
      return { ...state, stacks: action.data || [] };
    case 'SET_VOLUMES':
      return { ...state, volumes: action.data || [] };
    default:
      return state;
  }
}

export { reducer as swarmStateReducer };

export function SwarmStateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const refreshingRef = useRef({});

  const refreshConnectionStatus = useCallback(async () => {
    try {
      const status = await GetDockerConnectionStatus();
      dispatch({ type: 'SET_CONNECTION_STATUS', status });
    } catch (err) {
      dispatch({ type: 'SET_CONNECTION_STATUS', status: { connected: false, error: err.toString() } });
    }
  }, []);

  // Resource refresh functions
  const refreshServices = useCallback(async () => {
    if (refreshingRef.current.services) return;
    refreshingRef.current.services = true;
    try {
      const data = await GetSwarmServices();
      dispatch({ type: 'SET_SERVICES', data });
    } catch (err) {
      console.error('Failed to fetch services:', err);
    } finally {
      refreshingRef.current.services = false;
    }
  }, []);

  const refreshTasks = useCallback(async () => {
    if (refreshingRef.current.tasks) return;
    refreshingRef.current.tasks = true;
    try {
      const data = await GetSwarmTasks();
      dispatch({ type: 'SET_TASKS', data });
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      refreshingRef.current.tasks = false;
    }
  }, []);

  const refreshNodes = useCallback(async () => {
    if (refreshingRef.current.nodes) return;
    refreshingRef.current.nodes = true;
    try {
      const data = await GetSwarmNodes();
      dispatch({ type: 'SET_NODES', data });
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
    } finally {
      refreshingRef.current.nodes = false;
    }
  }, []);

  const refreshNetworks = useCallback(async () => {
    if (refreshingRef.current.networks) return;
    refreshingRef.current.networks = true;
    try {
      const data = await GetSwarmNetworks();
      dispatch({ type: 'SET_NETWORKS', data });
    } catch (err) {
      console.error('Failed to fetch networks:', err);
    } finally {
      refreshingRef.current.networks = false;
    }
  }, []);

  const refreshConfigs = useCallback(async () => {
    if (refreshingRef.current.configs) return;
    refreshingRef.current.configs = true;
    try {
      const data = await GetSwarmConfigs();
      dispatch({ type: 'SET_CONFIGS', data });
    } catch (err) {
      console.error('Failed to fetch configs:', err);
    } finally {
      refreshingRef.current.configs = false;
    }
  }, []);

  const refreshSecrets = useCallback(async () => {
    if (refreshingRef.current.secrets) return;
    refreshingRef.current.secrets = true;
    try {
      const data = await GetSwarmSecrets();
      dispatch({ type: 'SET_SECRETS', data });
    } catch (err) {
      console.error('Failed to fetch secrets:', err);
    } finally {
      refreshingRef.current.secrets = false;
    }
  }, []);

  const refreshStacks = useCallback(async () => {
    if (refreshingRef.current.stacks) return;
    refreshingRef.current.stacks = true;
    try {
      const data = await GetSwarmStacks();
      dispatch({ type: 'SET_STACKS', data });
    } catch (err) {
      console.error('Failed to fetch stacks:', err);
    } finally {
      refreshingRef.current.stacks = false;
    }
  }, []);

  const refreshVolumes = useCallback(async () => {
    if (refreshingRef.current.volumes) return;
    refreshingRef.current.volumes = true;
    try {
      const data = await GetSwarmVolumes();
      dispatch({ type: 'SET_VOLUMES', data });
    } catch (err) {
      console.error('Failed to fetch volumes:', err);
    } finally {
      refreshingRef.current.volumes = false;
    }
  }, []);

  // Initialization - try to auto-connect
  useEffect(() => {
    (async () => {
      dispatch({ type: 'SET_LOADING', loading: true });
      try {
        // Try to load saved config and auto-connect
        const config = await GetDockerConfig();
        if (config) {
          dispatch({ type: 'SET_CONFIG', config });
        }

        // Try auto-connect
        const status = await AutoConnectDocker();
        dispatch({ type: 'SET_CONNECTION_STATUS', status });

        if (!status?.connected) {
          // Don't show wizard automatically - Docker is optional
          console.log('Docker not connected - Swarm features will be unavailable');
        }
      } catch (err) {
        console.log('Docker auto-connect failed:', err);
        dispatch({ type: 'SET_CONNECTION_STATUS', status: { connected: false } });
      } finally {
        dispatch({ type: 'SET_INITIALIZED' });
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    })();
  }, []);

  const connect = useCallback(async (config) => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const status = await ConnectToDocker(config);
      dispatch({ type: 'SET_CONNECTION_STATUS', status });
      dispatch({ type: 'SET_CONFIG', config });

      if (status?.connected) {
        showSuccess(`Connected to Docker ${status.serverVersion}${status.swarmActive ? ' (Swarm active)' : ''}`);
        dispatch({ type: 'SET_SHOW_WIZARD', value: false });
      } else {
        showError(`Failed to connect to Docker: ${status?.error || 'Unknown error'}`);
      }
      return status;
    } catch (err) {
      showError(`Failed to connect to Docker: ${err}`);
      return { connected: false, error: err.toString() };
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, []);

  const testConnection = useCallback(async (config) => {
    try {
      return await TestDockerConnection(config);
    } catch (err) {
      return { connected: false, error: err.toString() };
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await DisconnectDocker();
      dispatch({ type: 'DISCONNECT' });
      showSuccess('Disconnected from Docker');
    } catch (err) {
      showError(`Failed to disconnect: ${err}`);
    }
  }, []);

  const openWizard = useCallback(() => {
    dispatch({ type: 'SET_SHOW_WIZARD', value: true });
  }, []);

  const closeWizard = useCallback(() => {
    dispatch({ type: 'SET_SHOW_WIZARD', value: false });
  }, []);

  // Subscribe to backend events for real-time updates
  useEffect(() => {
    const offs = [];
    offs.push(EventsOn('swarm:services:update', (data) => {
      // Some callers emit this as a refresh signal without payload.
      if (Array.isArray(data)) {
        dispatch({ type: 'SET_SERVICES', data });
      } else {
        refreshServices();
      }
    }));
    offs.push(EventsOn('swarm:tasks:update', (data) => {
      dispatch({ type: 'SET_TASKS', data });
    }));
    offs.push(EventsOn('swarm:nodes:update', (data) => {
      dispatch({ type: 'SET_NODES', data });
    }));
    offs.push(EventsOn('swarm:networks:update', (data) => {
      // Some callers emit this as a refresh signal without payload.
      if (Array.isArray(data)) {
        dispatch({ type: 'SET_NETWORKS', data });
      } else {
        refreshNetworks();
      }
    }));
    offs.push(EventsOn('swarm:configs:update', (data) => {
      if (Array.isArray(data)) {
        dispatch({ type: 'SET_CONFIGS', data });
      } else {
        refreshConfigs();
      }
    }));
    offs.push(EventsOn('swarm:secrets:update', (data) => {
      if (Array.isArray(data)) {
        dispatch({ type: 'SET_SECRETS', data });
      } else {
        refreshSecrets();
      }
    }));
    offs.push(EventsOn('swarm:stacks:update', (data) => {
      if (Array.isArray(data)) {
        dispatch({ type: 'SET_STACKS', data });
      } else {
        refreshStacks();
      }
    }));
    offs.push(EventsOn('swarm:volumes:update', (data) => {
      if (Array.isArray(data)) {
        dispatch({ type: 'SET_VOLUMES', data });
      } else {
        refreshVolumes();
      }
    }));

    return () => {
      offs.forEach(off => { if (typeof off === 'function') off(); });
    };
  }, [refreshServices, refreshNetworks, refreshConfigs, refreshSecrets, refreshStacks, refreshVolumes]);

  const actions = {
    connect,
    testConnection,
    disconnect,
    refreshConnectionStatus,
    openWizard,
    closeWizard,
    refreshServices,
    refreshTasks,
    refreshNodes,
    refreshNetworks,
    refreshConfigs,
    refreshSecrets,
    refreshStacks,
    refreshVolumes,
  };

  return (
    <SwarmStateContext.Provider value={{
      ...state,
      actions,
      refreshServices,
      refreshTasks,
      refreshNodes,
      refreshNetworks,
      refreshConfigs,
      refreshSecrets,
      refreshStacks,
      refreshVolumes,
    }}>
      {children}
    </SwarmStateContext.Provider>
  );
}

export function useSwarmState() {
  const context = useContext(SwarmStateContext);
  // Return null instead of throwing when used outside provider
  // This allows components to gracefully handle missing context with optional chaining
  if (!context) {
    return null;
  }
  return context;
}

export default SwarmStateContext;
