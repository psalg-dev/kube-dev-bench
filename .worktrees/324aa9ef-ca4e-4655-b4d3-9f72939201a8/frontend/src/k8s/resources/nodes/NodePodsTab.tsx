import { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import type { app } from '../../../../wailsjs/go/models';

type NodePodsTabProps = {
  nodeName: string;
};

export default function NodePodsTab({ nodeName }: NodePodsTabProps) {
  const [pods, setPods] = useState<app.PodInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!nodeName) {
        setPods([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const list = await AppAPI.GetPodsOnNode(nodeName);
        if (mounted) setPods(Array.isArray(list) ? list : []);
      } catch (err) {
        if (mounted) setError(String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [nodeName]);

  if (loading) {
    return <div style={{ padding: 12 }}>Loading pods on node…</div>;
  }
  if (error) {
    return <div style={{ padding: 12, color: 'var(--gh-danger, #f85149)' }}>{error}</div>;
  }
  if (!pods.length) {
    return <div style={{ padding: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>No pods found on this node.</div>;
  }

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>Namespace</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>Pod</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>Status</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>Restarts</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>Uptime</th>
          </tr>
        </thead>
        <tbody>
          {pods.map((pod) => (
            <tr key={`${pod.namespace}/${pod.name}`}>
              <td style={{ borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>{pod.namespace}</td>
              <td style={{ borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>{pod.name}</td>
              <td style={{ borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>{pod.status || '-'}</td>
              <td style={{ borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>{pod.restarts ?? 0}</td>
              <td style={{ borderBottom: '1px solid var(--gh-border, #30363d)', padding: '6px 8px' }}>{pod.uptime || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
