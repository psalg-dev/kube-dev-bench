import { useEffect, useRef, useMemo } from 'react';
import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  keymap,
} from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { yaml as yamlLang } from '@codemirror/lang-yaml';
import {
  foldGutter,
  foldKeymap,
  syntaxHighlighting,
  defaultHighlightStyle,
} from '@codemirror/language';

/**
 * Reusable YAML viewer component using CodeMirror
 * @param {string} content - The YAML content to display
 * @param {boolean} loading - Whether content is loading
 * @param {string} error - Error message if any
 */
export default function YamlTab({ content, loading = false, error = null }) {
  const editorParentRef = useRef(null);
  const viewRef = useRef(null);

  const cmTheme = useMemo(
    () =>
      EditorView.theme(
        {
          '&': {
            backgroundColor: 'var(--gh-bg, #0d1117)',
            color: 'var(--gh-text, #c9d1d9)',
          },
          '&.cm-editor': { height: '100%', width: '100%' },
          '.cm-content': { caretColor: 'transparent', textAlign: 'left' },
          '.cm-line': { textAlign: 'left' },
          '.cm-scroller': {
            fontFamily:
              'var(--gh-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
            lineHeight: '1.45',
          },
          '.cm-whitespace': { opacity: 0.35 },
          '.cm-gutters': {
            background: 'var(--gh-bg-alt, #161b22)',
            color: 'var(--gh-text-muted, #8b949e)',
            borderRight: '1px solid var(--gh-border, #30363d)',
          },
          '.cm-gutterElement': { padding: '0 8px' },
        },
        { dark: true },
      ),
    [],
  );

  const cmExtensions = useMemo(
    () => [
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
    ],
    [cmTheme],
  );

  // Initialize CodeMirror once (avoid destroy/recreate on content changes)
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
      console.error('Error creating CodeMirror YAML editor:', e);
    }

    return () => {
      if (viewRef.current) {
        try {
          viewRef.current.destroy();
        } catch (e) {
          console.error('Error destroying CodeMirror YAML editor:', e);
        } finally {
          viewRef.current = null;
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmExtensions]);

  // Update existing editor content when `content` changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const next = content || '';
    const current = view.state.doc.toString();
    if (current === next) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: next } });
  }, [content]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div ref={editorParentRef} style={{ height: '100%', width: '100%' }} />

      {loading && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            padding: '6px 10px',
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid var(--gh-border, #30363d)',
            color: 'var(--gh-text-muted, #8b949e)',
            fontSize: 12,
          }}
        >
          Loading YAML...
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            padding: '6px 10px',
            background: 'rgba(248,81,73,0.12)',
            border: '1px solid rgba(248,81,73,0.4)',
            color: '#f85149',
            fontSize: 12,
            maxWidth: 'calc(100% - 24px)',
          }}
        >
          <div style={{ marginBottom: 4 }}>Error loading YAML:</div>
          <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{error}</div>
        </div>
      )}
    </div>
  );
}
