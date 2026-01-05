import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import {
  GetKubeConfigs,
  GetKubeContextsFromFile,
  SaveCustomKubeConfig,
  SetKubeConfigPath,
  SavePrimaryKubeConfig,
  SelectKubeConfigFile,
  GetKubeContexts,
  GetNamespaces,
  SetCurrentKubeContext,
  SetCurrentNamespace,
  GetCurrentConfig,
  GetProxyConfig,
  SetProxyConfig,
  DetectSystemProxy,
} from '../../../wailsjs/go/main/App';
import {
  GetDockerConnectionStatus,
  TestDockerConnection,
  AutoConnectDocker,
  ConnectToDocker,
  GetDefaultDockerHost,
} from '../../docker/swarmApi.js';

function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

const ConnectionsStateContext = createContext(null);

const initialState = {
  // View state
  selectedSection: 'kubernetes', // 'kubernetes' | 'docker-swarm' | 'pinned'
  loading: false,
  error: '',

  // Kubernetes connections
  kubeConfigs: [],
  selectedKubeConfig: null,

  // Docker Swarm connections
  swarmConnections: [],
  swarmDetecting: false,

  // Pinned connections
  pinnedConnections: [], // { type: 'kubernetes' | 'swarm', id: string, name: string, ... }

  // Proxy settings
  proxyConfig: {
    authType: 'none',
    url: '',
    username: '',
    password: '',
  },
  systemProxy: {},

  // Overlay state
  showAddKubeConfigOverlay: false,
  showAddSwarmOverlay: false,
  showProxySettings: false,
  editingConnectionProxy: null, // connection being edited for proxy settings
};

export { initialState };

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_SELECTED_SECTION':
      return { ...state, selectedSection: action.section };
    case 'SET_KUBE_CONFIGS':
      return { ...state, kubeConfigs: action.configs };
    case 'SET_SELECTED_KUBE_CONFIG':
      return { ...state, selectedKubeConfig: action.config };
    case 'SET_SWARM_CONNECTIONS':
      return { ...state, swarmConnections: action.connections };
    case 'SET_SWARM_DETECTING':
      return { ...state, swarmDetecting: action.detecting };
    case 'SET_PINNED_CONNECTIONS':
      return { ...state, pinnedConnections: action.connections };
    case 'TOGGLE_PIN': {
      const { connectionType, connectionId, connectionData } = action;
      const isPinned = state.pinnedConnections.some(
        (c) => c.type === connectionType && c.id === connectionId
      );
      if (isPinned) {
        return {
          ...state,
          pinnedConnections: state.pinnedConnections.filter(
            (c) => !(c.type === connectionType && c.id === connectionId)
          ),
        };
      } else {
        return {
          ...state,
          pinnedConnections: [
            ...state.pinnedConnections,
            { type: connectionType, id: connectionId, ...connectionData },
          ],
        };
      }
    }
    case 'SET_PROXY_CONFIG':
      return { ...state, proxyConfig: action.config };
    case 'SET_SYSTEM_PROXY':
      return { ...state, systemProxy: action.proxy };
    case 'SHOW_ADD_KUBECONFIG_OVERLAY':
      return { ...state, showAddKubeConfigOverlay: action.show };
    case 'SHOW_ADD_SWARM_OVERLAY':
      return { ...state, showAddSwarmOverlay: action.show };
    case 'SHOW_PROXY_SETTINGS':
      return { ...state, showProxySettings: action.show, editingConnectionProxy: action.connection || null };
    default:
      return state;
  }
}

export { reducer as connectionsStateReducer };

// Load pinned connections from localStorage
function loadPinnedConnections() {
  try {
    const saved = localStorage.getItem('kdb-pinned-connections');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// Save pinned connections to localStorage
function savePinnedConnections(connections) {
  try {
    localStorage.setItem('kdb-pinned-connections', JSON.stringify(connections));
  } catch {
    // Ignore localStorage errors
  }
}

export function ConnectionsStateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    pinnedConnections: loadPinnedConnections(),
  });

  // Save pinned connections whenever they change
  useEffect(() => {
    savePinnedConnections(state.pinnedConnections);
  }, [state.pinnedConnections]);

  // Load kubeconfigs on mount
  const loadKubeConfigs = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', loading: true });
      const configs = await GetKubeConfigs();
      const safe = Array.isArray(configs) ? configs : [];
      dispatch({ type: 'SET_KUBE_CONFIGS', configs: safe });
      if (safe.length > 0 && !state.selectedKubeConfig) {
        dispatch({ type: 'SET_SELECTED_KUBE_CONFIG', config: safe[0] });
      }
      return safe;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: 'Failed to load kubeconfig files: ' + err });
      return [];
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, [state.selectedKubeConfig]);

  // Detect Docker Swarm connections
  const detectSwarmConnections = useCallback(async () => {
    dispatch({ type: 'SET_SWARM_DETECTING', detecting: true });
    try {
      // Get the platform-specific default Docker host from backend
      const defaultHost = await GetDefaultDockerHost();
      
      // Try auto-detect local Docker
      const status = await GetDockerConnectionStatus();
      const connections = [];

      if (status?.connected) {
        connections.push({
          id: 'local',
          name: 'Local Docker',
          host: status.host || defaultHost,
          connected: true,
          serverVersion: status.serverVersion || '',
          swarmActive: status.swarmActive || false,
        });
      } else {
        // Add placeholder for local Docker (not connected)
        connections.push({
          id: 'local',
          name: 'Local Docker',
          host: defaultHost,
          connected: false,
          serverVersion: '',
          swarmActive: false,
        });
      }

      dispatch({ type: 'SET_SWARM_CONNECTIONS', connections });
    } catch (err) {
      console.error('Failed to detect Docker connections:', err);
      // Still set a placeholder - use a generic value since we couldn't get the default
      const isWindows = navigator.platform?.toLowerCase().includes('win');
      const fallbackHost = isWindows ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
      dispatch({
        type: 'SET_SWARM_CONNECTIONS',
        connections: [
          {
            id: 'local',
            name: 'Local Docker',
            host: fallbackHost,
            connected: false,
            serverVersion: '',
            swarmActive: false,
          },
        ],
      });
    } finally {
      dispatch({ type: 'SET_SWARM_DETECTING', detecting: false });
    }
  }, []);

  // Load proxy config
  const loadProxyConfig = useCallback(async () => {
    try {
      const [proxyConfig, sysProxy] = await Promise.all([GetProxyConfig(), DetectSystemProxy()]);
      if (proxyConfig) {
        dispatch({
          type: 'SET_PROXY_CONFIG',
          config: {
            authType: proxyConfig.authType || 'none',
            url: proxyConfig.url || '',
            username: proxyConfig.username || '',
            password: '',
          },
        });
      }
      dispatch({ type: 'SET_SYSTEM_PROXY', proxy: sysProxy || {} });
    } catch (err) {
      console.error('Failed to load proxy config:', err);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    loadKubeConfigs();
    detectSwarmConnections();
    loadProxyConfig();
  }, [loadKubeConfigs, detectSwarmConnections, loadProxyConfig]);

  // Actions
  const actions = {
    selectSection: (section) => dispatch({ type: 'SET_SELECTED_SECTION', section }),

    selectKubeConfig: (config) => dispatch({ type: 'SET_SELECTED_KUBE_CONFIG', config }),

    togglePin: (connectionType, connectionId, connectionData) => {
      dispatch({ type: 'TOGGLE_PIN', connectionType, connectionId, connectionData });
    },

    isPinned: (connectionType, connectionId) => {
      return state.pinnedConnections.some(
        (c) => c.type === connectionType && c.id === connectionId
      );
    },

    showAddKubeConfigOverlay: (show) => dispatch({ type: 'SHOW_ADD_KUBECONFIG_OVERLAY', show }),
    showAddSwarmOverlay: (show) => dispatch({ type: 'SHOW_ADD_SWARM_OVERLAY', show }),
    showProxySettings: (show, connection = null) =>
      dispatch({ type: 'SHOW_PROXY_SETTINGS', show, connection }),

    loadKubeConfigs,
    detectSwarmConnections,

    browseKubeConfigFile: async () => {
      try {
        dispatch({ type: 'SET_ERROR', error: '' });
        const filePath = await SelectKubeConfigFile();
        if (filePath) {
          const contexts = await GetKubeContextsFromFile(filePath);
          const fileName = filePath.split(/[\\/]/).pop();
          const newConfig = {
            path: filePath,
            name: fileName,
            contexts: Array.isArray(contexts) ? contexts : [],
          };
          dispatch({ type: 'SET_SELECTED_KUBE_CONFIG', config: newConfig });
          dispatch({
            type: 'SET_KUBE_CONFIGS',
            configs: [...state.kubeConfigs, newConfig],
          });
          return newConfig;
        }
        return null;
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: 'Failed to load kubeconfig file: ' + err });
        return null;
      }
    },

    saveCustomKubeConfig: async (name, content) => {
      try {
        dispatch({ type: 'SET_LOADING', loading: true });
        dispatch({ type: 'SET_ERROR', error: '' });
        await SaveCustomKubeConfig(name, content);
        await loadKubeConfigs();
        return true;
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: 'Failed to save kubeconfig: ' + err });
        return false;
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    },

    savePrimaryKubeConfig: async (content) => {
      try {
        dispatch({ type: 'SET_LOADING', loading: true });
        dispatch({ type: 'SET_ERROR', error: '' });
        const path = await SavePrimaryKubeConfig(content);
        const configs = await loadKubeConfigs();
        const primary = configs.find((c) => c.path === path);
        if (primary) {
          dispatch({ type: 'SET_SELECTED_KUBE_CONFIG', config: primary });
        }
        return path;
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: 'Failed to save kubeconfig: ' + err });
        return null;
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    },

    connectKubeConfig: async (config) => {
      try {
        dispatch({ type: 'SET_LOADING', loading: true });
        dispatch({ type: 'SET_ERROR', error: '' });
        await SetKubeConfigPath(config.path);

        // Auto-select context and namespace if needed
        const currentConfig = await GetCurrentConfig();
        let contextWasSet = !!currentConfig.currentContext;

        if (!contextWasSet) {
          const contexts = await GetKubeContexts();
          if (Array.isArray(contexts) && contexts.length > 0) {
            await SetCurrentKubeContext(contexts[0]);
            contextWasSet = true;
          }
        }

        if (contextWasSet) {
          try {
            const namespaces = await GetNamespaces();
            if (Array.isArray(namespaces) && namespaces.length > 0) {
              if (!currentConfig.currentNamespace) {
                const firstNs = namespaces[0];
                await SetCurrentNamespace(firstNs);
                if (window?.go?.main?.App?.SetPreferredNamespaces) {
                  await window.go.main.App.SetPreferredNamespaces([firstNs]);
                }
              }
            }
          } catch {
            /* ignore namespace failures */
          }
        }

        return true;
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: 'Failed to connect: ' + err });
        return false;
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    },

    saveProxyConfig: async (config) => {
      try {
        dispatch({ type: 'SET_LOADING', loading: true });
        dispatch({ type: 'SET_ERROR', error: '' });
        const url = config.authType === 'system' ? '' : config.url;
        const user = config.authType === 'basic' ? config.username : '';
        const pass = config.authType === 'basic' ? config.password : '';
        await SetProxyConfig(url, config.authType, user, pass);
        dispatch({ type: 'SET_PROXY_CONFIG', config });
        return true;
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: 'Failed to save proxy config: ' + err });
        return false;
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    },

    testSwarmConnection: async (config) => {
      try {
        const result = await withTimeout(
          TestDockerConnection(
            config.host,
            config.tlsEnabled || false,
            config.tlsCert || '',
            config.tlsKey || '',
            config.tlsCA || '',
            config.tlsVerify !== false
          ),
          15_000,
          'Docker connection test timed out'
        );
        return result;
      } catch (err) {
        return { connected: false, error: err.toString() };
      }
    },

    connectSwarm: async (config) => {
      try {
        dispatch({ type: 'SET_LOADING', loading: true });
        const dockerConfig = {
          host: config.host,
          tlsEnabled: config.tlsEnabled || false,
          tlsCert: config.tlsCert || '',
          tlsKey: config.tlsKey || '',
          tlsCA: config.tlsCA || '',
          tlsVerify: config.tlsVerify !== false,
        };
        const result = await withTimeout(
          ConnectToDocker(dockerConfig),
          30_000,
          'Docker connect timed out'
        );
        return result;
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: `Failed to connect to Docker: ${err}` });
        return { connected: false, error: err.toString() };
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    },

    addSwarmConnection: (connection) => {
      dispatch({
        type: 'SET_SWARM_CONNECTIONS',
        connections: [...state.swarmConnections, connection],
      });
    },
  };

  const value = {
    ...state,
    kubeConfigCount: state.kubeConfigs.length,
    swarmConnectionCount: state.swarmConnections.length,
    pinnedCount: state.pinnedConnections.length,
    actions,
  };

  return (
    <ConnectionsStateContext.Provider value={value}>
      {children}
    </ConnectionsStateContext.Provider>
  );
}

export function useConnectionsState() {
  const ctx = useContext(ConnectionsStateContext);
  if (!ctx) {
    throw new Error('useConnectionsState must be used within ConnectionsStateProvider');
  }
  return ctx;
}

export default ConnectionsStateContext;
