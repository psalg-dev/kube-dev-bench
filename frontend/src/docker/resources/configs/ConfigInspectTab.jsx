import { useEffect, useState } from 'react';
import TextViewerTab from '../../../layout/bottompanel/TextViewerTab.jsx';
import { GetSwarmConfigInspectJSON } from '../../swarmApi.js';

export default function ConfigInspectTab({ configId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setContent('');

    (async () => {
      try {
        const json = await GetSwarmConfigInspectJSON(configId);
        if (!active) return;
        setContent(String(json || ''));
      } catch (e) {
        if (!active) return;
        setError(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [configId]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <TextViewerTab
        content={content}
        loading={loading}
        error={error}
        loadingLabel="Loading config inspect..."
        filename={`${configId}.json`}
      />
    </div>
  );
}
