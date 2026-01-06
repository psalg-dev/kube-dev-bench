import React, { useEffect, useMemo, useRef } from 'react';
import { EditorView, lineNumbers, highlightActiveLineGutter, keymap } from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import { foldGutter, foldKeymap } from '@codemirror/language';
import { getCodeMirrorLanguageExtensions } from '../../utils/codeMirrorLanguage.js';

export default function TextViewerTab({
  content,
  filename,
  loading = false,
  error = null,
  loadingLabel = 'Loading...'
}) {
  const editorParentRef = useRef(null);
  const viewRef = useRef(null);
  const languageCompartmentRef = useRef(new Compartment());

  const cmTheme = useMemo(() => EditorView.theme({
    '&': { backgroundColor: '#0d1117', color: '#c9d1d9' },
    '&.cm-editor': { height: '100%', width: '100%' },
    '.cm-content': { caretColor: '#fff', textAlign: 'left' },
    '.cm-line': { textAlign: 'left' },
    '.cm-scroller': {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      lineHeight: '1.45'
    },
    '.cm-whitespace': { opacity: 0.35 },
    '.cm-gutters': { background: '#161b22', color: '#8b949e', borderRight: '1px solid #30363d' },
    '.cm-gutterElement': { padding: '0 8px' },
  }, { dark: true }), []);

  const languageExtensions = useMemo(
    () => getCodeMirrorLanguageExtensions(filename, content),
    [filename, content]
  );

  const cmExtensions = useMemo(() => [
    cmTheme,
    lineNumbers(),
    highlightActiveLineGutter(),
    foldGutter(),
    keymap.of(foldKeymap),
    EditorView.lineWrapping,
    EditorView.editable.of(false),
    EditorState.readOnly.of(true),
    languageCompartmentRef.current.of(languageExtensions),
  ], [cmTheme, languageExtensions]);

  useEffect(() => {
    if (!editorParentRef.current) return;

    if (viewRef.current) return;
    try {
      const state = EditorState.create({
        doc: content || '',
        extensions: cmExtensions,
      });
      viewRef.current = new EditorView({
        state,
        parent: editorParentRef.current,
      });
    } catch (e) {
      console.error('Error creating CodeMirror editor:', e);
    }

    return () => {
      if (viewRef.current) {
        try {
          viewRef.current.destroy();
        } catch (e) {
          console.error('Error destroying CodeMirror editor:', e);
        } finally {
          viewRef.current = null;
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmExtensions]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const next = content || '';
    const current = view.state.doc.toString();
    if (current === next) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: next } });
  }, [content]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    try {
      view.dispatch({ effects: languageCompartmentRef.current.reconfigure(languageExtensions) });
    } catch (e) {
      // Best-effort; keep viewer functional even if language reconfigure fails.
    }
  }, [languageExtensions]);

  if (loading) {
    return (
      <div style={{
        padding: 20,
        textAlign: 'center',
        color: 'var(--gh-text-muted, #8b949e)',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {loadingLabel}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: 20,
        color: '#f85149',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column'
      }}>
        <div style={{ marginBottom: 8 }}>Error:</div>
        <div style={{ fontSize: 14 }}>{String(error)}</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <div ref={editorParentRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
