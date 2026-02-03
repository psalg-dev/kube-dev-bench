import { useMemo } from 'react';
import CodeMirrorEditor from '../../components/CodeMirrorEditor';
import { getCodeMirrorLanguageExtensions } from '../../utils/codeMirrorLanguage.js';

export default function TextViewerTab({
  content,
  filename,
  loading = false,
  error = null,
  loadingLabel = 'Loading...'
}) {
  const languageExtensions = useMemo(
    () => getCodeMirrorLanguageExtensions(filename, content),
    [filename, content]
  );

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
      <CodeMirrorEditor
        value={content || ''}
        language="yaml"
        languageExtensions={languageExtensions}
        readOnly={true}
        lineNumbers={true}
        foldGutter={true}
        lineWrapping={true}
        highlightActiveLine={false}
        height="100%"
      />
    </div>
  );
}
