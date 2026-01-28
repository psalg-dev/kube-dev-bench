import { useEffect, useState } from 'react';
import { GetSwarmStackComposeYAML } from '../../swarmApi.js';
import YamlTab from '../../../layout/bottompanel/YamlTab.jsx';

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

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ 
        padding: '10px 16px', 
        color: 'var(--gh-text-secondary, #8b949e)', 
        fontSize: 12,
        borderBottom: '1px solid var(--gh-border, #30363d)',
        backgroundColor: 'var(--gh-bg-alt, #161b22)',
        flexShrink: 0,
      }}>
        This compose is derived from current service specs and is not source-of-truth.
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <YamlTab content={yaml} loading={loading} error={error} />
      </div>
    </div>
  );
}
