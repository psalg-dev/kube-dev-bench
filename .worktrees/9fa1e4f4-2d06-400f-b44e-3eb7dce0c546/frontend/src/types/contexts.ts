export interface ClusterState {
  contexts: string[];
  namespaces: string[];
  selectedContext: string;
  selectedNamespaces: string[];
  loading: boolean;
  contextDisabled: boolean;
  namespaceDisabled: boolean;
  connectionStatus: unknown;
  showWizard: boolean;
  initialized: boolean;
  kubernetesAvailable: boolean;
}

export type ClusterAction =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_CONTEXTS'; contexts: string[] }
  | { type: 'SET_NAMESPACES'; namespaces: string[] }
  | { type: 'SET_SELECTED_CONTEXT'; value: string }
  | { type: 'SET_SELECTED_NAMESPACES'; values: string[] }
  | { type: 'SET_CONNECTION_STATUS'; status: unknown }
  | { type: 'SET_SHOW_WIZARD'; value: boolean }
  | { type: 'SET_INITIALIZED' }
  | { type: 'DISABLE_NAMESPACES' }
  | { type: 'SET_KUBERNETES_AVAILABLE'; value: boolean };

export interface SwarmState {
  connected: boolean;
  swarmActive: boolean;
  nodeId: string;
  isManager: boolean;
  serverVersion: string;
  error: string;
  loading: boolean;
  showWizard: boolean;
  initialized: boolean;
  config: unknown;
  services: unknown[];
  tasks: unknown[];
  nodes: unknown[];
  networks: unknown[];
  configs: unknown[];
  secrets: unknown[];
  stacks: unknown[];
  volumes: unknown[];
}

export type SwarmAction =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_CONNECTION_STATUS'; status: unknown }
  | { type: 'SET_SHOW_WIZARD'; value: boolean }
  | { type: 'SET_INITIALIZED' }
  | { type: 'SET_CONFIG'; config: unknown }
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

export interface ConnectionsState {
  selectedSection: 'kubernetes' | 'docker-swarm' | 'pinned';
  loading: boolean;
  error: string;
  kubeConfigs: unknown[];
  selectedKubeConfig: unknown | null;
  swarmConnections: unknown[];
  swarmDetecting: boolean;
  pinnedConnections: Array<{ type: 'kubernetes' | 'swarm'; id: string; name?: string } & Record<string, unknown>>;
  proxyConfig: {
    authType: string;
    url: string;
    username: string;
    password: string;
  };
  systemProxy: Record<string, unknown>;
  hooks: unknown[];
  showAddKubeConfigOverlay: boolean;
  showAddSwarmOverlay: boolean;
  showProxySettings: boolean;
  editingConnectionProxy: unknown | null;
  showHooksSettings: boolean;
  editingHook: unknown | null;
  editingConnectionHooks: unknown | null;
}

export type ConnectionsAction =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_SELECTED_SECTION'; section: ConnectionsState['selectedSection'] }
  | { type: 'SET_KUBE_CONFIGS'; configs: unknown[] }
  | { type: 'SET_SELECTED_KUBE_CONFIG'; config: unknown | null }
  | { type: 'SET_SWARM_CONNECTIONS'; connections: unknown[] }
  | { type: 'SET_SWARM_DETECTING'; detecting: boolean }
  | { type: 'SET_PINNED_CONNECTIONS'; connections: ConnectionsState['pinnedConnections'] }
  | { type: 'TOGGLE_PIN'; connectionType: 'kubernetes' | 'swarm'; connectionId: string; connectionData?: Record<string, unknown> }
  | { type: 'SET_PROXY_CONFIG'; config: ConnectionsState['proxyConfig'] }
  | { type: 'SET_SYSTEM_PROXY'; proxy: Record<string, unknown> }
  | { type: 'SET_HOOKS'; hooks: unknown[] }
  | { type: 'SHOW_ADD_KUBECONFIG_OVERLAY'; show: boolean }
  | { type: 'SHOW_ADD_SWARM_OVERLAY'; show: boolean }
  | { type: 'SHOW_PROXY_SETTINGS'; show: boolean; connection?: unknown | null }
  | { type: 'SHOW_HOOKS_SETTINGS'; show: boolean; connection?: unknown | null }
  | { type: 'SET_EDITING_HOOK'; hook: unknown | null };
