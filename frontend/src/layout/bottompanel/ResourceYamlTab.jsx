import { useCallback, useEffect, useState } from 'react';
import YamlTab from './YamlTab';

export default function ResourceYamlTab({
  name,
  loadYaml,
  isReady = true,
  title,
}) {
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!isReady) return;
    setLoading(true);
    setError(null);
    try {
      const res = await loadYaml();
      setYaml(res || '');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [isReady, loadYaml]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yaml);
    } catch {}
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([yaml], { type: 'text/yaml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name}.yaml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--gh-border, #30363d)',
          background: 'var(--gh-bg-sidebar, #161b22)',
          flexShrink: 0,
        }}
      >
        <span style={{ color: 'var(--gh-text, #c9d1d9)' }}>
          {title || `YAML for ${name}`}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={load}
            style={{
              padding: '6px 10px',
              background: 'var(--gh-input-bg, #21262d)',
              border: '1px solid var(--gh-border, #30363d)',
              color: 'var(--gh-text, #c9d1d9)',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
          <button
            onClick={handleCopy}
            style={{
              padding: '6px 10px',
              background: 'var(--gh-input-bg, #21262d)',
              border: '1px solid var(--gh-border, #30363d)',
              color: 'var(--gh-text, #c9d1d9)',
              cursor: 'pointer',
            }}
          >
            Copy
          </button>
          <button
            onClick={handleDownload}
            style={{
              padding: '6px 10px',
              background: 'var(--gh-input-bg, #21262d)',
              border: '1px solid var(--gh-border, #30363d)',
              color: 'var(--gh-text, #c9d1d9)',
              cursor: 'pointer',
            }}
          >
            Download
          </button>
        </div>
      </div>
      <div
        style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}
      >
        <YamlTab content={yaml} loading={loading} error={error} />
      </div>
    </div>
  );
}
