import { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import {
  GetKubeConfigs,
  GetKubeContexts,
  GetNamespaces,
  GetCurrentConfig,
  SetCurrentKubeContext,
  SetCurrentNamespace,
  GetConnectionStatus,
  SetPreferredNamespaces,
} from '../k8s/resources/kubeApi';
import { showError, showSuccess, showWarning } from '../notification';

interface ConnectionStatus {
  proxyEnabled?: boolean;
  proxyURL?: string;
  isInsecure?: boolean;
}

interface ClusterState {
  contexts: string[];
  namespaces: string[];
  selectedContext: string;
  selectedNamespaces: string[];
  loading: boolean;
  contextDisabled: boolean;
  namespaceDisabled: boolean;
  connectionStatus: ConnectionStatus | null;
  showWizard: boolean;
  initialized: boolean;
  kubernetesAvailable: boolean;
}

type ClusterAction =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_CONTEXTS'; contexts: string[] }
  | { type: 'SET_NAMESPACES'; namespaces: string[] }
  | { type: 'SET_SELECTED_CONTEXT'; value: string }
  | { type: 'SET_SELECTED_NAMESPACES'; values: string[] }
  | { type: 'SET_CONNECTION_STATUS'; status: ConnectionStatus | null }
  | { type: 'SET_SHOW_WIZARD'; value: boolean }
  | { type: 'SET_INITIALIZED' }
  | { type: 'DISABLE_NAMESPACES' }
  | { type: 'SET_KUBERNETES_AVAILABLE'; value: boolean };

export const initialState: ClusterState = {
  contexts: [],
  namespaces: [],
  selectedContext: '',
  selectedNamespaces: [],
  loading: false,
  contextDisabled: true,
  namespaceDisabled: true,
  connectionStatus: null,
  showWizard: false,
  initialized: false,
  kubernetesAvailable: true,
};

function reducer(state: ClusterState, action: ClusterAction): ClusterState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_CONTEXTS':
      return { ...state, contexts: action.contexts, contextDisabled: false };
    case 'SET_NAMESPACES':
      return { ...state, namespaces: action.namespaces, namespaceDisabled: false };
    case 'SET_SELECTED_CONTEXT':
      return { ...state, selectedContext: action.value };
    case 'SET_SELECTED_NAMESPACES':
      return { ...state, selectedNamespaces: action.values };
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.status };
    case 'SET_SHOW_WIZARD':
      return { ...state, showWizard: action.value };
    case 'SET_INITIALIZED':
      return { ...state, initialized: true };
    case 'DISABLE_NAMESPACES':
      return { ...state, namespaceDisabled: true };
    case 'SET_KUBERNETES_AVAILABLE':
      return {
        ...state,
        kubernetesAvailable: action.value,
        ...(action.value
          ? {}
          : {
              contexts: [],
              namespaces: [],
              selectedContext: '',
              selectedNamespaces: [],
              contextDisabled: true,
              namespaceDisabled: true,
              connectionStatus: null,
              showWizard: false,
            }),
      };
    default:
      return state;
  }
}

export { reducer as clusterStateReducer };

interface ClusterStateActions {
  selectContext: (ctx: string) => Promise<void>;
  selectNamespaces: (names: string[]) => Promise<void>;
  reloadContexts: () => Promise<void>;
  reloadNamespaces: () => Promise<void>;
  openWizard: () => void;
  closeWizard: () => void;
  refreshConnectionStatus: () => Promise<void>;
}

export interface ClusterStateContextValue extends ClusterState {
  clusterConnected: boolean;
  actions: ClusterStateActions;
}

const ClusterStateContext = createContext<ClusterStateContextValue | null>(null);

export function ClusterStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const refreshConnectionStatus = useCallback(async () => {
    try {
      const status = await GetConnectionStatus();
      dispatch({ type: 'SET_CONNECTION_STATUS', status: status as ConnectionStatus });
    } catch {
      dispatch({ type: 'SET_CONNECTION_STATUS', status: null });
    }
  }, []);

  useEffect(() => {
    (async () => {
      dispatch({ type: 'SET_LOADING', loading: true });
      try {
        const kubeConfigs = await GetKubeConfigs();
        const hasKubeConfigs = Array.isArray(kubeConfigs) && kubeConfigs.length > 0;
        if (!hasKubeConfigs) {
          dispatch({ type: 'SET_KUBERNETES_AVAILABLE', value: false });
          dispatch({ type: 'SET_INITIALIZED' });
          dispatch({ type: 'SET_LOADING', loading: false });
          return;
        }
        dispatch({ type: 'SET_KUBERNETES_AVAILABLE', value: true });

        const config = await GetCurrentConfig();
        const contexts = await GetKubeContexts();
        if (!contexts || contexts.length === 0) {
          dispatch({ type: 'SET_SHOW_WIZARD', value: true });
          dispatch({ type: 'SET_LOADING', loading: false });
          return;
        }
        dispatch({ type: 'SET_CONTEXTS', contexts });
        const selectedContext = config.currentContext && contexts.includes(config.currentContext)
          ? config.currentContext
          : contexts[0];
        if (!config.currentContext || !contexts.includes(config.currentContext)) {
          showSuccess(`Auto-selected context '${selectedContext}'.`);
          try { await SetCurrentKubeContext(selectedContext); } catch {}
        }
        dispatch({ type: 'SET_SELECTED_CONTEXT', value: selectedContext });

        let namespaces: string[] = [];
        try { namespaces = await GetNamespaces(); } catch {}
        if (!namespaces || namespaces.length === 0) {
          showWarning('No namespaces found for the selected context.');
          dispatch({ type: 'SET_NAMESPACES', namespaces: [] });
          dispatch({ type: 'SET_SELECTED_NAMESPACES', values: [] });
          dispatch({ type: 'SET_INITIALIZED' });
          dispatch({ type: 'SET_LOADING', loading: false });
          return;
        }
        dispatch({ type: 'SET_NAMESPACES', namespaces });
        const pref = config.preferredNamespaces || (config as { PreferredNamespaces?: string[] }).PreferredNamespaces || [];
        let selNs = Array.isArray(pref) ? pref.filter((n: string) => namespaces.includes(n)) : [];
        if (selNs.length === 0) selNs = [namespaces[0]];
        dispatch({ type: 'SET_SELECTED_NAMESPACES', values: selNs });
        try { await SetCurrentNamespace(selNs[0]); } catch {}
        try { await SetPreferredNamespaces(selNs); } catch {}
        await refreshConnectionStatus();
      } catch (err) {
        showError('Initialization error: ' + String(err));
        dispatch({ type: 'SET_SHOW_WIZARD', value: true });
      } finally {
        dispatch({ type: 'SET_INITIALIZED' });
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    })();
  }, [refreshConnectionStatus]);

  const selectContext = useCallback(async (ctx: string) => {
    if (!ctx || ctx === state.selectedContext) return;
    dispatch({ type: 'SET_SELECTED_CONTEXT', value: ctx });
    dispatch({ type: 'DISABLE_NAMESPACES' });
    try {
      await SetCurrentKubeContext(ctx);
      const namespaces = await GetNamespaces();
      if (!namespaces || namespaces.length === 0) {
        showWarning('No namespaces found.');
        dispatch({ type: 'SET_NAMESPACES', namespaces: [] });
        dispatch({ type: 'SET_SELECTED_NAMESPACES', values: [] });
        return;
      }
      dispatch({ type: 'SET_NAMESPACES', namespaces });
      const selNs = [namespaces[0]];
      dispatch({ type: 'SET_SELECTED_NAMESPACES', values: selNs });
      try { await SetCurrentNamespace(selNs[0]); } catch {}
      try { await SetPreferredNamespaces(selNs); } catch {}
      showSuccess(`Context switched to '${ctx}'.`);
      await refreshConnectionStatus();
    } catch (err) {
      showError('Failed to switch context: ' + String(err));
    }
  }, [state.selectedContext, refreshConnectionStatus]);

  const selectNamespaces = useCallback(async (names: string[]) => {
    if (!Array.isArray(names) || names.length === 0) {
      showWarning('At least one namespace must be selected.');
      return;
    }
    dispatch({ type: 'SET_SELECTED_NAMESPACES', values: names });
    try { await SetCurrentNamespace(names[0]); showSuccess(`Namespaces saved: ${names.join(', ')}`); } catch {}
    try { await SetPreferredNamespaces(names); } catch {}
    await refreshConnectionStatus();
  }, [refreshConnectionStatus]);

  const reloadContexts = useCallback(async () => {
    try {
      const latest = await GetKubeContexts();
      if (!Array.isArray(latest) || latest.length === 0) {
        showWarning('No Kubernetes contexts found.');
        return;
      }
      dispatch({ type: 'SET_CONTEXTS', contexts: latest });
      if (!latest.includes(state.selectedContext)) {
        const next = latest[0];
        dispatch({ type: 'SET_SELECTED_CONTEXT', value: next });
        try { await SetCurrentKubeContext(next); } catch {}
        const namespaces = await GetNamespaces();
        dispatch({ type: 'SET_NAMESPACES', namespaces });
        const selNs = namespaces && namespaces.length > 0 ? [namespaces[0]] : [];
        dispatch({ type: 'SET_SELECTED_NAMESPACES', values: selNs });
        if (selNs[0]) { try { await SetCurrentNamespace(selNs[0]); } catch {} }
        showSuccess(`Auto-selected context '${next}'.`);
      }
    } catch {
      // silent
    }
  }, [state.selectedContext]);

  const reloadNamespaces = useCallback(async () => {
    if (!state.selectedContext) return;
    try {
      const latest = await GetNamespaces();
      if (!Array.isArray(latest)) return;
      dispatch({ type: 'SET_NAMESPACES', namespaces: latest });
      const still = state.selectedNamespaces.filter((ns) => latest.includes(ns));
      if (still.length === 0 && latest.length > 0) {
        dispatch({ type: 'SET_SELECTED_NAMESPACES', values: [latest[0]] });
        try { await SetCurrentNamespace(latest[0]); } catch {}
        try { await SetPreferredNamespaces([latest[0]]); } catch {}
        showSuccess(`Namespaces list updated. Auto-selected '${latest[0]}'.`);
      } else if (still.length !== state.selectedNamespaces.length) {
        dispatch({ type: 'SET_SELECTED_NAMESPACES', values: still });
        if (still[0]) { try { await SetCurrentNamespace(still[0]); } catch {} }
        try { if (still.length > 0) await SetPreferredNamespaces(still); } catch {}
      }
    } catch {
      // silent
    }
  }, [state.selectedContext, state.selectedNamespaces]);

  const value: ClusterStateContextValue = {
    ...state,
    clusterConnected: !!(state.selectedContext && state.selectedNamespaces.length > 0),
    actions: {
      selectContext,
      selectNamespaces,
      reloadContexts,
      reloadNamespaces,
      openWizard: () => dispatch({ type: 'SET_SHOW_WIZARD', value: true }),
      closeWizard: () => dispatch({ type: 'SET_SHOW_WIZARD', value: false }),
      refreshConnectionStatus,
    },
  };

  return (
    <ClusterStateContext.Provider value={value}>
      {children}
    </ClusterStateContext.Provider>
  );
}

export function useClusterState() {
  const ctx = useContext(ClusterStateContext);
  if (!ctx) throw new Error('useClusterState must be used within ClusterStateProvider');
  return ctx;
}
