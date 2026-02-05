import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { EventsOn, EventsOff } from '../../../wailsjs/runtime';
import { StreamPodLogs, StopPodLogs, GetPodLog, StreamPodContainerLogs, GetPodContainerLog } from '../../../wailsjs/go/main/App';
import { AnalyzePodLogs, AskHolmesStream, CancelHolmesStream, onHolmesChatStream } from '../../holmes/holmesApi';
import HolmesResponseRenderer from '../../holmes/HolmesResponseRenderer.jsx';
import { showError } from '../../notification.js';
import '../../holmes/HolmesBottomPanel.css';
import '../../holmes/HolmesPanel.css';

// Performance constants
const MAX_LINES = 10000; // Maximum lines to keep in memory
const BATCH_SIZE = 100; // Lines to process in batches
const UPDATE_INTERVAL = 100; // ms between batch updates

export default function LogViewerTab({ podName, namespace, onClose, embedded = false, container = null }) {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const popoutRef = useRef(null);
  const popoutRootRef = useRef(null);
  const popoutScrollRef = useRef(null);
  const allLinesRef = useRef([]);       // all received lines (for filtering)
  const pendingLinesRef = useRef([]);   // buffer while paused or before editor ready
  const pausedRef = useRef(false);
  const batchTimeoutRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('');
  const [regexMode, setRegexMode] = useState(false);
  const [regexError, setRegexError] = useState('');
  const [lineCount, setLineCount] = useState(0);
  const [holmesAnalysis, setHolmesAnalysis] = useState(null);
  const [holmesError, setHolmesError] = useState('');
  const [holmesLoading, setHolmesLoading] = useState(false);
  const [holmesAnalysisTimestamp, setHolmesAnalysisTimestamp] = useState(null);
  const [followupQuestion, setFollowupQuestion] = useState('');
  const [followupConversation, setFollowupConversation] = useState([]);
  const [followupLoading, setFollowupLoading] = useState(false);
  const [followupStreamingText, setFollowupStreamingText] = useState('');
  const [followupStreamId, setFollowupStreamId] = useState(null);
  const [followupQueryTimestamp, setFollowupQueryTimestamp] = useState(null);
  const [activeTab, setActiveTab] = useState('history');
  const analysisRequestIdRef = useRef(0);
  const followupStreamRef = useRef({ streamId: null, text: '', canceledStreamId: null });
  const followupScrollRef = useRef(null);
  const [panelHeight, setPanelHeight] = useState(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('logviewer.height') : null;
    const v = saved ? parseInt(saved, 10) : 320;
    return isNaN(v) ? 320 : v;
  });
  const resizeRef = useRef({ startY: 0, startH: 0, resizing: false });

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getAnalysisText = (analysis) => {
    if (!analysis) return '';
    return [
      analysis.response,
      analysis.Response,
      analysis.analysis,
      analysis.Analysis,
    ].find((value) => typeof value === 'string' && value.trim().length > 0) || '';
  };

  const conversationItems = useMemo(() => {
    const items = [];
    if (holmesAnalysis) {
      items.push({ type: 'response', data: holmesAnalysis, timestamp: holmesAnalysisTimestamp });
    }
    return items.concat(followupConversation);
  }, [holmesAnalysis, holmesAnalysisTimestamp, followupConversation]);

  const resetFollowup = useCallback(() => {
    setFollowupQuestion('');
    setFollowupConversation([]);
    setFollowupLoading(false);
    setFollowupStreamingText('');
    setFollowupStreamId(null);
    setFollowupQueryTimestamp(null);
    followupStreamRef.current = { streamId: null, text: '', canceledStreamId: null };
  }, []);

  // keep pausedRef in sync
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const darkTheme = useMemo(() => EditorView.theme({
    '&': { backgroundColor: '#181c20', color: '#e0e0e0' },
    '.cm-content': { caretColor: '#fff', textAlign: 'left' },
    '.cm-line': { textAlign: 'left' },
    '&.cm-editor': { height: '100%' },
    '.cm-scroller': { fontFamily: 'monospace', lineHeight: '1.35' }
  }, { dark: true }), []);

  const extensions = useMemo(
    () => [
      darkTheme,
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
      EditorView.lineWrapping,
      // Enable virtual scrolling for better performance
      EditorView.theme({
        '.cm-scroller': {
          // Optimize scrolling performance
          'scroll-behavior': 'auto',
        }
      }),
      // Optimize for large documents
      EditorState.allowMultipleSelections.of(false),
    ],
    [darkTheme]
  );

  // Optimized line matching with early exit
  const lineMatches = useCallback((line) => {
    const q = filter.trim();
    if (!q) return true;
    if (regexMode) {
      try {
        setRegexError('');
        const re = new RegExp(q, 'i');
        return re.test(line);
      } catch (_err) {
        setRegexError('Invalid regex');
        return true; // Show all lines if regex is invalid
      }
    } else {
      setRegexError('');
      return line.toLowerCase().includes(q.toLowerCase());
    }
  }, [filter, regexMode]);

  // Memory management: trim old lines when exceeding limit
  const trimLines = useCallback(() => {
    if (allLinesRef.current.length > MAX_LINES) {
      const excess = allLinesRef.current.length - MAX_LINES;
      allLinesRef.current.splice(0, excess);
      setLineCount(allLinesRef.current.length);
      return true;
    }
    return false;
  }, []);

  // Batched update function for better performance
  const processBatch = useCallback(() => {
    if (!viewRef.current || pendingLinesRef.current.length === 0) return;

    const batch = pendingLinesRef.current.splice(0, BATCH_SIZE);
    allLinesRef.current.push(...batch);

    // Trim if necessary
    const wasTrimmed = trimLines();

    // Only update the editor if not paused
    if (!pausedRef.current) {
      // If we trimmed, rebuild the entire document for consistency
      if (wasTrimmed) {
        const filtered = allLinesRef.current.filter(lineMatches);
        const doc = filtered.length ? filtered.join('\n') + '\n' : '';
        const cmView = viewRef.current;
        cmView.dispatch({ changes: { from: 0, to: cmView.state.doc.length, insert: doc } });
      } else {
        // Otherwise, just append the new filtered lines
        const filtered = batch.filter(lineMatches);
        if (filtered.length) {
          const insert = filtered.join('\n') + '\n';
          const cmView = viewRef.current;
          cmView.dispatch({ changes: { from: cmView.state.doc.length, insert } });
        }
      }

      // Auto-scroll when not paused
      if (editorRef.current) {
        const editorEl = editorRef.current;
        requestAnimationFrame(() => {
          if (!editorEl) return;
          const scroller = editorEl.querySelector('.cm-scroller');
          if (scroller) scroller.scrollTop = scroller.scrollHeight;
        });
      }
    }

    setLineCount(allLinesRef.current.length);

    // Continue processing if there are more pending lines
    if (pendingLinesRef.current.length > 0) {
      batchTimeoutRef.current = setTimeout(processBatch, UPDATE_INTERVAL);
    } else {
      batchTimeoutRef.current = null;
    }
  }, [lineMatches, trimLines]);

  // Optimized flush pending with batching
  const flushPending = useCallback(() => {
    if (!viewRef.current || pendingLinesRef.current.length === 0) return;

    // Clear any existing batch timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }

    // Start batch processing
    processBatch();
  }, [processBatch]);

  // Subscribe to backend events for the current pod (no stream control here)
  useEffect(() => {
    if (!podName) return;
    const eventName = `podlogs:${podName}`;
    const listener = (line) => {
      pendingLinesRef.current.push(line);

      // Start batch processing if not already running
      // Note: We process batches even when paused to keep the buffer managed
      if (viewRef.current && !batchTimeoutRef.current) {
        batchTimeoutRef.current = setTimeout(processBatch, UPDATE_INTERVAL);
      }
    };
    EventsOn(eventName, listener);
    return () => {
      EventsOff(eventName);
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }
    };
  }, [podName, processBatch]);

  // Subscribe to Holmes chat stream events for follow-up questions
  useEffect(() => {
    const unsubscribe = onHolmesChatStream((payload) => {
      if (!payload) return;
      const { streamId, canceledStreamId } = followupStreamRef.current;
      if (!streamId) return;
      if (payload.stream_id && streamId && payload.stream_id !== streamId) {
        return;
      }
      if (payload.stream_id && canceledStreamId && payload.stream_id === canceledStreamId) {
        return;
      }
      if (payload.error) {
        if (payload.error === 'context canceled' || payload.error === 'context cancelled') {
          setFollowupLoading(false);
          return;
        }
        const message = payload.error;
        setFollowupLoading(false);
        setFollowupConversation((prev) => ([
          ...prev,
          { type: 'error', text: message, timestamp: new Date().toISOString() },
        ]));
        showError('Holmes query failed: ' + message);
        return;
      }

      const eventType = payload.event;

      if (eventType === 'stream_end') {
        const finalText = followupStreamRef.current.text;
        if (finalText) {
          setFollowupConversation((prev) => ([
            ...prev,
            { type: 'response', data: { response: finalText }, timestamp: new Date().toISOString() },
          ]));
        }
        followupStreamRef.current.text = '';
        setFollowupStreamingText('');
        setFollowupLoading(false);
        setFollowupStreamId(null);
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
        if (data.content) {
          const baseText = followupStreamRef.current.text;
          const nextText = (baseText ? baseText + '\n' : '') + data.content;
          followupStreamRef.current.text = nextText;
          setFollowupStreamingText(nextText);
        }
        return;
      }

      if (eventType === 'ai_answer_end' && data) {
        const finalText = data.analysis || data.response || '';
        if (finalText) {
          followupStreamRef.current.text = finalText;
          setFollowupStreamingText('');
          setFollowupConversation((prev) => ([
            ...prev,
            { type: 'response', data: { response: finalText }, timestamp: new Date().toISOString() },
          ]));
        }
        setFollowupLoading(false);
        setFollowupStreamId(null);
        return;
      }
    });
    return unsubscribe;
  }, []);

  // Control backend stream lifecycle based on paused, podName and container
  useEffect(() => {
    if (!podName) return;
    if (paused) {
      StopPodLogs(podName);
    } else {
      if (container) {
        StreamPodContainerLogs(podName, container);
      } else {
        StreamPodLogs(podName);
      }
    }
    return () => {
      StopPodLogs(podName);
    };
  }, [podName, paused, container]);

  // Clear editor and buffers when pod or container changes
  useEffect(() => {
    if (!viewRef.current) return;
    const cmView = viewRef.current;
    cmView.dispatch({ changes: { from: 0, to: cmView.state.doc.length, insert: '' } });
    allLinesRef.current = [];
    pendingLinesRef.current = [];
    setLineCount(0);
    setHolmesAnalysis(null);
    setHolmesError('');
    setHolmesLoading(false);
    resetFollowup();
    analysisRequestIdRef.current += 1;
    setActiveTab('history');

    // Clear any pending batch processing
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
  }, [podName, container, resetFollowup]);

  // When paused switched to false, flush buffered lines (respecting filter)
  useEffect(() => {
    if (!paused) flushPending();
  }, [paused, flushPending]);

  // Optimized re-render when filter changes with debouncing
  useEffect(() => {
    if (!viewRef.current) return;

    // Use requestAnimationFrame to debounce filter updates
    const timeoutId = setTimeout(() => {
      const cmView = viewRef.current;
      if (!cmView) return;

      const filtered = allLinesRef.current.filter(lineMatches);
      const doc = filtered.length ? filtered.join('\n') + '\n' : '';
      cmView.dispatch({ changes: { from: 0, to: cmView.state.doc.length, insert: doc } });

      if (!pausedRef.current && editorRef.current) {
        requestAnimationFrame(() => {
          const scroller = editorRef.current.querySelector('.cm-scroller');
          if (scroller) scroller.scrollTop = scroller.scrollHeight;
        });
      }
    }, 150); // 150ms debounce

    return () => clearTimeout(timeoutId);
  }, [filter, lineMatches]);

  // Initialize CodeMirror only once
  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;
    try {
      viewRef.current = new EditorView({
        state: EditorState.create({
          doc: '',
          extensions: extensions
        }),
        parent: editorRef.current
      });
      // After creating editor, flush any buffered lines
      flushPending();
    } catch (err) {

      console.error('Error creating EditorView:', err);
    }
    return () => {
      if (viewRef.current) {
        try { viewRef.current.destroy(); } catch {}
        viewRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensions]);

  // Re-attach or recreate editor when switching back to history tab
  useEffect(() => {
    if (activeTab !== 'history') return;
    if (!editorRef.current) return;

    const attachView = () => {
      const view = viewRef.current;
      if (!view) return;
      if (view.dom.parentElement !== editorRef.current) {
        if (typeof view.setParent === 'function') {
          try { view.setParent(editorRef.current); } catch {}
        } else {
          try { editorRef.current.appendChild(view.dom); } catch {}
        }
      }
      requestAnimationFrame(() => {
        const scroller = editorRef.current?.querySelector('.cm-scroller');
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
      });
    };

    if (!viewRef.current) {
      try {
        const filtered = allLinesRef.current.filter(lineMatches);
        const doc = filtered.length ? filtered.join('\n') + '\n' : '';
        viewRef.current = new EditorView({
          state: EditorState.create({
            doc,
            extensions: extensions
          }),
          parent: editorRef.current
        });
      } catch (err) {

        console.error('Error re-creating EditorView:', err);
      }
    }

    attachView();
  }, [activeTab, extensions, lineMatches]);

  // Clear button handler with performance optimization
  const handleClear = () => {
    allLinesRef.current = [];
    pendingLinesRef.current = [];
    setLineCount(0);

    // Clear any pending batch processing
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }

    if (viewRef.current) {
      const cmView = viewRef.current;
      cmView.dispatch({ changes: { from: 0, to: cmView.state.doc.length, insert: '' } });
    }
  };

  const handleDownload = async () => {
    try {
      if (!podName) return;
      let content;
      if (container) content = await GetPodContainerLog(podName, container);
      else content = await GetPodLog(podName);
      const blob = new Blob([content ?? ''], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().replace(/[:.]/g, '-');
      const safeContainer = container ? `-${container}` : '';
      a.href = url;
      a.download = `pod-${podName}${safeContainer}-logs-${date}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download full pod log:', e);
      try { alert('Failed to download full pod log. See console for details.'); } catch {}
    }
  };

  const handleExplainLogs = async () => {
    if (!podName) return;
    const requestId = ++analysisRequestIdRef.current;
    setHolmesLoading(true);
    setHolmesError('');
    setHolmesAnalysis(null);
    setHolmesAnalysisTimestamp(null);
    resetFollowup();
    setActiveTab('analysis');
    try {
      const response = await AnalyzePodLogs(namespace || '', podName, 200);
      if (analysisRequestIdRef.current !== requestId) return;
      setHolmesAnalysis(response);
      setHolmesAnalysisTimestamp(new Date().toISOString());
    } catch (err) {
      if (analysisRequestIdRef.current !== requestId) return;
      const message = err?.message || String(err);
      setHolmesError(message);
      showError(`Failed to analyze logs: ${message}`);
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      if (analysisRequestIdRef.current !== requestId) return;
      setHolmesLoading(false);
    }
  };

  const handleFollowupSubmit = async (e) => {
    e.preventDefault();
    if (!followupQuestion.trim() || followupLoading || !holmesAnalysis) return;

    const questionText = followupQuestion.trim();
    const streamId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setFollowupQuestion('');
    setFollowupLoading(true);
    setFollowupStreamingText('');
    setFollowupStreamId(streamId);
    setFollowupQueryTimestamp(new Date().toISOString());
    setFollowupConversation((prev) => ([
      ...prev,
      { type: 'question', text: questionText, timestamp: new Date().toISOString() },
    ]));

    followupStreamRef.current = { streamId, text: '', canceledStreamId: null };

    const analysisText = getAnalysisText(holmesAnalysis);
    const podLabel = `${namespace || 'default'}/${podName}${container ? ` (container: ${container})` : ''}`;
    const prompt = [
      `We previously analyzed logs for pod ${podLabel}.`,
      analysisText ? `\nAnalysis:\n${analysisText}` : '',
      `\nFollow-up question:\n${questionText}`,
    ].join('\n');

    try {
      await AskHolmesStream(prompt, streamId);
    } catch (err) {
      const message = err?.message || String(err);
      setFollowupLoading(false);
      setFollowupStreamId(null);
      setFollowupConversation((prev) => ([
        ...prev,
        { type: 'error', text: message, timestamp: new Date().toISOString() },
      ]));
      showError('Holmes query failed: ' + message);
    }
  };

  const handleFollowupKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleFollowupSubmit(e);
    }
  };

  const handleCancelFollowup = async () => {
    if (!followupStreamId) return;
    const cancelId = followupStreamId;
    followupStreamRef.current = { ...followupStreamRef.current, canceledStreamId: cancelId, streamId: null };
    setFollowupStreamId(null);
    setFollowupLoading(false);
    setFollowupStreamingText('');
    try {
      await CancelHolmesStream(cancelId);
    } catch (err) {
      const message = err?.message || String(err);
      setFollowupConversation((prev) => ([
        ...prev,
        { type: 'error', text: message, timestamp: new Date().toISOString() },
      ]));
    }
  };

  useEffect(() => {
    if (followupScrollRef.current) {
      followupScrollRef.current.scrollTop = followupScrollRef.current.scrollHeight;
    }
    if (popoutScrollRef.current) {
      popoutScrollRef.current.scrollTop = popoutScrollRef.current.scrollHeight;
    }
  }, [followupConversation, followupLoading, followupStreamingText]);

  const handleCancelAnalysis = () => {
    analysisRequestIdRef.current += 1;
    setHolmesLoading(false);
    setHolmesError('Analysis canceled.');
  };

  const renderAnalysisPanel = (options = {}) => {
    const { includePopoutButton = true, scrollRef = followupScrollRef } = options;
    return (
      <div style={{ background: '#1c2026', borderBottom: '1px solid #333', padding: '8px 12px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#c9d1d9' }}>Holmes Analysis</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleExplainLogs}
              disabled={!podName || holmesLoading}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid #353a42',
                background: '#2d323b',
                color: '#e0e0e0',
                cursor: (!podName || holmesLoading) ? 'not-allowed' : 'pointer',
                opacity: (!podName || holmesLoading) ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {holmesLoading ? 'Analyzing…' : 'Explain Logs'}
            </button>
            {holmesLoading && (
              <button
                type="button"
                className="holmes-bottom-panel-stop-btn"
                onClick={handleCancelAnalysis}
                title="Stop analysis"
                aria-label="Stop analysis"
              >
                <span className="holmes-bottom-panel-stop-icon" />
              </button>
            )}
            {includePopoutButton && (
              <button
                onClick={handlePopoutAnalysis}
                disabled={!holmesAnalysis || holmesLoading}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid #353a42',
                  background: '#2d323b',
                  color: '#e0e0e0',
                  cursor: (!holmesAnalysis || holmesLoading) ? 'not-allowed' : 'pointer',
                  opacity: (!holmesAnalysis || holmesLoading) ? 0.6 : 1,
                }}
              >
                Pop out
              </button>
            )}
          </div>
        </div>

        <div
          data-testid="holmes-log-analysis"
          style={{
            marginTop: 8,
            color: '#c9d1d9',
            paddingRight: 6,
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!holmesLoading && holmesError && (
              <div style={{ fontSize: 12, color: '#ff7b72' }}>{holmesError}</div>
            )}
            {!holmesLoading && !holmesError && !holmesAnalysis && (
              <div style={{ fontSize: 12, color: '#8b949e' }}>No analysis yet.</div>
            )}
            {(holmesAnalysis || followupConversation.length > 0 || followupLoading || followupStreamingText || holmesLoading) && (
              <div
                ref={scrollRef}
                className="holmes-content"
                style={{
                  padding: 10,
                  background: '#0d1117',
                  borderRadius: 6,
                  border: '1px solid #30363d',
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                }}
              >
                <div className="holmes-message-list">
                  {conversationItems.map((item, idx) => (
                    <div
                      key={`${item.type}-${item.timestamp || idx}`}
                      className={`holmes-message ${item.type === 'question' ? 'holmes-message-user' : item.type === 'response' ? 'holmes-message-assistant' : 'holmes-message-error'}`}
                    >
                      <div className="holmes-message-header">
                        <span>{item.type === 'question' ? 'You' : item.type === 'response' ? 'Holmes' : 'Error'}</span>
                        <span className="holmes-message-timestamp">{formatTimestamp(item.timestamp)}</span>
                      </div>
                      <div className="holmes-message-body">
                        {item.type === 'question' && <div>{item.text}</div>}
                        {item.type === 'response' && <HolmesResponseRenderer response={item.data} />}
                        {item.type === 'error' && <div>{item.text}</div>}
                      </div>
                    </div>
                  ))}

                  {holmesLoading && !holmesAnalysis && (
                    <div className="holmes-message holmes-message-assistant">
                      <div className="holmes-message-header">
                        <span>Holmes</span>
                        <span className="holmes-message-timestamp">{formatTimestamp(holmesAnalysisTimestamp)}</span>
                      </div>
                      <div className="holmes-message-body">
                        <div className="holmes-loading">
                          <div className="holmes-spinner" />
                          <span>Analyzing logs...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {followupLoading && (
                    <div className="holmes-message holmes-message-assistant">
                      <div className="holmes-message-header">
                        <span>Holmes</span>
                        <span className="holmes-message-timestamp">{formatTimestamp(followupQueryTimestamp)}</span>
                      </div>
                      <div className="holmes-message-body">
                        <div className="holmes-loading">
                          <div className="holmes-spinner" />
                          <span>{followupStreamingText ? 'Streaming...' : 'Thinking...'}</span>
                          <button
                            type="button"
                            className="holmes-btn holmes-btn-secondary holmes-cancel-btn"
                            onClick={handleCancelFollowup}
                          >
                            Cancel
                          </button>
                        </div>
                        {followupStreamingText && (
                          <div className="holmes-streaming-text">
                            {followupStreamingText}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {holmesAnalysis && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <form className="holmes-composer" onSubmit={handleFollowupSubmit}>
                <div className="holmes-composer-input-wrapper">
                  <textarea
                    className="holmes-composer-input"
                    placeholder="Ask a follow-up about this analysis..."
                    value={followupQuestion}
                    onChange={(e) => setFollowupQuestion(e.target.value)}
                    onKeyDown={handleFollowupKeyDown}
                    disabled={followupLoading}
                    rows={2}
                  />
                  <button
                    type="submit"
                    className="holmes-btn holmes-btn-submit"
                    disabled={followupLoading || !followupQuestion.trim()}
                    title="Ask Holmes"
                  >
                    {followupLoading ? '...' : '→'}
                  </button>
                </div>
                <div className="holmes-composer-hint">Ctrl+Enter to send, Shift+Enter for a new line.</div>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPopout = () => {
    if (!popoutRootRef.current) return;
    const titleSuffix = podName ? `: ${podName}${container ? ` (${container})` : ''}` : '';
    popoutRootRef.current.render(
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Holmes Log Analysis{titleSuffix}
        </div>
        {renderAnalysisPanel({ includePopoutButton: false, scrollRef: popoutScrollRef })}
      </div>
    );
  };

  const handlePopoutAnalysis = () => {
    if (!holmesAnalysis) {
      showError('No analysis to pop out yet.');
      return;
    }

    if (popoutRef.current && !popoutRef.current.closed) {
      popoutRef.current.focus();
      renderPopout();
      return;
    }

    const titleSuffix = podName ? `: ${podName}${container ? ` (${container})` : ''}` : '';
    const popout = window.open('', `holmes-log-analysis-${Date.now()}`, 'width=980,height=720');
    if (!popout) {
      showError('Pop-out blocked by the browser.');
      return;
    }

    popoutRef.current = popout;

    const doc = popout.document;
    doc.title = `Holmes Log Analysis${titleSuffix}`;
    doc.body.style.margin = '0';
    doc.body.style.background = '#0d1117';
    doc.body.style.color = '#c9d1d9';
    doc.body.style.fontFamily = 'Inter, system-ui, -apple-system, Segoe UI, sans-serif';

    document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
      doc.head.appendChild(node.cloneNode(true));
    });

    const containerEl = doc.createElement('div');
    containerEl.style.padding = '16px';
    doc.body.appendChild(containerEl);

    popoutRootRef.current = createRoot(containerEl);
    renderPopout();

    popout.addEventListener('beforeunload', () => {
      popoutRootRef.current?.unmount();
      popoutRootRef.current = null;
      popoutRef.current = null;
    });
  };

  useEffect(() => {
    if (popoutRef.current && !popoutRef.current.closed) {
      renderPopout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    holmesAnalysis,
    holmesLoading,
    holmesError,
    followupConversation,
    followupLoading,
    followupStreamingText,
    followupQuestion,
    followupQueryTimestamp,
    podName,
    container,
  ]);

  useEffect(() => {
    try { window.localStorage.setItem('logviewer.height', String(panelHeight)); } catch {}
  }, [panelHeight]);

  const onResizeStart = (e) => {
    if (embedded) return; // no-op when embedded
    e.preventDefault();
    const startY = e.clientY;
    resizeRef.current = { startY, startH: panelHeight, resizing: true };
    const onMove = (ev) => {
      if (!resizeRef.current.resizing) return;
      const dy = resizeRef.current.startY - ev.clientY; // moving up increases height
      const next = Math.max(160, Math.min(resizeRef.current.startH + dy, Math.floor(window.innerHeight * 0.9)));
      setPanelHeight(next);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    };
    const onUp = () => {
      resizeRef.current.resizing = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const tabsRow = (
    <div style={{ display: 'flex', gap: 6, padding: '8px 12px', background: '#1f232a', borderBottom: '1px solid #333' }}>
      {[
        { key: 'history', label: 'History' },
        { key: 'analysis', label: 'Analysis' },
      ].map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #353a42',
            background: activeTab === tab.key ? '#2d323b' : 'transparent',
            color: '#e0e0e0',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  // Common filter input field with regex toggle and error display
  const filterInput = (
    <div style={{ padding: '8px', background: '#222', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: 12 }}>
      <input
        type="text"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder={regexMode ? 'Regex filter' : 'Filter logs'}
        style={{ flex: 1, padding: '6px 8px', fontSize: 14, background: '#181c20', color: '#e0e0e0', border: '1px solid #444', borderRadius: 4 }}
      />
      <label style={{ color: '#e0e0e0', fontSize: 13 }}>
        <input
          type="checkbox"
          checked={regexMode}
          onChange={e => setRegexMode(e.target.checked)}
          style={{ marginRight: 4 }}
        />
        Regex
      </label>
      {regexError && <span style={{ color: '#ff6b6b', fontSize: 13 }}>{regexError}</span>}
      <span style={{ color: '#888', fontSize: 12 }}>
        {lineCount > 0 && `${lineCount.toLocaleString()} lines`}
        {lineCount >= MAX_LINES && ' (max)'}
      </span>
    </div>
  );

  const analysisPanel = renderAnalysisPanel({ includePopoutButton: true, scrollRef: followupScrollRef });

  if (embedded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {tabsRow}
        {activeTab === 'history' && (
          <>
            {filterInput}
            <div ref={editorRef} style={{ height: '100%', width: '100%', overflow: 'auto', position: 'relative' }} />
          </>
        )}
        {activeTab === 'analysis' && analysisPanel}
      </div>
    );
  }

  return (
    <div style={{
      background: '#181c20',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      fontSize: 15,
      borderTop: '2px solid #353a42',
      boxShadow: '0 -2px 8px rgba(0,0,0,0.18)',
      width: '100%',
      height: panelHeight,
      position: 'fixed',
      left: 0,
      bottom: 0,
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      transition: resizeRef.current.resizing ? 'none' : 'height 0.12s',
    }}>
      <div
        onMouseDown={onResizeStart}
        title="Drag to resize"
        style={{
          height: 6,
          cursor: 'ns-resize',
          background: 'transparent',
          borderTop: '2px solid #353a42',
          borderBottom: '1px solid #353a42',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#23272e', padding: '8px 16px', borderBottom: '1px solid #353a42' }}>
        <span>Logs: {podName}{container ? ` (${container})` : ''}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { if (podName) StopPodLogs(podName); onClose && onClose(); }} style={{ background: 'transparent', border: 'none', color: '#e0e0e0', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
      </div>
      {tabsRow}
      {activeTab === 'history' && (
        <>
          {filterInput}
          <div style={{ flex: 1, position: 'relative' }}>
            <div ref={editorRef} style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }} />
            {/* Floating controls bottom-right */}
            <div style={{ position: 'absolute', right: 25, bottom: 12, display: 'flex', gap: 10, zIndex: 101 }}>
              <button
                onClick={handleDownload}
                title="Download full log"
                aria-label="Download full log"
                style={{ width: 36, height: 36, borderRadius: 18, border: '1px solid #353a42', background: '#2d323b', color: '#e0e0e0', cursor: 'pointer' }}
              >
                💾
              </button>
              <button
                onClick={handleClear}
                title="Clear log"
                aria-label="Clear log"
                style={{ width: 36, height: 36, borderRadius: 18, border: '1px solid #353a42', background: '#2d323b', color: '#e0e0e0', cursor: 'pointer' }}
              >
                ✕
              </button>
              <button
                onClick={() => setPaused(p => !p)}
                title={paused ? 'Resume auto-update' : 'Pause auto-update'}
                aria-pressed={paused}
                aria-label={paused ? 'Resume auto-update' : 'Pause auto-update'}
                style={{ width: 36, height: 36, borderRadius: 18, border: '1px solid #353a42', background: '#2d323b', color: '#e0e0e0', cursor: 'pointer' }}
              >
                {paused ? '▶' : '⏸'}
              </button>
            </div>
          </div>
        </>
      )}
      {activeTab === 'analysis' && analysisPanel}
    </div>
  );
}
