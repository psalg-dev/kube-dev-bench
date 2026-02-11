import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
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
  GetHooksConfig,
  SaveHook,
  DeleteHook,
  TestHook,
  SelectHookScript,
} from '../../../wailsjs/go/main/App';
import {
  GetDockerConnectionStatus,
  TestDockerConnection,
  AutoConnectDocker as _AutoConnectDocker,
  ConnectToDocker,
  GetDefaultDockerHost,
} from '../../docker/swarmApi';

import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { showError, showSuccess, showWarning } from '../../notification';
import type { app, docker } from '../../../wailsjs/go/models';

type KubeConfigEntry = app.KubeConfigInfo;

interface SwarmConnectionEntry {
  id: string;
  name: string;
  host: string;
  connected?: boolean;
  serverVersion?: string;
  swarmActive?: boolean;
  tlsEnabled?: boolean;
  tlsCert?: string;
  tlsKey?: string;
  tlsCA?: string;
  tlsVerify?: boolean;
  [key: string]: unknown;
}

interface ProxyConfig {
  authType: 'none' | 'system' | 'basic';
  url: string;
  username: string;
  password: string;
}

type ConnectionHook = app.HookConfig;

type HookExecutionResult = app.HookExecutionResult;

type KindClusterResult = {
  name: string;
  kubeconfigPath: string;
  context: string;
  created: boolean;
};

type KindClusterWails = {
  go?: {
    main?: {
      App?: {
        CreateKindCluster?: (name: string) => Promise<KindClusterResult>;
        CancelKindCluster?: () => Promise<boolean>;
      };
    };
  };
};

interface PinnedConnection {
  type: 'kubernetes' | 'swarm';
  id: string;
  name?: string;
  path?: string;
  contexts?: string[];
  host?: string;
  tlsEnabled?: boolean;
  tlsCert?: string;
  tlsKey?: string;
  tlsCA?: string;
  tlsVerify?: boolean;
  [key: string]: unknown;
}

type SelectedSection =
  | 'kubernetes'
  | 'docker-swarm'
  | 'pinned'
  | `pinned-${PinnedConnection['type']}-${string}`;

type ConnectionEntry = (KubeConfigEntry | SwarmConnectionEntry) & { type?: PinnedConnection['type'] };

type DockerConfigInput = {
  host: string;
  tlsEnabled?: boolean;
  tlsCert?: string;
  tlsKey?: string;
  tlsCA?: string;
  tlsVerify?: boolean;
};

interface ConnectionsState {
  selectedSection: SelectedSection;
  loading: boolean;
  error: string;
  kubeConfigs: KubeConfigEntry[];
  selectedKubeConfig: KubeConfigEntry | null;
  swarmConnections: SwarmConnectionEntry[];
  swarmDetecting: boolean;
  pinnedConnections: PinnedConnection[];
  proxyConfig: ProxyConfig;
  systemProxy: Record<string, unknown>;
  hooks: ConnectionHook[];
  showAddKubeConfigOverlay: boolean;
  showAddSwarmOverlay: boolean;
  showProxySettings: boolean;
  editingConnectionProxy: ConnectionEntry | null;
  showHooksSettings: boolean;
  editingHook: ConnectionHook | null;
  editingConnectionHooks: ConnectionEntry | null;
}

type ConnectionsAction =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_SELECTED_SECTION'; section: ConnectionsState['selectedSection'] }
  | { type: 'SET_KUBE_CONFIGS'; configs: KubeConfigEntry[] }
  | { type: 'SET_SELECTED_KUBE_CONFIG'; config: KubeConfigEntry | null }
  | { type: 'SET_SWARM_CONNECTIONS'; connections: SwarmConnectionEntry[] }
  | { type: 'SET_SWARM_DETECTING'; detecting: boolean }
  | { type: 'SET_PINNED_CONNECTIONS'; connections: PinnedConnection[] }
  | { type: 'TOGGLE_PIN'; connectionType: PinnedConnection['type']; connectionId: string; connectionData: Omit<PinnedConnection, 'type' | 'id'> }
  | { type: 'SET_PROXY_CONFIG'; config: ProxyConfig }
  | { type: 'SET_SYSTEM_PROXY'; proxy: Record<string, unknown> }
  | { type: 'SET_HOOKS'; hooks: ConnectionHook[] }
  | { type: 'SHOW_ADD_KUBECONFIG_OVERLAY'; show: boolean }
  | { type: 'SHOW_ADD_SWARM_OVERLAY'; show: boolean }
  | { type: 'SHOW_PROXY_SETTINGS'; show: boolean; connection?: ConnectionEntry | null }
  | { type: 'SHOW_HOOKS_SETTINGS'; show: boolean; connection?: ConnectionEntry | null }
  | { type: 'SET_EDITING_HOOK'; hook: ConnectionHook | null };

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function getCreateKindClusterFn() {
  const win = window as unknown as KindClusterWails;
  const fn = win?.go?.main?.App?.CreateKindCluster;
  return typeof fn === 'function' ? fn : null;
}

function getCancelKindClusterFn() {
  const win = window as unknown as KindClusterWails;
  const fn = win?.go?.main?.App?.CancelKindCluster;
  return typeof fn === 'function' ? fn : null;
}

const ConnectionsStateContext = createContext<ConnectionsStateContextValue | null>(null);

const PINNED_STORAGE_KEY = 'kdb-pinned-connections';

export const initialState: ConnectionsState = {
  selectedSection: 'kubernetes',
  loading: false,
  error: '',
  kubeConfigs: [],
  selectedKubeConfig: null,
  swarmConnections: [],
  swarmDetecting: false,
  pinnedConnections: [],
  proxyConfig: {
    authType: 'none',
    url: '',
    username: '',
    password: '',
  },
  systemProxy: {},
  hooks: [],
  showAddKubeConfigOverlay: false,
  showAddSwarmOverlay: false,
  showProxySettings: false,
  editingConnectionProxy: null,
  showHooksSettings: false,
  editingHook: null,
  editingConnectionHooks: null,
};

function reducer(state: ConnectionsState, action: ConnectionsAction): ConnectionsState {
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
      }
      return {
        ...state,
        pinnedConnections: [
          ...state.pinnedConnections,
          { type: connectionType, id: connectionId, ...connectionData },
        ],
      };
    }
    case 'SET_PROXY_CONFIG':
      return { ...state, proxyConfig: action.config };
    case 'SET_SYSTEM_PROXY':
      return { ...state, systemProxy: action.proxy };
    case 'SET_HOOKS':
      return { ...state, hooks: action.hooks };
    case 'SHOW_ADD_KUBECONFIG_OVERLAY':
      return { ...state, showAddKubeConfigOverlay: action.show };
    case 'SHOW_ADD_SWARM_OVERLAY':
      return { ...state, showAddSwarmOverlay: action.show };
    case 'SHOW_PROXY_SETTINGS':
      return { ...state, showProxySettings: action.show, editingConnectionProxy: action.connection || null };
    case 'SHOW_HOOKS_SETTINGS':
      return {
        ...state,
        showHooksSettings: action.show,
        editingConnectionHooks: action.connection || null,
        editingHook: action.show ? state.editingHook : null,
      };
    case 'SET_EDITING_HOOK':
      return { ...state, editingHook: action.hook };
    default:
      return state;
  }
}

export { reducer as connectionsStateReducer };

export type {
  KubeConfigEntry,
  SwarmConnectionEntry,
  PinnedConnection,
  ConnectionHook,
  ConnectionEntry,
  SelectedSection,
  ProxyConfig,
};

function loadPinnedConnections(): PinnedConnection[] {
  try {
    const saved = localStorage.getItem(PINNED_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function savePinnedConnections(connections: PinnedConnection[]) {
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(connections));
  } catch {
    // Ignore localStorage errors
  }
}

function buildLocalConnection(host: string, status?: docker.DockerConnectionStatus): SwarmConnectionEntry {
  return {
    id: 'local',
    name: 'Local Docker',
    host,
    connected: !!status?.connected,
    serverVersion: status?.serverVersion || '',
    swarmActive: status?.swarmActive || false,
  };
}

interface ConnectionsStateProviderProps {
  children: React.ReactNode;
  initialSelectedSection?: ConnectionsState['selectedSection'];
}

interface ConnectionsActions {
  selectSection: (section: ConnectionsState['selectedSection']) => void;
  selectKubeConfig: (config: KubeConfigEntry) => void;
  togglePin: (connectionType: PinnedConnection['type'], connectionId: string, connectionData: Omit<PinnedConnection, 'type' | 'id'>) => void;
  isPinned: (connectionType: PinnedConnection['type'], connectionId: string) => boolean;
  showAddKubeConfigOverlay: (show: boolean) => void;
  showAddSwarmOverlay: (show: boolean) => void;
  showProxySettings: (show: boolean, connection?: ConnectionEntry | null) => void;
  showHooksSettings: (show: boolean, connection?: ConnectionEntry | null) => void;
  setEditingHook: (hook: ConnectionHook | null) => void;
  loadKubeConfigs: () => Promise<KubeConfigEntry[]>;
  createKindCluster: (name?: string) => Promise<KindClusterResult | null>;
  cancelKindCluster: () => Promise<boolean>;
  detectSwarmConnections: () => Promise<void>;
  loadHooks: () => Promise<ConnectionHook[]>;
  browseHookScript: () => Promise<string>;
  saveHook: (hook: ConnectionHook) => Promise<ConnectionHook | null>;
  deleteHook: (hookId: string) => Promise<boolean>;
  testHook: (hookId: string) => Promise<HookExecutionResult | null>;
  browseKubeConfigFile: () => Promise<KubeConfigEntry | null>;
  saveCustomKubeConfig: (name: string, content: string) => Promise<boolean>;
  savePrimaryKubeConfig: (content: string) => Promise<string | null>;
  connectKubeConfig: (config: KubeConfigEntry) => Promise<boolean>;
  saveProxyConfig: (config: ProxyConfig) => Promise<boolean>;
  testSwarmConnection: (config: DockerConfigInput) => Promise<docker.DockerConnectionStatus>;
  connectSwarm: (config: DockerConfigInput) => Promise<docker.DockerConnectionStatus>;
  addSwarmConnection: (connection: SwarmConnectionEntry) => void;
}

export interface ConnectionsStateContextValue extends ConnectionsState {
  kubeConfigCount: number;
  swarmConnectionCount: number;
  pinnedCount: number;
  actions: ConnectionsActions;
}

export function ConnectionsStateProvider({ children, initialSelectedSection }: ConnectionsStateProviderProps) {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    selectedSection: initialSelectedSection || initialState.selectedSection,
    pinnedConnections: loadPinnedConnections(),
  });

  useEffect(() => {
    if (initialSelectedSection) {
      dispatch({ type: 'SET_SELECTED_SECTION', section: initialSelectedSection });
    }
  }, [initialSelectedSection]);

  useEffect(() => {
    savePinnedConnections(state.pinnedConnections);
  }, [state.pinnedConnections]);

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
      dispatch({ type: 'SET_ERROR', error: 'Failed to load kubeconfig files: ' + String(err) });
      return [];
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, [state.selectedKubeConfig]);

  const detectSwarmConnections = useCallback(async () => {
    dispatch({ type: 'SET_SWARM_DETECTING', detecting: true });
    try {
      const defaultHost = await GetDefaultDockerHost();

      const status = await GetDockerConnectionStatus();
      const connections: SwarmConnectionEntry[] = [];

      connections.push(buildLocalConnection(defaultHost, status));

      dispatch({ type: 'SET_SWARM_CONNECTIONS', connections });
    } catch (err) {
      console.error('Failed to detect Docker connections:', err);
      const isWindows = navigator.platform?.toLowerCase().includes('win');
      const fallbackHost = isWindows ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
      dispatch({
        type: 'SET_SWARM_CONNECTIONS',
        connections: [buildLocalConnection(fallbackHost)],
      });
    } finally {
      dispatch({ type: 'SET_SWARM_DETECTING', detecting: false });
    }
  }, []);

  const loadProxyConfig = useCallback(async () => {
    try {
      const [proxyConfig, sysProxy] = await Promise.all([GetProxyConfig(), DetectSystemProxy()]);
      if (proxyConfig) {
        const authType = proxyConfig.authType === 'system' || proxyConfig.authType === 'basic'
          ? proxyConfig.authType
          : 'none';
        dispatch({
          type: 'SET_PROXY_CONFIG',
          config: {
            authType,
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

  const loadHooks = useCallback(async () => {
    try {
      const cfg = await GetHooksConfig();
      const hooks = Array.isArray(cfg?.hooks) ? cfg.hooks : [];
      dispatch({ type: 'SET_HOOKS', hooks });
      return hooks;
    } catch (err) {
      console.error('Failed to load hooks config:', err);
      dispatch({ type: 'SET_HOOKS', hooks: [] });
      return [];
    }
  }, []);

  useEffect(() => {
    loadKubeConfigs();
    detectSwarmConnections();
    loadProxyConfig();
    loadHooks();
  }, [loadKubeConfigs, detectSwarmConnections, loadProxyConfig, loadHooks]);

  useEffect(() => {
    const offs: Array<(() => void) | undefined> = [];
    try {
      offs.push(
        EventsOn('hook:started', (payload: { hook?: { name?: string } } | null) => {
          const hookName = payload?.hook?.name || 'Hook';
          showWarning(`Running hook: ${hookName}`, { duration: 1500, dismissible: true });
        })
      );
      offs.push(
        EventsOn('hook:completed', (payload: { hook?: { name?: string }; result?: { success?: boolean; error?: string; stderr?: string } } | null) => {
          const hookName = payload?.hook?.name || 'Hook';
          const res = payload?.result;
          if (res?.success) {
            showSuccess(`Hook completed: ${hookName}`, { duration: 2000, dismissible: true });
          } else {
            const msg = res?.error || res?.stderr || 'Hook failed';
            showWarning(`Hook failed: ${hookName}\n${msg}`, { duration: 3000, dismissible: true });
          }
        })
      );
    } catch {
      // ignore; EventsOn may not be available in some test environments
    }

    return () => {
      for (const off of offs) {
        try {
          if (typeof off === 'function') off();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const connectKubeConfig = useCallback(async (config: KubeConfigEntry) => {
    try {
      dispatch({ type: 'SET_LOADING', loading: true });
      dispatch({ type: 'SET_ERROR', error: '' });
      await SetKubeConfigPath(config.path);

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
      const msg = String(err || '');
      if (msg.includes('pre-connect hook aborted')) {
        showError('Connection aborted by hook', { duration: 3000 });
      }
      dispatch({ type: 'SET_ERROR', error: 'Failed to connect: ' + String(err) });
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, []);

  const createKindCluster = useCallback(async (name?: string) => {
    const createFn = getCreateKindClusterFn();
    if (!createFn) {
      const msg = 'KinD cluster creation is unavailable in this build';
      dispatch({ type: 'SET_ERROR', error: msg });
      showError(msg, { duration: 3000 });
      return null;
    }

    try {
      dispatch({ type: 'SET_LOADING', loading: true });
      dispatch({ type: 'SET_ERROR', error: '' });
      const result = await withTimeout(
        createFn(name || ''),
        300_000,
        'KinD cluster creation timed out'
      );
      const configs = await loadKubeConfigs();
      const match = configs.find((config) => config.path === result.kubeconfigPath);
      if (match) {
        dispatch({ type: 'SET_SELECTED_KUBE_CONFIG', config: match });
      }

      const configToConnect: KubeConfigEntry = match || {
        path: result.kubeconfigPath,
        name: result.name || result.kubeconfigPath,
        contexts: result.context ? [result.context] : [],
      };

      const connected = await connectKubeConfig(configToConnect);

      const status = result.created ? 'created' : 'already exists';
      if (connected) {
        showSuccess(`KinD cluster ${status}: ${result.name}`, { duration: 3000, dismissible: true });
      } else {
        showWarning(`KinD cluster ${status}, but connection failed`, { duration: 3000, dismissible: true });
      }
      return result;
    } catch (err) {
      const errText = String(err || '').toLowerCase();
      if (errText.includes('canceled') || errText.includes('cancelled')) {
        showWarning('KinD setup canceled', { duration: 2000, dismissible: true });
        return null;
      }
      dispatch({ type: 'SET_ERROR', error: 'Failed to create KinD cluster: ' + String(err) });
      showError('Failed to create KinD cluster', { duration: 3000 });
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, [connectKubeConfig, loadKubeConfigs]);

  const cancelKindCluster = useCallback(async () => {
    const cancelFn = getCancelKindClusterFn();
    if (!cancelFn) {
      const msg = 'KinD cancel is unavailable in this build';
      dispatch({ type: 'SET_ERROR', error: msg });
      showError(msg, { duration: 3000 });
      return false;
    }

    try {
      const canceled = await cancelFn();
      return canceled;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: 'Failed to cancel KinD setup: ' + String(err) });
      showError('Failed to cancel KinD setup', { duration: 3000 });
      return false;
    }
  }, []);

  const actions: ConnectionsActions = {
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
    showHooksSettings: (show, connection = null) =>
      dispatch({ type: 'SHOW_HOOKS_SETTINGS', show, connection }),
    setEditingHook: (hook) => dispatch({ type: 'SET_EDITING_HOOK', hook }),
    loadKubeConfigs,
    createKindCluster,
    cancelKindCluster,
    detectSwarmConnections,
    loadHooks,
    browseHookScript: async () => {
      try {
        const p = await SelectHookScript();
        return p || '';
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: 'Failed to select hook script: ' + String(err) });
        return '';
      }
    },
    saveHook: async (hook) => {
      try {
        dispatch({ type: 'SET_LOADING', loading: true });
        dispatch({ type: 'SET_ERROR', error: '' });
        const saved = await SaveHook(hook);
        await loadHooks();
        return saved;
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: 'Failed to save hook: ' + String(err) });
        return null;
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    },
    deleteHook: async (hookId) => {
      try {
        dispatch({ type: 'SET_LOADING', loading: true });
        dispatch({ type: 'SET_ERROR', error: '' });
        await DeleteHook(hookId);
        await loadHooks();
        return true;
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: 'Failed to delete hook: ' + String(err) });
        return false;
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    },
    testHook: async (hookId) => {
      try {
        dispatch({ type: 'SET_ERROR', error: '' });
        return await TestHook(hookId);
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: 'Failed to test hook: ' + String(err) });
        return null;
      }
    },
    browseKubeConfigFile: async () => {
      try {
        dispatch({ type: 'SET_ERROR', error: '' });
        const filePath = await SelectKubeConfigFile();
        if (filePath) {
          const contexts = await GetKubeContextsFromFile(filePath);
          const fileName = filePath.split(/[\\/]/).pop() || '';
          const newConfig: KubeConfigEntry = {
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
        dispatch({ type: 'SET_ERROR', error: 'Failed to load kubeconfig file: ' + String(err) });
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
        dispatch({ type: 'SET_ERROR', error: 'Failed to save kubeconfig: ' + String(err) });
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
        dispatch({ type: 'SET_ERROR', error: 'Failed to save kubeconfig: ' + String(err) });
        return null;
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    },
    connectKubeConfig,
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
        dispatch({ type: 'SET_ERROR', error: 'Failed to save proxy config: ' + String(err) });
        return false;
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    },
    testSwarmConnection: async (config) => {
      try {
        const dockerConfig: docker.DockerConfig = {
          host: config.host,
          tlsEnabled: config.tlsEnabled || false,
          tlsCert: config.tlsCert || '',
          tlsKey: config.tlsKey || '',
          tlsCA: config.tlsCA || '',
          tlsVerify: config.tlsVerify !== false,
        };
        const result = await withTimeout(
          TestDockerConnection(dockerConfig),
          15_000,
          'Docker connection test timed out'
        );
        return result;
      } catch (err) {
        return {
          connected: false,
          swarmActive: false,
          nodeId: '',
          isManager: false,
          serverVersion: '',
          error: String(err),
        } as docker.DockerConnectionStatus;
      }
    },
    connectSwarm: async (config) => {
      try {
        dispatch({ type: 'SET_LOADING', loading: true });
        const dockerConfig: docker.DockerConfig = {
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

        if (result && !result.connected && String(result.error || '').includes('pre-connect hook aborted')) {
          showError('Docker connection aborted by hook', { duration: 3000 });
        }
        return result;
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: `Failed to connect to Docker: ${String(err)}` });
        return {
          connected: false,
          swarmActive: false,
          nodeId: '',
          isManager: false,
          serverVersion: '',
          error: String(err),
        } as docker.DockerConnectionStatus;
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

  const value: ConnectionsStateContextValue = {
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
