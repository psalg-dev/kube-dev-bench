import React, { useEffect, useState } from 'react';
import { GetSwarmConfigData } from '../../swarmApi.js';

export default function ConfigDataTab({ configId, configName }) {
  const [data, setData] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const content = await GetSwarmConfigData(configId);
        if (active) {
          setData(content || '');
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load config data:', err);
        if (active) {
          setError(err.toString());
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [configId]);

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
        Loading config data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#f85149' }}>
        Failed to load config data: {error}
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: 16 }}>
      <pre
        style={{
          margin: 0,
          padding: 16,
          backgroundColor: 'var(--gh-input-bg, #0d1117)',
          border: '1px solid var(--gh-border, #30363d)',
          borderRadius: 6,
          color: 'var(--gh-text, #c9d1d9)',
          fontSize: 13,
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {data || '(empty)'}
      </pre>
    </div>
  );
}
