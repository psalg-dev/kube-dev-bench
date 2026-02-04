import { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

export default function HelmNotesTab({ namespace, releaseName }) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    AppAPI.GetHelmReleaseNotes(namespace, releaseName)
      .then((data) => {
        setNotes(data || 'No notes available for this release.');
      })
      .catch((err) => {
        setNotes(`Error loading notes: ${err.message || err}`);
      })
      .finally(() => setLoading(false));
  }, [namespace, releaseName]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading notes...</div>;
  }

  return (
    <div style={{ padding: 16, overflow: 'auto', height: '100%' }}>
      <pre style={{
        margin: 0,
        padding: 16,
        background: 'var(--gh-canvas-default, #0d1117)',
        border: '1px solid var(--gh-border, #30363d)',
        borderRadius: 6,
        color: 'var(--gh-text, #c9d1d9)',
        fontSize: 13,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace',
      }}>
        {notes}
      </pre>
    </div>
  );
}
