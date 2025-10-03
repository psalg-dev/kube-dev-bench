import React, { useEffect, useRef, useMemo } from 'react';
import { EditorView, lineNumbers, highlightActiveLineGutter, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { yaml as yamlLang } from '@codemirror/lang-yaml';
import { foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

/**
 * Reusable YAML viewer component using CodeMirror
 * @param {string} content - The YAML content to display
 * @param {boolean} loading - Whether content is loading
 * @param {string} error - Error message if any
 */
export default function YamlViewer({ content, loading = false, error = null }) {
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
        // Update existing editor content
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: content || ''
          }
        });
      }
    } catch (e) {
      console.error('Error creating/updating CodeMirror editor:', e);
    }

    // Cleanup function
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
        color: '#8b949e',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        Loading YAML...
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
        <div style={{ marginBottom: 8 }}>Error loading YAML:</div>
        <div style={{ fontSize: '14px' }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <div
        ref={editorParentRef}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
}
