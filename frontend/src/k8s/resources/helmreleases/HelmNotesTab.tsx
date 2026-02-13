import { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

type HelmNotesTabProps = {
  namespace?: string;
  releaseName?: string;
};

export default function HelmNotesTab({ namespace, releaseName }: HelmNotesTabProps) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadNotes = async () => {
      if (active) {
        setLoading(true);
      }
      try {
        const data = await AppAPI.GetHelmReleaseNotes(namespace ?? '', releaseName ?? '');
        if (active) {
          setNotes(data || 'No notes available for this release.');
        }
      } catch (err: unknown) {
        if (active) {
          const message = err instanceof Error ? err.message : String(err);
          setNotes(`Error loading notes: ${message}`);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    loadNotes();
    return () => {
      active = false;
    };
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