import React, { useEffect, useMemo, useRef } from 'react';
import { EditorView, lineNumbers, highlightActiveLineGutter, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { foldGutter, foldKeymap } from '@codemirror/language';

export default function TextViewerTab({ content, loading = false, error = null, loadingLabel = 'Loading...' }) {
  const editorParentRef = useRef(null);
  const viewRef = useRef(null);

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

  const cmExtensions = useMemo(() => [
    cmTheme,
    lineNumbers(),
    highlightActiveLineGutter(),
    foldGutter(),
    keymap.of(foldKeymap),
    EditorView.lineWrapping,
    EditorView.editable.of(false),
    EditorState.readOnly.of(true),
  ], [cmTheme]);

  useEffect(() => {
    if (!editorParentRef.current) return;

    try {
      if (!viewRef.current) {
        const state = EditorState.create({
          doc: content || '',
          extensions: cmExtensions
        });
        viewRef.current = new EditorView({
          state,
          parent: editorParentRef.current
        });
      } else {
        viewRef.current.dispatch({
          changes: { from: 0, to: viewRef.current.state.doc.length, insert: content || '' }
        });
      }
    } catch (e) {
      console.error('Error creating/updating CodeMirror editor:', e);
    }

    return () => {
      if (viewRef.current) {
        try {
          viewRef.current.destroy();
          viewRef.current = null;
        } catch (e) {
          console.error('Error destroying CodeMirror editor:', e);
        }
      }
    };
  }, [content, cmExtensions]);

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
