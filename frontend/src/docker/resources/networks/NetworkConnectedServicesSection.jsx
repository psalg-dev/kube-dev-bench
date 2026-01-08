import React, { useEffect, useState } from 'react';
import { GetSwarmNetworkServices } from '../../swarmApi.js';

export default function NetworkConnectedServicesSection({ networkId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [services, setServices] = useState([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const data = await GetSwarmNetworkServices(networkId);
        if (!active) return;
        setServices(Array.isArray(data) ? data : []);
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
  }, [networkId]);

  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, color: 'var(--gh-text, #c9d1d9)', marginBottom: 8 }}>
        Connected Services
      </div>

      {loading ? (
        <div style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>Loading…</div>
      ) : null}

      {error ? (
        <div style={{ color: '#f85149' }}>Failed to load services: {error}</div>
      ) : null}

      {!loading && !error ? (
        services.length === 0 ? (
          <div style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>
            No services are attached to this network.
          </div>
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
