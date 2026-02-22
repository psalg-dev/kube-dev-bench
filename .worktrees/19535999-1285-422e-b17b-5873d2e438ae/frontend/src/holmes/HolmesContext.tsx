import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { showError, showNotification, showSuccess } from '../notification';
import type { HolmesConfig, HolmesConnectionStatus, HolmesDeploymentStatus, HolmesResponse } from './holmesApi';
import {
    AskHolmesStream,
    CancelHolmesStream,
    CheckHolmesDeployment,
    ClearHolmesConfig,
    DeployHolmesGPT,
    GetHolmesConfig,
    onHolmesChatStream,
    onHolmesDeploymentStatus,
    ReconnectHolmes,
    SetHolmesConfig,
    TestHolmesConnection,
} from './holmesApi';

interface HolmesToolEvent {
  id: string;
  name: string;
  status: string;
  description?: string;
}

type HolmesChatStreamPayload = {
  stream_id?: string;
  event?: string;
  error?: string;
  data?: string | null;
};

type HolmesChatData = {
  reasoning?: string;
  content?: string;
  id?: string;
  name?: string;
  tool_name?: string;
  description?: string;
  tool_call_id?: string;
  status?: string;
  result?: { status?: string };
  analysis?: string;
  pending_approvals?: Array<{
    tool_call_id?: string;
    tool_name?: string;
    description?: string;
  }>;
};

type HolmesDeploymentRequest = {
  openAIKey: string;
  namespace?: string;
  releaseName?: string;
};

interface HolmesState {
  enabled: boolean;
  configured: boolean;
  endpoint: string;
  modelKey: string;
  responseFormat: string;
  loading: boolean;
  query: string;
  queryTimestamp: string | null;
  response: HolmesResponse | null;
  responseTimestamp: string | null;
  error: string | null;
  streamId: string | null;
  streamingText: string;
  reasoningText: string;
  canceledStreamId: string | null;
  toolEvents: HolmesToolEvent[];
  showConfig: boolean;
  showPanel: boolean;
  showOnboarding: boolean;
  deploymentStatus: HolmesDeploymentStatus | null;
  deploying: boolean;
}

type HolmesAction =
  | { type: 'SET_CONFIG'; config: HolmesConfig }
  | { type: 'SET_QUERY'; query: string; timestamp?: string | null }
  | { type: 'SET_RESPONSE'; response: HolmesResponse | null; timestamp?: string | null }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'START_STREAM'; streamId: string }
  | { type: 'STREAM_UPDATE'; text: string }
  | { type: 'STREAM_REASONING_UPDATE'; text: string }
  | { type: 'STREAM_DONE'; text: string; timestamp?: string | null }
  | { type: 'STREAM_ERROR'; error: string }
  | { type: 'CANCEL_STREAM'; streamId: string }
  | { type: 'ADD_TOOL_EVENT'; event: HolmesToolEvent }
  | { type: 'UPDATE_TOOL_EVENT'; event: HolmesToolEvent }
  | { type: 'SHOW_CONFIG' }
  | { type: 'HIDE_CONFIG' }
  | { type: 'SHOW_PANEL' }
  | { type: 'HIDE_PANEL' }
  | { type: 'TOGGLE_PANEL' }
  | { type: 'CLEAR_RESPONSE' }
  | { type: 'SHOW_ONBOARDING' }
  | { type: 'HIDE_ONBOARDING' }
  | { type: 'SET_DEPLOYMENT_STATUS'; status: HolmesDeploymentStatus | null }
  | { type: 'SET_DEPLOYING'; deploying: boolean };

const initialState: HolmesState = {
  enabled: false,
  configured: false,
  endpoint: '',
  modelKey: '',
  responseFormat: '',
  loading: false,
  query: '',
  queryTimestamp: null,
  response: null,
  responseTimestamp: null,
  error: null,
  streamId: null,
  streamingText: '',
  reasoningText: '',
  canceledStreamId: null,
  toolEvents: [],
  showConfig: false,
  showPanel: false,
  showOnboarding: false,
  deploymentStatus: null,
  deploying: false,
};

function holmesReducer(state: HolmesState, action: HolmesAction): HolmesState {
  switch (action.type) {
    case 'SET_CONFIG':
      return {
        ...state,
        enabled: action.config.enabled,
        configured: action.config.enabled && !!action.config.endpoint,
        endpoint: action.config.endpoint || '',
        modelKey: action.config.modelKey || '',
        responseFormat: action.config.responseFormat || '',
      };
    case 'SET_QUERY':
      return { ...state, query: action.query, queryTimestamp: action.timestamp || null };
    case 'SET_RESPONSE':
      return { ...state, response: action.response, responseTimestamp: action.timestamp || null, loading: false, error: null, streamingText: '', reasoningText: '' };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };
    case 'START_STREAM':
      return { ...state, loading: true, error: null, response: { response: '' }, responseTimestamp: null, streamId: action.streamId, streamingText: '', reasoningText: '', canceledStreamId: null, toolEvents: [] };
    case 'STREAM_UPDATE':
      return { ...state, response: { response: action.text }, streamingText: action.text };
    case 'STREAM_REASONING_UPDATE':
      return { ...state, reasoningText: action.text };
    case 'STREAM_DONE':
      return { ...state, loading: false, response: { response: action.text }, responseTimestamp: action.timestamp || null, streamingText: action.text };
    case 'STREAM_ERROR':
      return { ...state, error: action.error, loading: false };
    case 'CANCEL_STREAM':
      return { ...state, loading: false, streamId: null, canceledStreamId: action.streamId };
    case 'ADD_TOOL_EVENT':
      return { ...state, toolEvents: [...state.toolEvents, action.event] };
    case 'UPDATE_TOOL_EVENT':
      if (!state.toolEvents.some((item) => item.id === action.event.id)) {
        return { ...state, toolEvents: [...state.toolEvents, action.event] };
      }
      return {
        ...state,
        toolEvents: state.toolEvents.map((item) =>
          item.id === action.event.id ? { ...item, ...action.event } : item
        ),
      };
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
      return { ...state, response: null, responseTimestamp: null, error: null, query: '', queryTimestamp: null, streamId: null, streamingText: '', reasoningText: '', canceledStreamId: null, toolEvents: [] };
    case 'SHOW_ONBOARDING':
      return { ...state, showOnboarding: true };
    case 'HIDE_ONBOARDING':
      return { ...state, showOnboarding: false };
    case 'SET_DEPLOYMENT_STATUS':
      return { ...state, deploymentStatus: action.status };
    case 'SET_DEPLOYING':
      return { ...state, deploying: action.deploying };
    default:
      return state;
  }
}

interface StreamRefState {
  streamId: string | null;
  text: string;
  reasoningText: string;
  canceledStreamId: string | null;
  streamCompleted: boolean;
}

interface HolmesContextValue {
  state: HolmesState;
  askHolmes: (_question: string) => Promise<void>;
  cancelHolmes: () => Promise<void>;
  saveConfig: (_config: HolmesConfig) => Promise<void>;
  clearConfig: () => Promise<void>;
  testConnection: () => Promise<HolmesConnectionStatus>;
  reconnectHolmes: () => Promise<HolmesConnectionStatus>;
  showConfigModal: () => void;
  hideConfigModal: () => void;
  showPanel: () => void;
  hidePanel: () => void;
  togglePanel: () => void;
  clearResponse: () => void;
  loadConfig: () => Promise<void>;
  checkDeployment: () => Promise<HolmesDeploymentStatus>;
  deployHolmes: (_request: HolmesDeploymentRequest, _onStatus?: (_status: HolmesDeploymentStatus) => void) => Promise<HolmesDeploymentStatus>;
  showOnboarding: () => void;
  hideOnboarding: () => void;
}
const HolmesContext = createContext<HolmesContextValue | null>(null);

export function HolmesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(holmesReducer, initialState);
  const streamRef = useRef<StreamRefState>({ streamId: null, text: '', reasoningText: '', canceledStreamId: null, streamCompleted: false });

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

  useEffect(() => {
    streamRef.current = { streamId: state.streamId, text: state.streamingText, reasoningText: state.reasoningText, canceledStreamId: state.canceledStreamId, streamCompleted: streamRef.current.streamCompleted };
  }, [state.streamId, state.streamingText, state.reasoningText, state.canceledStreamId]);

  useEffect(() => {
    const unsubscribe = onHolmesDeploymentStatus((status: HolmesDeploymentStatus | null) => {
      dispatch({ type: 'SET_DEPLOYMENT_STATUS', status });
      if (status?.phase === 'deployed' || status?.phase === 'failed') {
        dispatch({ type: 'SET_DEPLOYING', deploying: false });
        if (status?.phase === 'deployed') {
          loadConfig();
        }
      }
    });
    return unsubscribe;
  }, [loadConfig]);

  useEffect(() => {
    const unsubscribe = onHolmesChatStream((payload: HolmesChatStreamPayload | null) => {
      if (!payload) return;
      const { streamId, text, reasoningText, canceledStreamId, streamCompleted } = streamRef.current;
      if (payload.stream_id && streamId && payload.stream_id !== streamId) {
        return;
      }
      if (payload.stream_id && canceledStreamId && payload.stream_id === canceledStreamId) {
        return;
      }
      if (payload.error) {
        if (payload.error === 'context canceled' || payload.error === 'context cancelled') {
          dispatch({ type: 'SET_LOADING', loading: false });
          return;
        }
        dispatch({ type: 'STREAM_ERROR', error: payload.error });
        showError('Holmes query failed: ' + payload.error);
        return;
      }

      const eventType = payload.event;

      if (eventType === 'stream_end') {
        if (streamCompleted) {
          dispatch({ type: 'SET_LOADING', loading: false });
          return;
        }
        if (text) {
          dispatch({ type: 'STREAM_DONE', text, timestamp: new Date().toISOString() });
        } else {
          dispatch({ type: 'SET_LOADING', loading: false });
        }
        return;
      }

      if (eventType === 'error') {
        const parseErrorPayload = (value: unknown) => {
          if (!value || typeof value !== 'string') {
            return null;
          }
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        };

        let errorMsg: string = payload.error || payload.data || 'Unknown stream error';
        const parsedError = parseErrorPayload(payload.error);
        const parsedData = parseErrorPayload(payload.data);
        const parsed = parsedError || parsedData;
        if (parsed) {
          errorMsg = parsed.error || parsed.message || parsed.detail || parsed.description || parsed.msg || errorMsg;
        }

        if (typeof errorMsg === 'string') {
          const lowerMsg = errorMsg.toLowerCase();
          if (lowerMsg.includes('authenticationerror') || lowerMsg.includes('incorrect api key') || lowerMsg.includes('invalid api key')) {
            errorMsg = 'Authentication failed. Please verify the Holmes API key.';
          }
        }

        dispatch({ type: 'STREAM_ERROR', error: errorMsg });
        showError('Holmes query failed: ' + errorMsg);
        return;
      }

      if (!payload.data) {
        return;
      }

      let data: HolmesChatData | null;
      try {
        data = JSON.parse(payload.data) as HolmesChatData;
      } catch {
        data = null;
      }

      if (eventType === 'ai_message' && data) {
        let handled = false;
        if (data.reasoning) {
          const nextReasoning = (reasoningText ? reasoningText + '\n' : '') + data.reasoning;
          dispatch({ type: 'STREAM_REASONING_UPDATE', text: nextReasoning });
          handled = true;
        }
        if (data.content) {
          const nextText = (text ? text + '\n' : '') + data.content;
          dispatch({ type: 'STREAM_UPDATE', text: nextText });
          handled = true;
        }
        if (handled) {
          return;
        }
      }

      if (eventType === 'start_tool_calling' && data && data.id) {
        dispatch({
          type: 'ADD_TOOL_EVENT',
          event: {
            id: data.id,
            name: data.tool_name || 'tool',
            status: 'running',
            description: data.description,
          },
        });
        return;
      }

      if (eventType === 'tool_calling_result' && data && data.tool_call_id) {
        const status = data.result?.status || data.status || 'done';
        dispatch({
          type: 'UPDATE_TOOL_EVENT',
          event: {
            id: data.tool_call_id,
            name: data.name || data.tool_name || 'tool',
            status,
            description: data.description,
          },
        });
        return;
      }

      if (eventType === 'approval_required' && data && Array.isArray(data.pending_approvals)) {
        data.pending_approvals.forEach((approval) => {
          if (!approval.tool_call_id) return;
          dispatch({
            type: 'UPDATE_TOOL_EVENT',
            event: {
              id: approval.tool_call_id,
              name: approval.tool_name || 'tool',
              status: 'approval_required',
              description: approval.description,
            },
          });
        });
        return;
      }

      if (eventType === 'ai_answer_end' && data && data.analysis) {
        streamRef.current.streamCompleted = true;
        dispatch({ type: 'STREAM_DONE', text: data.analysis, timestamp: new Date().toISOString() });
      }
    });
    return unsubscribe;
  }, []);

  const askHolmes = useCallback(async (question: string) => {
    if (!question || !question.trim()) {
      return;
    }
    const streamId = `${Date.now()}`;
    streamRef.current.streamCompleted = false;
    dispatch({ type: 'START_STREAM', streamId });
    dispatch({ type: 'SET_QUERY', query: question, timestamp: new Date().toISOString() });

    try {
      await AskHolmesStream(question, streamId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      dispatch({ type: 'STREAM_ERROR', error: errorMsg });
      showError('Holmes query failed: ' + errorMsg);
      throw err;
    }
  }, []);

  const cancelHolmes = useCallback(async () => {
    if (!state.streamId) {
      return;
    }
    const currentStreamId = state.streamId;
    dispatch({ type: 'CANCEL_STREAM', streamId: currentStreamId });
    try {
      await CancelHolmesStream(currentStreamId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError('Failed to cancel Holmes query: ' + errorMsg);
    }
  }, [state.streamId]);

  const saveConfig = useCallback(async (config: HolmesConfig) => {
    try {
      await SetHolmesConfig(config);
      dispatch({ type: 'SET_CONFIG', config });
      showSuccess('Holmes configuration saved');
      dispatch({ type: 'HIDE_CONFIG' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError('Failed to save Holmes config: ' + errorMsg);
      throw err;
    }
  }, []);

  const testConnection = useCallback(async (): Promise<HolmesConnectionStatus> => {
    try {
      const status = await TestHolmesConnection();
      if ((status as unknown).connected) {
        showSuccess('Holmes connection successful');
      } else {
        showError('Holmes connection failed: ' + ((status as unknown).error || 'Unknown error'));
      }
      return status;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError('Connection test failed: ' + errorMsg);
      throw err;
    }
  }, []);

  const checkDeployment = useCallback(async (): Promise<HolmesDeploymentStatus> => {
    try {
      const status = await CheckHolmesDeployment();
      dispatch({ type: 'SET_DEPLOYMENT_STATUS', status });
      return status;
    } catch (err) {
      console.error('Failed to check Holmes deployment:', err);
      throw err;
    }
  }, []);

  const deployHolmes = useCallback(async (request: HolmesDeploymentRequest, onStatusUpdate?: (_status: HolmesDeploymentStatus) => void) => {
    dispatch({ type: 'SET_DEPLOYING', deploying: true });

    try {
      const result = await DeployHolmesGPT(request);
      onStatusUpdate?.(result);

      if ((result as unknown).phase === 'deployed') {
        showSuccess('Holmes deployed successfully!');
        await loadConfig();
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError('Failed to deploy Holmes: ' + errorMsg);
      dispatch({ type: 'SET_DEPLOYING', deploying: false });
      throw err;
    }
  }, [loadConfig]);
  const reconnectHolmes = useCallback(async (): Promise<HolmesConnectionStatus> => {
    try {
      showNotification('Reconnecting to Holmes...', { type: 'warning', duration: 2000 });
      const status = await ReconnectHolmes();
      if ((status as unknown).connected) {
        showSuccess('Holmes reconnected successfully');
        await loadConfig();
      } else {
        showError('Holmes reconnection failed: ' + ((status as unknown).error || 'Unknown error'));
      }
      return status;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError('Reconnection failed: ' + errorMsg);
      throw err;
    }
  }, [loadConfig]);

  const clearConfig = useCallback(async () => {
    try {
      await ClearHolmesConfig();
      await loadConfig();
      showSuccess('Holmes configuration cleared');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError('Failed to clear Holmes config: ' + errorMsg);
      throw err;
    }
  }, [loadConfig]);

  const showConfigModal = useCallback(() => dispatch({ type: 'SHOW_CONFIG' }), []);
  const hideConfigModal = useCallback(() => dispatch({ type: 'HIDE_CONFIG' }), []);
  const showPanel = useCallback(() => dispatch({ type: 'SHOW_PANEL' }), []);
  const hidePanel = useCallback(() => dispatch({ type: 'HIDE_PANEL' }), []);
  const togglePanel = useCallback(() => dispatch({ type: 'TOGGLE_PANEL' }), []);
  const clearResponse = useCallback(() => dispatch({ type: 'CLEAR_RESPONSE' }), []);
  const showOnboarding = useCallback(() => dispatch({ type: 'SHOW_ONBOARDING' }), []);
  const hideOnboarding = useCallback(() => dispatch({ type: 'HIDE_ONBOARDING' }), []);

  const value: HolmesContextValue = {
    state,
    askHolmes,
    cancelHolmes,
    saveConfig,
    clearConfig,
    testConnection,
    reconnectHolmes,
    showConfigModal,
    hideConfigModal,
    showPanel,
    hidePanel,
    togglePanel,
    clearResponse,
    loadConfig,
    checkDeployment,
    deployHolmes,
    showOnboarding,
    hideOnboarding,
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
