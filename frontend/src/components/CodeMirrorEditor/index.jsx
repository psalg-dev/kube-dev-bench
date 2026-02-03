/**
 * CodeMirror Editor - Lazy Loading Wrapper
 * 
 * This component provides lazy loading for CodeMirror to reduce initial bundle size.
 * CodeMirror packages (~50-80 KB gzipped) are only loaded when the editor is needed.
 * 
 * Usage:
 * ```jsx
 * import CodeMirrorEditor from '@/components/CodeMirrorEditor';
 * 
 * <CodeMirrorEditor
 *   value={yamlContent}
 *   onChange={setYamlContent}
 *   language="yaml"
 *   readOnly={false}
 * />
 * ```
 */
import { lazy, Suspense, forwardRef, useRef, useImperativeHandle } from 'react';
import EditorLoading from './EditorLoading';

// Lazy load the CodeMirror core implementation
const CodeMirrorCore = lazy(() => import('./CodeMirrorCore'));

/**
 * Lazy-loaded CodeMirror Editor
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
 * @param {Array} [props.languageExtensions] - Custom language extensions
 * @param {Array} [props.extensions] - Additional CodeMirror extensions
 * @param {boolean} [props.syncValue=true] - Sync value prop into the editor
 * @param {string} [props.placeholder] - Placeholder text when empty
 * @param {string} [props.height] - Height of the editor container
 * @param {string} [props.loadingMessage] - Custom loading message
 * @param {Function} [props.onFocus] - Callback when editor gains focus
 * @param {Function} [props.onBlur] - Callback when editor loses focus
 * @param {Function} [props.onViewReady] - Callback with CodeMirror view instance
 */
const CodeMirrorEditor = forwardRef(function CodeMirrorEditor({
  value = '',
  onChange,
  language = 'yaml',
  languageExtensions,
  extensions,
  syncValue = true,
  readOnly = false,
  lineNumbers = true,
  foldGutter = true,
  lineWrapping = true,
  highlightActiveLine = true,
  placeholder,
  height = '100%',
  loadingMessage = 'Loading editor...',
  onFocus,
  onBlur,
  onViewReady,
  className,
  style,
}, ref) {
  const coreRef = useRef(null);

  // Forward imperative handle from core component
  useImperativeHandle(ref, () => ({
    getView: () => coreRef.current?.getView?.(),
    getValue: () => coreRef.current?.getValue?.() || '',
    setValue: (newValue) => coreRef.current?.setValue?.(newValue),
    focus: () => coreRef.current?.focus?.(),
  }), []);

  return (
    <div style={{ height, ...style }} className={className}>
      <Suspense 
        fallback={
          <EditorLoading 
            height={height} 
            showLineNumbers={lineNumbers}
            message={loadingMessage}
          />
        }
      >
        <CodeMirrorCore
          ref={coreRef}
          value={value}
          onChange={onChange}
          language={language}
          languageExtensions={languageExtensions}
          extensions={extensions}
          syncValue={syncValue}
          readOnly={readOnly}
          lineNumbers={lineNumbers}
          foldGutter={foldGutter}
          lineWrapping={lineWrapping}
          highlightActiveLine={highlightActiveLine}
          placeholder={placeholder}
          onFocus={onFocus}
          onBlur={onBlur}
          onViewReady={onViewReady}
        />
      </Suspense>
    </div>
  );
});

export default CodeMirrorEditor;

// Also export EditorLoading for custom loading states
export { default as EditorLoading } from './EditorLoading';
