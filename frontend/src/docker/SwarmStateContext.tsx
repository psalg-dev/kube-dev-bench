import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import type { docker } from '../../wailsjs/go/models';
import { EventsOn } from '../../wailsjs/runtime';
import { showError, showSuccess } from '../notification';
import {
    AutoConnectDocker,
    ConnectToDocker,
    DisconnectDocker,
    GetDockerConfig,
    GetDockerConnectionStatus,
    GetSwarmConfigs,
    GetSwarmNetworks,
    GetSwarmNodes,
    GetSwarmSecrets,
    GetSwarmServices,
    GetSwarmStacks,
    GetSwarmTasks,
    GetSwarmVolumes,
    TestDockerConnection,
} from './swarmApi';

interface SwarmConnectionStatus {
  connected?: boolean;
  swarmActive?: boolean;
  nodeId?: string;
  isManager?: boolean;
  serverVersion?: string;
  error?: string;
  host?: string;
}

interface SwarmState {
  connected: boolean;
  swarmActive: boolean;
  nodeId: string;
  isManager: boolean;
  serverVersion: string;
  error: string;
  loading: boolean;
  showWizard: boolean;
  initialized: boolean;
  config: docker.DockerConfig | null;
  services: unknown[];
  tasks: unknown[];
  nodes: unknown[];
  networks: unknown[];
  configs: unknown[];
  secrets: unknown[];
  stacks: unknown[];
  volumes: unknown[];
}

type SwarmAction =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_CONNECTION_STATUS'; status: SwarmConnectionStatus }
  | { type: 'SET_SHOW_WIZARD'; value: boolean }
  | { type: 'SET_INITIALIZED' }
  | { type: 'SET_CONFIG'; config: docker.DockerConfig | null }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'DISCONNECT' }
  | { type: 'SET_SERVICES'; data: unknown[] }
  | { type: 'SET_TASKS'; data: unknown[] }
  | { type: 'SET_NODES'; data: unknown[] }
  | { type: 'SET_NETWORKS'; data: unknown[] }
  | { type: 'SET_CONFIGS'; data: unknown[] }
  | { type: 'SET_SECRETS'; data: unknown[] }
  | { type: 'SET_STACKS'; data: unknown[] }
  | { type: 'SET_VOLUMES'; data: unknown[] };

export const initialState: SwarmState = {
  connected: false,
  swarmActive: false,
  nodeId: '',
  isManager: false,
  serverVersion: '',
  error: '',
  loading: false,
  showWizard: false,
  initialized: false,
  config: null,
  services: [],
  tasks: [],
  nodes: [],
  networks: [],
  configs: [],
  secrets: [],
  stacks: [],
  volumes: [],
};

function reducer(state: SwarmState, action: SwarmAction): SwarmState {
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

interface SwarmStateActions {
  connect: (_config: docker.DockerConfig) => Promise<SwarmConnectionStatus>;
  testConnection: (_config: docker.DockerConfig) => Promise<SwarmConnectionStatus>;
  disconnect: () => Promise<void>;
  refreshConnectionStatus: () => Promise<void>;
  openWizard: () => void;
  closeWizard: () => void;
  refreshServices: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshNodes: () => Promise<void>;
  refreshNetworks: () => Promise<void>;
  refreshConfigs: () => Promise<void>;
  refreshSecrets: () => Promise<void>;
  refreshStacks: () => Promise<void>;
  refreshVolumes: () => Promise<void>;
}
export interface SwarmStateContextValue extends SwarmState {
  actions: SwarmStateActions;
  refreshServices: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshNodes: () => Promise<void>;
  refreshNetworks: () => Promise<void>;
  refreshConfigs: () => Promise<void>;
  refreshSecrets: () => Promise<void>;
  refreshStacks: () => Promise<void>;
  refreshVolumes: () => Promise<void>;
}

const SwarmStateContext = createContext<SwarmStateContextValue | null>(null);

export function SwarmStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const refreshingRef = useRef<Record<string, boolean>>({});

  const runRefresh = useCallback(async <T,>(
    key: string,
    fetcher: () => Promise<T>,
    onData: (_data: T) => void,
    label: string
  ) => {
    if (refreshingRef.current[key]) return;
    refreshingRef.current[key] = true;
    try {
      const data = await fetcher();
      onData(data);
    } catch (err) {
      console.error(`Failed to fetch ${label}:`, err);
    } finally {
      refreshingRef.current[key] = false;
    }
  }, []);
  const refreshConnectionStatus = useCallback(async () => {
    try {
      const status = await GetDockerConnectionStatus();
      dispatch({ type: 'SET_CONNECTION_STATUS', status });
    } catch (err) {
      dispatch({ type: 'SET_CONNECTION_STATUS', status: { connected: false, error: String(err) } });
    }
  }, []);

  const refreshServices = useCallback(async () => {
    await runRefresh('services', GetSwarmServices, (data) => dispatch({ type: 'SET_SERVICES', data }), 'services');
  }, [runRefresh]);

  const refreshTasks = useCallback(async () => {
    await runRefresh('tasks', GetSwarmTasks, (data) => dispatch({ type: 'SET_TASKS', data }), 'tasks');
  }, [runRefresh]);

  const refreshNodes = useCallback(async () => {
    await runRefresh('nodes', GetSwarmNodes, (data) => dispatch({ type: 'SET_NODES', data }), 'nodes');
  }, [runRefresh]);

  const refreshNetworks = useCallback(async () => {
    await runRefresh('networks', GetSwarmNetworks, (data) => dispatch({ type: 'SET_NETWORKS', data }), 'networks');
  }, [runRefresh]);

  const refreshConfigs = useCallback(async () => {
    await runRefresh('configs', GetSwarmConfigs, (data) => dispatch({ type: 'SET_CONFIGS', data }), 'configs');
  }, [runRefresh]);

  const refreshSecrets = useCallback(async () => {
    await runRefresh('secrets', GetSwarmSecrets, (data) => dispatch({ type: 'SET_SECRETS', data }), 'secrets');
  }, [runRefresh]);

  const refreshStacks = useCallback(async () => {
    await runRefresh('stacks', GetSwarmStacks, (data) => dispatch({ type: 'SET_STACKS', data }), 'stacks');
  }, [runRefresh]);

  const refreshVolumes = useCallback(async () => {
    await runRefresh('volumes', GetSwarmVolumes, (data) => dispatch({ type: 'SET_VOLUMES', data }), 'volumes');
  }, [runRefresh]);

  useEffect(() => {
    (async () => {
      dispatch({ type: 'SET_LOADING', loading: true });
      try {
        const config = await GetDockerConfig();
        if (config) {
          dispatch({ type: 'SET_CONFIG', config });
        }

        const status = await AutoConnectDocker();
        dispatch({ type: 'SET_CONNECTION_STATUS', status });

        if (!status?.connected) {
          console.warn('Docker not connected - Swarm features will be unavailable');
        }
      } catch (err) {
        console.warn('Docker auto-connect failed:', err);
        dispatch({ type: 'SET_CONNECTION_STATUS', status: { connected: false } });
      } finally {
        dispatch({ type: 'SET_INITIALIZED' });
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    })();
  }, []);

  const connect = useCallback(async (config: docker.DockerConfig) => {
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
      showError(`Failed to connect to Docker: ${String(err)}`);
      return { connected: false, error: String(err) };
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, []);

  const testConnection = useCallback(async (config: docker.DockerConfig) => {
    try {
      return await TestDockerConnection(config);
    } catch (err) {
      return { connected: false, error: String(err) };
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await DisconnectDocker();
      dispatch({ type: 'DISCONNECT' });
      showSuccess('Disconnected from Docker');
    } catch (err) {
      showError(`Failed to disconnect: ${String(err)}`);
    }
  }, []);

  const openWizard = useCallback(() => {
    dispatch({ type: 'SET_SHOW_WIZARD', value: true });
  }, []);

  const closeWizard = useCallback(() => {
    dispatch({ type: 'SET_SHOW_WIZARD', value: false });
  }, []);

  useEffect(() => {
    let active = true;
    let offs: Array<(() => void) | undefined> = [];

    const hasRuntimeEvents = () => {
      const win = window as Window & { runtime?: { EventsOnMultiple?: (..._args: unknown[]) => unknown } };
      return typeof win.runtime?.EventsOnMultiple === 'function';
    };

    const registerEvents = () => {
      offs = [];
      offs.push(
        EventsOn('docker:connected', () => {
          setTimeout(() => {
            refreshConnectionStatus();
          }, 250);
        })
      );
      offs.push(
        EventsOn('docker:disconnected', () => {
          setTimeout(() => {
            refreshConnectionStatus();
          }, 250);
        })
      );
      offs.push(EventsOn('swarm:services:update', (data: unknown) => {
        if (Array.isArray(data)) {
          dispatch({ type: 'SET_SERVICES', data });
        } else {
          refreshServices();
        }
      }));
      offs.push(EventsOn('swarm:tasks:update', (data: unknown) => {
        dispatch({ type: 'SET_TASKS', data: Array.isArray(data) ? data : [] });
      }));
      offs.push(EventsOn('swarm:nodes:update', (data: unknown) => {
        dispatch({ type: 'SET_NODES', data: Array.isArray(data) ? data : [] });
      }));
      offs.push(EventsOn('swarm:networks:update', (data: unknown) => {
        if (Array.isArray(data)) {
          dispatch({ type: 'SET_NETWORKS', data });
        } else {
          refreshNetworks();
        }
      }));
      offs.push(EventsOn('swarm:configs:update', (data: unknown) => {
        if (Array.isArray(data)) {
          dispatch({ type: 'SET_CONFIGS', data });
        } else {
          refreshConfigs();
        }
      }));
      offs.push(EventsOn('swarm:secrets:update', (data: unknown) => {
        if (Array.isArray(data)) {
          dispatch({ type: 'SET_SECRETS', data });
        } else {
          refreshSecrets();
        }
      }));
      offs.push(EventsOn('swarm:stacks:update', (data: unknown) => {
        if (Array.isArray(data)) {
          dispatch({ type: 'SET_STACKS', data });
        } else {
          refreshStacks();
        }
      }));
      offs.push(EventsOn('swarm:volumes:update', (data: unknown) => {
        if (Array.isArray(data)) {
          dispatch({ type: 'SET_VOLUMES', data });
        } else {
          refreshVolumes();
        }
      }));
    };

    (async () => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (!active) return;
        if (hasRuntimeEvents()) {
          registerEvents();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (hasRuntimeEvents()) {
        registerEvents();
      }
    })();

    return () => {
      active = false;
      offs.forEach((off) => { if (typeof off === 'function') off(); });
    };
  }, [refreshConnectionStatus, refreshServices, refreshNetworks, refreshConfigs, refreshSecrets, refreshStacks, refreshVolumes]);

  const actions: SwarmStateActions = {
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
  if (!context) {
    return null;
  }
  return context;
}

export default SwarmStateContext;
