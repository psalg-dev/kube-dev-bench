import { useEffect, useState } from 'react';
import { GetSwarmSecretUsage } from '../../swarmApi.js';

export default function SecretUsedBySection({ secretId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [services, setServices] = useState([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const usage = await GetSwarmSecretUsage(secretId);
        if (!active) return;
        setServices(Array.isArray(usage) ? usage : []);
      } catch (e) {
        if (!active) return;
        setServices([]);
        setError(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [secretId]);

  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, color: 'var(--gh-text, #c9d1d9)', marginBottom: 8 }}>
        Used By
      </div>

      {loading ? (
        <div style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>Loading…</div>
      ) : null}

      {error ? (
        <div style={{ color: '#f85149' }}>Failed to load usage: {error}</div>
      ) : null}

      {!loading && !error ? (
        services.length === 0 ? (
          <div style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>No services reference this secret.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {services
              .slice()
              .sort((a, b) => String(a?.serviceName || '').localeCompare(String(b?.serviceName || '')))
              .map((svc) => (
                <div
                  key={svc.serviceId || svc.serviceName}
                  style={{
                    padding: '6px 8px',
                    border: '1px solid var(--gh-border, #30363d)',
                    background: 'var(--gh-input-bg, #0d1117)',
                    color: 'var(--gh-text, #c9d1d9)',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    wordBreak: 'break-word',
                  }}
                >
                  {svc.serviceName || svc.serviceId}
                </div>
              ))}
          </div>
        )
      ) : null}
    </div>
  );
}
