import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CancelHolmesStream,
  onHolmesChatStream,
  onHolmesContextProgress,
} from './holmesApi';

const initialState = {
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

export default function useHolmesStream() {
  const [holmesState, setHolmesState] = useState(initialState);
  const holmesStateRef = useRef(holmesState);

  useEffect(() => {
    holmesStateRef.current = holmesState;
  }, [holmesState]);

  useEffect(() => {
    const unsubscribe = onHolmesChatStream((payload) => {
      if (!payload) return;
      const current = holmesStateRef.current;
      const { streamId } = current;
      if (payload.stream_id && streamId && payload.stream_id !== streamId) {
        return;
      }
      if (payload.error) {
        if (
          payload.error === 'context canceled' ||
          payload.error === 'context cancelled'
        ) {
          setHolmesState((prev) => ({ ...prev, loading: false }));
          return;
        }
        setHolmesState((prev) => ({
          ...prev,
          loading: false,
          error: payload.error,
        }));
        return;
      }

      const eventType = payload.event;
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
          setHolmesState((prev) => ({
            ...prev,
            reasoningText:
              (prev.reasoningText ? prev.reasoningText + '\n' : '') +
              data.reasoning,
          }));
          handled = true;
        }
        if (data.content) {
          setHolmesState((prev) => {
            const nextText =
              (prev.streamingText ? prev.streamingText + '\n' : '') +
              data.content;
            return {
              ...prev,
              streamingText: nextText,
              response: { response: nextText },
            };
          });
          handled = true;
        }
        if (handled) return;
      }

      if (eventType === 'start_tool_calling' && data && data.id) {
        setHolmesState((prev) => ({
          ...prev,
          toolEvents: [
            ...(prev.toolEvents || []),
            {
              id: data.id,
              name: data.tool_name || 'tool',
              status: 'running',
              description: data.description,
            },
          ],
        }));
        return;
      }

      if (eventType === 'tool_calling_result' && data && data.tool_call_id) {
        const status = data.result?.status || data.status || 'done';
        setHolmesState((prev) => ({
          ...prev,
          toolEvents: (prev.toolEvents || []).map((item) =>
            item.id === data.tool_call_id
              ? {
                  ...item,
                  status,
                  description: data.description || item.description,
                }
              : item,
          ),
        }));
        return;
      }

      if (eventType === 'ai_answer_end' && data && data.analysis) {
        setHolmesState((prev) => ({
          ...prev,
          loading: false,
          response: { response: data.analysis },
          streamingText: data.analysis,
        }));
        return;
      }

      if (eventType === 'stream_end') {
        setHolmesState((prev) => {
          if (prev.streamingText) {
            return {
              ...prev,
              loading: false,
              response: { response: prev.streamingText },
            };
          }
          return { ...prev, loading: false };
        });
      }
    });
    return () => {
      try {
        unsubscribe?.();
      } catch (_) {}
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onHolmesContextProgress((event) => {
      if (!event?.key) return;
      setHolmesState((prev) => {
        if (prev.key !== event.key) return prev;
        const id = event.step || 'step';
        const nextSteps = Array.isArray(prev.contextSteps)
          ? [...prev.contextSteps]
          : [];
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
      try {
        unsubscribe?.();
      } catch (_) {}
    };
  }, []);

  const startAnalysis = useCallback(async ({
    key,
    streamPrefix,
    run,
    onError,
  }) => {
    const streamId = `${streamPrefix}-${Date.now()}`;
    setHolmesState({
      ...initialState,
      loading: true,
      key,
      streamId,
      queryTimestamp: new Date().toISOString(),
    });
    try {
      await run(streamId);
    } catch (err) {
      const message = err?.message || String(err);
      setHolmesState((prev) => ({
        ...prev,
        loading: false,
        response: null,
        error: message,
        key,
      }));
      onError?.(message);
    }
  }, []);

  const cancelAnalysis = useCallback(async () => {
    const currentStreamId = holmesStateRef.current.streamId;
    if (!currentStreamId) return;
    setHolmesState((prev) => ({ ...prev, loading: false, streamId: null }));
    try {
      await CancelHolmesStream(currentStreamId);
    } catch (err) {
      console.error('Failed to cancel Holmes stream:', err);
    }
  }, []);

  return {
    holmesState,
    startAnalysis,
    cancelAnalysis,
  };
}
