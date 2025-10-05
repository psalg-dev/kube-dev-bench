import React, { useEffect, useRef, useState, useMemo, useLayoutEffect } from 'react';
import { GetPodYAML } from '../../../../wailsjs/go/main/App';
import { EditorView, lineNumbers, highlightActiveLineGutter, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { yaml as yamlLang } from '@codemirror/lang-yaml';
import { foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

export default function PodYamlTab({ podName }) {
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const editorParentRef = useRef(null);
  const viewRef = useRef(null);
  const mountAttemptsRef = useRef(0);

  const cmTheme = useMemo(() => EditorView.theme({
    '&': { backgroundColor: '#0d1117', color: '#c9d1d9' },
    '&.cm-editor': { height: '100%', width: '100%' },
    '.cm-content': { caretColor: '#fff', textAlign: 'left' },
    '.cm-line': { textAlign: 'left' },
    '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', lineHeight: '1.45' },
    '.cm-whitespace': { opacity: 0.35 },
    '.cm-gutters': { background: '#161b22', color: '#8b949e', borderRight: '1px solid #30363d' },
    '.cm-gutterElement': { padding: '0 8px' },
  }, { dark: true }), []);

  const cmExtensions = useMemo(() => [
    cmTheme,
    yamlLang(),
    lineNumbers(),
    highlightActiveLineGutter(),
    foldGutter(),
    keymap.of(foldKeymap),
    syntaxHighlighting(defaultHighlightStyle),
    EditorView.lineWrapping,
    EditorView.editable.of(false),
    EditorState.readOnly.of(true),
  ], [cmTheme]);

  const ensureView = () => {
    if (!editorParentRef.current) return;
    try {
      if (!viewRef.current) {
        const state = EditorState.create({ doc: yaml || '', extensions: cmExtensions });
        // Preferred mount via parent
        viewRef.current = new EditorView({ state, parent: editorParentRef.current });
      } else {
        viewRef.current.dispatch({ changes: { from: 0, to: viewRef.current.state.doc.length, insert: yaml || '' } });
      }
    } catch (e) {
      // Fallback: manual append
      try {
        const state = EditorState.create({ doc: yaml || '', extensions: cmExtensions });
        const view = new EditorView({ state });
        viewRef.current = view;
        editorParentRef.current.innerHTML = '';
        editorParentRef.current.appendChild(view.dom);
      } catch (ee) {
        // eslint-disable-next-line no-console
        console.error('Failed to mount CodeMirror for YAML:', ee);
      }
    }
  };

  const ensureViewWithRetry = () => {
    if (editorParentRef.current) {
      ensureView();
      return;
    }
    if (mountAttemptsRef.current < 10) {
      mountAttemptsRef.current += 1;
      requestAnimationFrame(ensureViewWithRetry);
    } else {
      // eslint-disable-next-line no-console
      console.warn('YAML editor container ref not ready after retries');
    }
  };

  const load = async () => {
    if (!podName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await GetPodYAML(podName);
      setYaml(res || '');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [podName]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => ensureViewWithRetry());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    ensureViewWithRetry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yaml]);

  useEffect(() => {
    return () => {
      if (viewRef.current) {
        try { viewRef.current.destroy(); } catch {}
        viewRef.current = null;
      }
    };
  }, []);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(yaml); } catch {}
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([yaml], { type: 'text/yaml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${podName}.yaml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--gh-border, #30363d)', background: 'var(--gh-bg-sidebar, #161b22)', flexShrink: 0 }}>
        <span style={{ color: 'var(--gh-text, #c9d1d9)' }}>YAML for {podName}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ padding: '6px 10px', background: 'var(--gh-input-bg, #21262d)', border: '1px solid var(--gh-border, #30363d)', color: 'var(--gh-text, #c9d1d9)', cursor: 'pointer' }}>Refresh</button>
          <button onClick={handleCopy} style={{ padding: '6px 10px', background: 'var(--gh-input-bg, #21262d)', border: '1px solid var(--gh-border, #30363d)', color: 'var(--gh-text, #c9d1d9)', cursor: 'pointer' }}>Copy</button>
          <button onClick={handleDownload} style={{ padding: '6px 10px', background: 'var(--gh-input-bg, #21262d)', border: '1px solid var(--gh-border, #30363d)', color: 'var(--gh-text, #c9d1d9)', cursor: 'pointer' }}>Download</button>
        </div>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
        <div ref={editorParentRef} style={{ flex: 1, minHeight: 0 }} />
        {loading && (
          <div style={{ position: 'absolute', top: 8, left: 10, color: 'var(--gh-text-muted, #8b949e)', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: 0, border: '1px solid var(--gh-border, #30363d)' }}>
            Loading…
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', top: 8, left: 10, color: '#f85149', background: 'rgba(248,81,73,0.1)', padding: '4px 8px', borderRadius: 0, border: '1px solid rgba(248,81,73,0.4)' }}>
            Error: {error}
          </div>
        )}
        {!viewRef.current && yaml && (
          <pre style={{ position: 'absolute', inset: 0, margin: 0, padding: 12, overflow: 'auto', whiteSpace: 'pre', background: '#0d1117', color: '#c9d1d9', textAlign: 'left' }}>{yaml}</pre>
        )}
      </div>
    </div>
  );
}
