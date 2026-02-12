/**
 * Custom hook for Holmes AI analysis functionality.
 * Consolidates duplicated Holmes streaming logic from ~16 OverviewTable components.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CancelHolmesStream, onHolmesChatStream, onHolmesContextProgress } from '../holmes/holmesApi';

interface HolmesToolEvent {
  id: string;
  name: string;
  status: string;
  description?: string;
}

interface HolmesContextStep {
  id: string;
  step?: string;
  status: string;
  detail: string;
}

type HolmesChatStreamPayload = {
  stream_id?: string;
  event?: string;
  error?: string;
  data?: string | null;
};

type HolmesContextProgressPayload = {
  key?: string;
  step?: string;
  status?: string;
  detail?: string;
};

type HolmesChatData = {
  reasoning?: string;
  content?: string;
  id?: string;
  tool_name?: string;
  description?: string;
  tool_call_id?: string;
  status?: string;
  result?: { status?: string };
  analysis?: string;
};

export interface HolmesAnalysisState {
  loading: boolean;
  response: { response: string } | null;
  error: string | null;
  key: string | null;
  streamId: string | null;
  streamingText: string;
  reasoningText: string;
  queryTimestamp: string | null;
  contextSteps: HolmesContextStep[];
  toolEvents: HolmesToolEvent[];
}

interface UseHolmesAnalysisOptions {
  kind: string;
  analyzeFn: (..._args: string[]) => Promise<void>;
  keyPrefix?: string;
}
interface AnalyzeResult {
  ok: boolean;
  error?: string;
}

const initialHolmesState: HolmesAnalysisState = {
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

export function useHolmesAnalysis({ kind, analyzeFn, keyPrefix }: UseHolmesAnalysisOptions) {
  const [state, setState] = useState<HolmesAnalysisState>(initialHolmesState);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const unsubscribe = onHolmesChatStream((payload: HolmesChatStreamPayload | null) => {
      if (!payload) return;
      const current = stateRef.current;
      const { streamId } = current;

      if (payload.stream_id && streamId && payload.stream_id !== streamId) {
        return;
      }

      if (payload.error) {
        if (payload.error === 'context canceled' || payload.error === 'context cancelled') {
          setState((prev) => ({ ...prev, loading: false }));
          return;
        }
        setState((prev) => ({ ...prev, loading: false, error: payload.error ?? 'Unknown error' }));
        return;
      }

      const eventType = payload.event;

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

      let data: HolmesChatData | null;
      try {
        data = JSON.parse(payload.data) as HolmesChatData;
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
        const toolId = data.id || '';
        if (!toolId) return;
        setState((prev) => ({
          ...prev,
          toolEvents: [...(prev.toolEvents || []), {
            id: toolId,
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
        const analysis = data.analysis || '';
        setState((prev) => ({
          ...prev,
          loading: false,
          response: { response: analysis },
          streamingText: analysis,
        }));
      }
    });

    return () => {
      try { unsubscribe?.(); } catch { /* ignore cleanup errors */ }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onHolmesContextProgress((event: HolmesContextProgressPayload | null) => {
      if (!event?.key) return;
      setState((prev) => {
        if (prev.key !== event.key) return prev;
        const id = event.step || 'step';
        const nextSteps = Array.isArray(prev.contextSteps) ? [...prev.contextSteps] : [];
        const idx = nextSteps.findIndex((item) => item.id === id);
        const entry: HolmesContextStep = {
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
      try { unsubscribe?.(); } catch { /* ignore cleanup errors */ }
    };
  }, []);

  const analyze = useCallback(async (...args: unknown[]): Promise<AnalyzeResult> => {
    let key: string;
    let analyzeArgs: string[];

    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      const row = args[0] as { namespace?: string; name?: string; id?: string; ID?: string };
      if (row.namespace && row.name) {
        key = `${row.namespace}/${row.name}`;
        analyzeArgs = [row.namespace, row.name];
      } else if (row.id || row.ID) {
        key = row.id || row.ID || '';
        analyzeArgs = [key];
      } else if (row.name) {
        key = row.name;
        analyzeArgs = [row.name];
      } else {
        throw new Error('Invalid row object: missing namespace/name or id');
      }
    } else if (args.length === 2 && typeof args[0] === 'string' && typeof args[1] === 'string') {
      key = `${args[0]}/${args[1]}`;
      analyzeArgs = [args[0], args[1]];
    } else if (args.length === 1 && typeof args[0] === 'string') {
      key = args[0];
      analyzeArgs = [args[0]];
    } else {
      throw new Error('Invalid arguments to analyze function');
    }

    const finalKey = keyPrefix ? `${keyPrefix}/${key}` : key;
    const streamId = `${kind.toLowerCase()}-${Date.now()}`;

    setState({
      loading: true,
      response: null,
      error: null,
      key: finalKey,
      streamId,
      streamingText: '',
      reasoningText: '',
      queryTimestamp: new Date().toISOString(),
      contextSteps: [],
      toolEvents: [],
    });

    try {
      await analyzeFn(...analyzeArgs, streamId);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, loading: false, response: null, error: message }));
      return { ok: false, error: message };
    }
  }, [kind, keyPrefix, analyzeFn]);

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

  const reset = useCallback(() => {
    setState(initialHolmesState);
  }, []);

  return { state, analyze, cancel, reset };
}

export default useHolmesAnalysis;
