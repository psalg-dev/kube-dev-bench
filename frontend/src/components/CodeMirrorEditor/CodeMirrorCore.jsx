/**
 * CodeMirror Core Implementation
 * 
 * This file contains the actual CodeMirror editor implementation.
 * It's loaded lazily to reduce the initial bundle size.
 * 
 * All @codemirror/* imports are contained here to enable code splitting.
 */
import { useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { EditorView, lineNumbers, highlightActiveLineGutter, keymap, drawSelection, highlightSpecialChars, rectangularSelection, crosshairCursor, dropCursor } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { yaml as yamlLang } from '@codemirror/lang-yaml';
import { json as jsonLang } from '@codemirror/lang-json';
import { foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import './CodeMirrorCore.css';

// Language map for lazy loading language support
const LANGUAGE_MAP = {
  yaml: yamlLang,
  yml: yamlLang,
  json: jsonLang,
};

/**
 * Creates the default dark theme matching GitHub's color scheme
 */
function createDarkTheme() {
  return EditorView.theme({
    '&': {
      backgroundColor: 'var(--gh-bg, #0d1117)',
      color: 'var(--gh-text, #c9d1d9)',
    },
    '&.cm-editor': {
      height: '100%',
      width: '100%',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-content': {
      caretColor: 'var(--gh-accent, #58a6ff)',
      textAlign: 'left',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--gh-accent, #58a6ff)',
    },
    '.cm-line': {
      textAlign: 'left',
    },
    '.cm-scroller': {
      fontFamily: 'var(--gh-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)',
      lineHeight: '1.45',
      fontSize: '13px',
    },
    '.cm-whitespace': {
      opacity: 0.35,
    },
    '.cm-gutters': {
      background: 'var(--gh-bg-alt, #161b22)',
      color: 'var(--gh-text-muted, #8b949e)',
      borderRight: '1px solid var(--gh-border, #30363d)',
    },
    '.cm-gutterElement': {
      padding: '0 8px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--gh-bg-alt, #161b22)',
      color: 'var(--gh-text, #c9d1d9)',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(56, 139, 253, 0.1)',
    },
    '.cm-selectionBackground': {
      backgroundColor: 'rgba(56, 139, 253, 0.3)',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: 'rgba(56, 139, 253, 0.4)',
    },
    '.cm-matchingBracket': {
      backgroundColor: 'rgba(63, 185, 80, 0.2)',
      outline: '1px solid var(--gh-success-fg, #3fb950)',
    },
    '.cm-foldGutter span': {
      color: 'var(--gh-text-muted, #8b949e)',
    },
    '.cm-foldGutter span:hover': {
      color: 'var(--gh-text, #c9d1d9)',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'var(--gh-bg-alt, #161b22)',
      border: '1px solid var(--gh-border, #30363d)',
      color: 'var(--gh-text-secondary, #8b949e)',
    },
  }, { dark: true });
}

/**
 * CodeMirror Core Component
 * 
 * @param {Object} props
 * @param {string} props.value - Editor content
 * @param {Function} [props.onChange] - Callback when content changes
 * @param {string} [props.language='yaml'] - Language mode (yaml, json)
 * @param {boolean} [props.readOnly=false] - Whether editor is read-only
 * @param {boolean} [props.lineNumbers=true] - Show line numbers
 * @param {boolean} [props.foldGutter=true] - Show fold gutter
 * @param {boolean} [props.lineWrapping=true] - Enable line wrapping
 * @param {boolean} [props.highlightActiveLine=true] - Highlight active line
 * @param {string} [props.placeholder] - Placeholder text when empty
 * @param {Function} [props.onFocus] - Callback when editor gains focus
 * @param {Function} [props.onBlur] - Callback when editor loses focus
 */
const CodeMirrorCore = forwardRef(function CodeMirrorCore({
  value = '',
  onChange,
  language = 'yaml',
  languageExtensions,
  extensions: additionalExtensions = [],
  syncValue = true,
  readOnly = false,
  lineNumbers: showLineNumbers = true,
  foldGutter: showFoldGutter = true,
  lineWrapping = true,
  highlightActiveLine = true,
  placeholder,
  onFocus,
  onBlur,
  onViewReady,
  className,
  style,
}, ref) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const readOnlyCompartment = useRef(new Compartment());
  const languageCompartment = useRef(new Compartment());

  // Create dark theme (memoized)
  const darkTheme = useMemo(() => createDarkTheme(), []);

  // Get language extension
  const getLanguageExtension = useCallback(() => {
    if (languageExtensions) {
      return languageExtensions;
    }
    const langFn = LANGUAGE_MAP[language.toLowerCase()];
    return langFn ? langFn() : [];
  }, [language, languageExtensions]);

  // Build extensions array
  const editorExtensions = useMemo(() => {
    const exts = [
      darkTheme,
      languageCompartment.current.of(getLanguageExtension()),
      readOnlyCompartment.current.of([
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(readOnly),
      ]),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightSelectionMatches(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap,
        indentWithTab,
      ]),
    ];

    if (showLineNumbers) {
      exts.push(lineNumbers());
    }

    if (showFoldGutter) {
      exts.push(foldGutter());
    }

    if (highlightActiveLine) {
      exts.push(highlightActiveLineGutter());
    }

    if (lineWrapping) {
      exts.push(EditorView.lineWrapping);
    }

    if (indentOnInput) {
      exts.push(indentOnInput());
    }

    if (Array.isArray(additionalExtensions) && additionalExtensions.length > 0) {
      exts.push(...additionalExtensions);
    }

    // Change listener
    if (onChange) {
      exts.push(EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }));
    }

    // Focus/blur listeners
    if (onFocus || onBlur) {
      exts.push(EditorView.domEventHandlers({
        focus: onFocus,
        blur: onBlur,
      }));
    }

    return exts;
  }, [darkTheme, getLanguageExtension, readOnly, showLineNumbers, showFoldGutter, highlightActiveLine, lineWrapping, onChange, onFocus, onBlur, additionalExtensions]);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current || viewRef.current) return;

    try {
      const state = EditorState.create({
        doc: value || '',
        extensions: editorExtensions,
      });

      viewRef.current = new EditorView({
        state,
        parent: containerRef.current,
      });
      if (typeof onViewReady === 'function') {
        onViewReady(viewRef.current);
      }
    } catch (e) {
      console.error('Error creating CodeMirror editor:', e);
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Update value when prop changes
  useEffect(() => {
    if (!syncValue) return;
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (value !== currentDoc) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: value || '',
        },
      });
    }
  }, [value, syncValue]);

  // Update readOnly state
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: readOnlyCompartment.current.reconfigure([
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(readOnly),
      ]),
    });
  }, [readOnly]);

  // Update language
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: languageCompartment.current.reconfigure(getLanguageExtension()),
    });
  }, [language, getLanguageExtension, languageExtensions]);

  // Expose imperative handle for parent component access
  useImperativeHandle(ref, () => ({
    getView: () => viewRef.current,
    getValue: () => viewRef.current?.state.doc.toString() || '',
    setValue: (newValue) => {
      const view = viewRef.current;
      if (!view) return;
      const currentDoc = view.state.doc.toString();
      if (newValue !== currentDoc) {
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: newValue || '' },
        });
      }
    },
    focus: () => viewRef.current?.focus(),
  }), []);

  return (
    <div 
      ref={containerRef} 
      className={`codemirror-core ${className || ''}`}
      style={style}
    />
  );
});

export default CodeMirrorCore;
