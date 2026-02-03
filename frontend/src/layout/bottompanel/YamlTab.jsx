import CodeMirrorEditor from '../../components/CodeMirrorEditor';

/**
 * Reusable YAML viewer component using CodeMirror
 * @param {string} content - The YAML content to display
 * @param {boolean} loading - Whether content is loading
 * @param {string} error - Error message if any
 */
export default function YamlTab({ content, loading = false, error = null }) {
  return (
    <div style={{ height: '100%', width: '100%', overflow: 'hidden', position: 'relative' }}>
      <CodeMirrorEditor
        value={content || ''}
        language="yaml"
        readOnly={true}
        lineNumbers={true}
        foldGutter={true}
        lineWrapping={true}
        highlightActiveLine={false}
        height="100%"
      />

      {loading && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: 12,
          padding: '6px 10px',
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid var(--gh-border, #30363d)',
          color: 'var(--gh-text-muted, #8b949e)',
          fontSize: 12
        }}>
          Loading YAML...
        </div>
      )}

      {error && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: 12,
          padding: '6px 10px',
          background: 'rgba(248,81,73,0.12)',
          border: '1px solid rgba(248,81,73,0.4)',
          color: '#f85149',
          fontSize: 12,
          maxWidth: 'calc(100% - 24px)'
        }}>
          <div style={{ marginBottom: 4 }}>Error loading YAML:</div>
          <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{error}</div>
        </div>
      )}
    </div>
  );
}
