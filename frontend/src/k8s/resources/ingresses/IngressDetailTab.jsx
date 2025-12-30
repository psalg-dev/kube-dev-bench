import React, { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

export default function IngressDetailTab({ namespace, ingressName }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!namespace || !ingressName) return;

    setLoading(true);
    setError(null);

    AppAPI.GetIngressDetail(namespace, ingressName)
      .then(data => {
        setDetail(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch ingress details');
        setLoading(false);
      });
  }, [namespace, ingressName]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
  }

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      {/* Routes section */}
      <h4 style={{ color: 'var(--gh-text, #c9d1d9)', marginBottom: 12 }}>Routing Rules</h4>
      {!detail?.rules || detail.rules.length === 0 ? (
        <div style={{ color: 'var(--gh-text-muted, #8b949e)', marginBottom: 20 }}>No routing rules defined.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Host</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Path</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Path Type</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Service</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Port</th>
            </tr>
          </thead>
          <tbody>
            {detail.rules.map((rule, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #21262d' }}>
                <td style={{ padding: '8px 12px' }}>
                  {rule.host ? (
                    <a
                      href={`https://${rule.host}${rule.path || ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#58a6ff', textDecoration: 'none' }}
                    >
                      {rule.host}
                    </a>
                  ) : (
                    <span style={{ color: 'var(--gh-text-muted, #8b949e)' }}>*</span>
                  )}
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)', fontFamily: 'monospace' }}>
                  {rule.path || '/'}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 3,
                    backgroundColor: '#21262d',
                    color: 'var(--gh-text-muted, #8b949e)'
                  }}>
                    {rule.pathType}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', color: '#58a6ff', fontFamily: 'monospace' }}>
                  {rule.serviceName}
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)' }}>
                  {rule.servicePort}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* TLS section */}
      <h4 style={{ color: 'var(--gh-text, #c9d1d9)', marginBottom: 12 }}>TLS Configuration</h4>
      {!detail?.tls || detail.tls.length === 0 ? (
        <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            backgroundColor: '#f8514920',
            border: '1px solid #f8514940',
            borderRadius: 4
          }}>
            <span>⚠️</span>
            <span>No TLS configured - traffic is not encrypted</span>
          </span>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Hosts</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Secret</th>
            </tr>
          </thead>
          <tbody>
            {detail.tls.map((tls, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #21262d' }}>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {tls.hosts && tls.hosts.map((host, hidx) => (
                      <span
                        key={hidx}
                        style={{
                          padding: '2px 8px',
                          backgroundColor: '#23863620',
                          border: '1px solid #23863640',
                          borderRadius: 4,
                          color: '#2ea44f',
                          fontSize: 12
                        }}
                      >
                        🔒 {host}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '8px 12px', color: '#58a6ff', fontFamily: 'monospace' }}>
                  {tls.secretName || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
