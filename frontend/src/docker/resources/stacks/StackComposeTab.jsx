import React, { useEffect, useState } from 'react';
import { GetSwarmStackComposeYAML } from '../../swarmApi.js';

export default function StackComposeTab({ stackName }) {
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const y = await GetSwarmStackComposeYAML(stackName);
        if (!active) return;
        setYaml(y || '');
      } catch (e) {
        if (!active) return;
        setError(String(e));
        setYaml('');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [stackName]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--gh-text-secondary, #8b949e)' }}>
        Loading compose...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: '#f85149' }}>
        Failed to load compose: {error}
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: 16 }}>
      <div style={{ marginBottom: 10, color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12 }}>
        This compose is derived from current service specs and is not source-of-truth.
      </div>
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
        {yaml || '(empty)'}
      </pre>
    </div>
  );
}
