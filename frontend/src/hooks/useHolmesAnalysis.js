/**
 * Custom hook for Holmes AI analysis functionality.
 * Consolidates duplicated Holmes streaming logic from ~16 OverviewTable components.
 * 
 * This hook handles:
 * - Holmes state management (loading, response, error, streaming text)
 * - Event subscription for chat stream and context progress
 * - Analysis triggering and cancellation
 * 
 * @example
 * const { state, analyze, cancel } = useHolmesAnalysis({
 *   kind: 'Deployment',
 *   analyzeFn: AnalyzeDeploymentStream,
 * });
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { onHolmesChatStream, onHolmesContextProgress, CancelHolmesStream } from '../holmes/holmesApi';

/**
 * Initial state for Holmes analysis
 */
const initialHolmesState = {
  loading: false,
  response: null,
  error: null,
  key: null,
  streamId: null,
  streamingText: '',
  reasoningText: '',
  queryTimestamp: null,
  contextSteps: [],
  toolEvents: [],
};

/**
 * Custom hook for Holmes AI analysis
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.kind - The resource kind (e.g., 'Deployment', 'Pod', 'Service')
 * @param {Function} options.analyzeFn - The streaming analysis function to call (e.g., AnalyzeDeploymentStream)
 * @returns {Object} - { state, analyze, cancel, reset }
 */
export function useHolmesAnalysis({ kind, analyzeFn }) {
  const [state, setState] = useState(initialHolmesState);
  const stateRef = useRef(state);

  // Keep ref in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Subscribe to Holmes chat stream events
  useEffect(() => {
    const unsubscribe = onHolmesChatStream((payload) => {
      if (!payload) return;
      const current = stateRef.current;
      const { streamId } = current;
      
      // Ignore events for other streams
      if (payload.stream_id && streamId && payload.stream_id !== streamId) {
        return;
      }
      
      // Handle errors
      if (payload.error) {
        if (payload.error === 'context canceled' || payload.error === 'context cancelled') {
          setState((prev) => ({ ...prev, loading: false }));
          return;
        }
        setState((prev) => ({ ...prev, loading: false, error: payload.error }));
        return;
      }

      const eventType = payload.event;
      
      // Handle stream_end event which may not have data
      if (eventType === 'stream_end') {
        setState((prev) => {
          if (prev.streamingText) {
            return { ...prev, loading: false, response: { response: prev.streamingText } };
          }
          return { ...prev, loading: false };
        });
        return;
      }
      
      if (!payload.data) {
        return;
      }

      let data;
      try {
        data = JSON.parse(payload.data);
      } catch {
        data = null;
      }

      if (eventType === 'ai_message' && data) {
        let handled = false;
        if (data.reasoning) {
          setState((prev) => ({
            ...prev,
            reasoningText: (prev.reasoningText ? prev.reasoningText + '\n' : '') + data.reasoning,
          }));
          handled = true;
        }
        if (data.content) {
          setState((prev) => {
            const nextText = (prev.streamingText ? prev.streamingText + '\n' : '') + data.content;
            return { ...prev, streamingText: nextText, response: { response: nextText } };
          });
          handled = true;
        }
        if (handled) return;
      }

      if (eventType === 'start_tool_calling' && data && data.id) {
        setState((prev) => ({
          ...prev,
          toolEvents: [...(prev.toolEvents || []), {
            id: data.id,
            name: data.tool_name || 'tool',
            status: 'running',
            description: data.description,
          }],
        }));
        return;
      }

      if (eventType === 'tool_calling_result' && data && data.tool_call_id) {
        const status = data.result?.status || data.status || 'done';
        setState((prev) => ({
          ...prev,
          toolEvents: (prev.toolEvents || []).map((item) =>
            item.id === data.tool_call_id
              ? { ...item, status, description: data.description || item.description }
              : item
          ),
        }));
        return;
      }

      if (eventType === 'ai_answer_end' && data && data.analysis) {
        setState((prev) => ({
          ...prev,
          loading: false,
          response: { response: data.analysis },
          streamingText: data.analysis,
        }));
        return;
      }
    });
    
    return () => {
      try { unsubscribe?.(); } catch (_) { /* ignore cleanup errors */ }
    };
  }, []);

  // Subscribe to Holmes context progress events
  useEffect(() => {
    const unsubscribe = onHolmesContextProgress((event) => {
      if (!event?.key) return;
      setState((prev) => {
        if (prev.key !== event.key) return prev;
        const id = event.step || 'step';
        const nextSteps = Array.isArray(prev.contextSteps) ? [...prev.contextSteps] : [];
        const idx = nextSteps.findIndex((item) => item.id === id);
        const entry = {
          id,
          step: event.step,
          status: event.status || 'running',
          detail: event.detail || '',
        };
        if (idx >= 0) {
          nextSteps[idx] = { ...nextSteps[idx], ...entry };
        } else {
          nextSteps.push(entry);
        }
        return { ...prev, contextSteps: nextSteps };
      });
    });
    
    return () => {
      try { unsubscribe?.(); } catch (_) { /* ignore cleanup errors */ }
    };
  }, []);

  /**
   * Trigger Holmes analysis for a resource
   * 
   * @param {...any} args - Arguments to pass to the analyze function
   *   For K8s resources: (namespace, name) or (row) where row has namespace and name
   *   For Swarm resources: (id) or (row) where row has id or ID
   */
  const analyze = useCallback(async (...args) => {
    let key;
    let analyzeArgs;
    
    // Handle different call signatures
    if (args.length === 1 && typeof args[0] === 'object') {
      // Called with a row object
      const row = args[0];
      if (row.namespace && row.name) {
        // K8s resource
        key = `${row.namespace}/${row.name}`;
        analyzeArgs = [row.namespace, row.name];
      } else if (row.id || row.ID) {
        // Swarm resource
        key = row.id || row.ID;
        analyzeArgs = [key];
      } else if (row.name) {
        // Cluster-scoped resource (e.g., PersistentVolume)
        key = row.name;
        analyzeArgs = [row.name];
      } else {
        throw new Error('Invalid row object: missing namespace/name or id');
      }
    } else if (args.length === 2 && typeof args[0] === 'string' && typeof args[1] === 'string') {
      // Called with (namespace, name)
      key = `${args[0]}/${args[1]}`;
      analyzeArgs = args;
    } else if (args.length === 1 && typeof args[0] === 'string') {
      // Called with single id (Swarm resources or cluster-scoped K8s)
      key = args[0];
      analyzeArgs = args;
    } else {
      throw new Error('Invalid arguments to analyze function');
    }

    const streamId = `${kind.toLowerCase()}-${Date.now()}`;
    
    setState({
      loading: true,
      response: null,
      error: null,
      key,
      streamId,
      streamingText: '',
      reasoningText: '',
      queryTimestamp: new Date().toISOString(),
      contextSteps: [],
      toolEvents: [],
    });
    
    try {
      await analyzeFn(...analyzeArgs, streamId);
      // The response comes via stream events, not from the return value
    } catch (err) {
      const message = err?.message || String(err);
      setState((prev) => ({ ...prev, loading: false, response: null, error: message }));
    }
  }, [kind, analyzeFn]);

  /**
   * Cancel the current Holmes analysis
   */
  const cancel = useCallback(async () => {
    const currentStreamId = stateRef.current.streamId;
    if (!currentStreamId) return;
    setState((prev) => ({ ...prev, loading: false, streamId: null }));
    try {
      await CancelHolmesStream(currentStreamId);
    } catch (err) {
      console.error('Failed to cancel Holmes stream:', err);
    }
  }, []);

  /**
   * Reset the Holmes state to initial values
   */
  const reset = useCallback(() => {
    setState(initialHolmesState);
  }, []);

  return { state, analyze, cancel, reset };
}

export default useHolmesAnalysis;
