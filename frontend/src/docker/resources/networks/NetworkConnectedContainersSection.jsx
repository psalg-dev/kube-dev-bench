import React, { useEffect, useState } from 'react';
import { GetSwarmNetworkContainers } from '../../swarmApi.js';

export default function NetworkConnectedContainersSection({ networkId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const data = await GetSwarmNetworkContainers(networkId);
        if (!active) return;
        setTasks(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!active) return;
        setTasks([]);
        setError(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [networkId]);

  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, color: 'var(--gh-text, #c9d1d9)', marginBottom: 8 }}>
        Containers (Tasks)
      </div>

      <div style={{ color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12, marginBottom: 10 }}>
        Swarm attaches tasks (containers) to networks.
      </div>

      {loading ? (
        <div style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>Loading…</div>
      ) : null}

      {error ? (
        <div style={{ color: '#f85149' }}>Failed to load containers: {error}</div>
      ) : null}

      {!loading && !error ? (
        tasks.length === 0 ? (
          <div style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>
            No tasks are attached to this network.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {tasks.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: '6px 8px',
                  border: '1px solid var(--gh-border, #30363d)',
                  background: 'var(--gh-input-bg, #0d1117)',
                  color: 'var(--gh-text, #c9d1d9)',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  wordBreak: 'break-word',
                  display: 'grid',
                  gap: 2,
                }}
              >
                <div>
                  {t.serviceName || t.serviceId}
                  {t.slot ? <span style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>  #{t.slot}</span> : null}
                </div>
                <div style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>
                  task {t.id} · {t.state || '-'} / {t.desiredState || '-'} · node {t.nodeName || t.nodeId || '-'}
                </div>
                {t.containerId ? (
                  <div style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>container {t.containerId}</div>
                ) : null}
                {t.error ? (
                  <div style={{ color: '#f85149' }}>{t.error}</div>
                ) : null}
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
