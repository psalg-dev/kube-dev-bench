import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { EventsOn, EventsOff } from '../wailsjs/runtime';
import { StreamPodLogs, StopPodLogs, GetPodLog, StreamPodContainerLogs, GetPodContainerLog } from '../wailsjs/go/main/App';

// Performance constants
const MAX_LINES = 10000; // Maximum lines to keep in memory
const BATCH_SIZE = 100; // Lines to process in batches
const UPDATE_INTERVAL = 100; // ms between batch updates

export default function LogViewer({ podName, onClose, embedded = false, container = null }) {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const allLinesRef = useRef([]);       // all received lines (for filtering)
  const pendingLinesRef = useRef([]);   // buffer while paused or before editor ready
  const pausedRef = useRef(false);
  const batchTimeoutRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('');
  const [regexMode, setRegexMode] = useState(false);
  const [regexError, setRegexError] = useState('');
  const [lineCount, setLineCount] = useState(0);
  const [panelHeight, setPanelHeight] = useState(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('logviewer.height') : null;
    const v = saved ? parseInt(saved, 10) : 320;
    return isNaN(v) ? 320 : v;
  });
  const resizeRef = useRef({ startY: 0, startH: 0, resizing: false });

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
      } catch (err) {
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
        requestAnimationFrame(() => {
          const scroller = editorRef.current.querySelector('.cm-scroller');
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

    // Clear any pending batch processing
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
  }, [podName, container]);

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
      // eslint-disable-next-line no-console
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

  // Common filter input field with regex toggle and error display
  const filterInput = (
    <div style={{ padding: '8px', background: '#222', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: 12 }}>
      <input
        type="text"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder={regexMode ? "Regex filter" : "Filter logs"}
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

  if (embedded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {filterInput}
        <div ref={editorRef} style={{ height: '100%', width: '100%', overflow: 'auto', position: 'relative' }} />
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
    </div>
  );
}
