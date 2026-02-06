import { useEffect, useRef, useState } from 'react';
import TextViewerTab from '../layout/bottompanel/TextViewerTab';

type AggregateLogsTabProps = {
  title?: string;
  loadLogs?: () => Promise<unknown> | unknown;
  reloadKey?: string | number | boolean | null;
};

export default function AggregateLogsTab({
  title = 'Logs',
  loadLogs,
  reloadKey,
}: AggregateLogsTabProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
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
