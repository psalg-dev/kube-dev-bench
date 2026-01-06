import React, { useEffect, useState } from 'react';
import TextViewerTab from '../../../layout/bottompanel/TextViewerTab.jsx';
import { GetSwarmVolumeInspectJSON } from '../../swarmApi.js';

export default function VolumeInspectTab({ volumeName }) {
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
        const json = await GetSwarmVolumeInspectJSON(volumeName);
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
  }, [volumeName]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <TextViewerTab
        content={content}
        loading={loading}
        error={error}
        loadingLabel="Loading volume inspect..."
        filename={`${volumeName}.json`}
      />
    </div>
  );
}
