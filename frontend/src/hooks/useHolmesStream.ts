import { useCallback, useEffect, useRef, useState } from 'react';
import { CancelHolmesStream, onHolmesChatStream, onHolmesContextProgress } from '../holmes/holmesApi';
import type { HolmesStreamEvent, HolmesContextProgressEvent, HolmesResponse } from '../holmes/holmesApi';

export interface HolmesContextStep {
  id: string;
  step?: string;
  status: string;
  detail: string;
}

export interface HolmesToolEvent {
  id: string;
  name: string;
  status: string;
  description?: string;
}

export interface HolmesState {
  loading: boolean;
  response: HolmesResponse | null;
  error: string | null;
  key: string | null;
  streamId: string | null;
  streamingText: string;
  reasoningText: string;
  queryTimestamp: string | null;
  contextSteps: HolmesContextStep[];
  toolEvents: HolmesToolEvent[];
}

interface HolmesChatData {
  reasoning?: string;
  content?: string;
  id?: string;
  tool_name?: string;
  description?: string;
  tool_call_id?: string;
  status?: string;
  result?: { status?: string };
  analysis?: string;
}

export interface UseHolmesStream {
  state: HolmesState;
  analyze: (key: string, run: (streamId: string) => Promise<void>) => Promise<void>;
  cancel: () => Promise<void>;
}

const initialState: HolmesState = {
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

export function useHolmesStream(): UseHolmesStream {
  const [state, setState] = useState<HolmesState>(initialState);
  const stateRef = useRef<HolmesState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Subscribe to Holmes chat stream events
  useEffect(() => {
    const unsubscribe = onHolmesChatStream((payload: HolmesStreamEvent | null) => {
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
        setState((prev) => ({
          ...prev,
          loading: false,
          error: payload.error ? String(payload.error) : null,
        }));
        return;
      }

      const eventType = payload.event;

      // stream_end doesn't require data
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
        const reasoning = typeof data.reasoning === 'string' ? data.reasoning : '';
        if (reasoning) {
          setState((prev) => ({
            ...prev,
            reasoningText: (prev.reasoningText ? prev.reasoningText + '\n' : '') + reasoning,
          }));
          handled = true;
        }
        const content = typeof data.content === 'string' ? data.content : '';
        if (content) {
          setState((prev) => {
            const nextText = (prev.streamingText ? prev.streamingText + '\n' : '') + content;
            return { ...prev, streamingText: nextText, response: { response: nextText } };
          });
          handled = true;
        }
        if (handled) return;
      }

      if (eventType === 'start_tool_calling' && data && data.id !== undefined) {
        const id = String(data.id);
        const name = typeof data.tool_name === 'string' ? data.tool_name : 'tool';
        const description = typeof data.description === 'string' ? data.description : '';
        setState((prev) => ({
          ...prev,
          toolEvents: [...(prev.toolEvents || []), {
            id,
            name,
            status: 'running',
            description,
          }],
        }));
        return;
      }

      if (eventType === 'tool_calling_result' && data && data.tool_call_id) {
        const result = data.result as Record<string, unknown> | undefined;
        const status = String(result?.status ?? data.status ?? 'done');
        const description = typeof data.description === 'string' ? data.description : undefined;
        setState((prev) => ({
          ...prev,
          toolEvents: (prev.toolEvents || []).map((item) =>
            item.id === data.tool_call_id
              ? { ...item, status, description: description ?? item.description }
              : item
          ),
        }));
        return;
      }

      if (eventType === 'ai_answer_end' && data && data.analysis) {
        const analysis = typeof data.analysis === 'string' ? data.analysis : '';
        setState((prev) => ({
          ...prev,
          loading: false,
          response: { response: analysis },
          streamingText: analysis,
        }));
        return;
      }
    });
    return () => {
      try { unsubscribe?.(); } catch {}
    };
  }, []);

  // Subscribe to Holmes context progress events
  useEffect(() => {
    const unsubscribe = onHolmesContextProgress((event: HolmesContextProgressEvent | null) => {
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
      try { unsubscribe?.(); } catch {}
    };
  }, []);

  const analyze = useCallback(
    async (key: string, run: (streamId: string) => Promise<void>): Promise<void> => {
      const streamId = `${key}-${Date.now()}`;
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
        await run(streamId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    []
  );

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

  return { state, analyze, cancel };
}
