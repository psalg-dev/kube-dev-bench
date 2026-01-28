import { useEffect, useRef, useState } from 'react';
import TextViewerTab from '../layout/bottompanel/TextViewerTab';

export default function AggregateLogsTab({
  title = 'Logs',
  loadLogs,
  reloadKey,
}) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadLogsRef = useRef(loadLogs);

  useEffect(() => {
    loadLogsRef.current = loadLogs;
  }, [loadLogs]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const loader = loadLogsRef.current;
      if (typeof loader !== 'function') {
        setError('Logs loader not configured');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await loader();
        if (cancelled) return;
        setContent(String(res ?? ''));
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          height: 44,
          padding: '0 12px',
          borderBottom: '1px solid var(--gh-border, #30363d)',
          display: 'flex',
          alignItems: 'center',
          fontWeight: 600,
        }}
      >
        {title}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <TextViewerTab
          content={content}
          loading={loading}
          error={error}
          loadingLabel={`Loading ${title}...`}
        />
      </div>
    </div>
  );
}
