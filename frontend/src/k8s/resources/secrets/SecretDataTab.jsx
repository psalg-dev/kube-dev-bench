import React, { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

export default function SecretDataTab({ namespace, secretName }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleKeys, setVisibleKeys] = useState(new Set());
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    if (!namespace || !secretName) return;

    setLoading(true);
    setError(null);

    AppAPI.GetSecretDataByName(namespace, secretName)
      .then(result => {
        setData(result || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch secret data');
        setLoading(false);
      });
  }, [namespace, secretName]);

  const toggleVisibility = (key) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const copyToClipboard = async (key, value) => {
    try {
      // Decode base64 before copying
      const decoded = atob(value);
      await navigator.clipboard.writeText(decoded);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const decodeValue = (base64Value) => {
    try {
      return atob(base64Value);
    } catch {
      return '[Unable to decode]';
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
  }

  if (!data || data.length === 0) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>This Secret has no data.</div>;
  }

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: 'var(--gh-text-muted, #8b949e)', fontSize: 12 }}>
          {data.length} key{data.length !== 1 ? 's' : ''}
        </span>
        <span style={{
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 3,
          backgroundColor: '#f8514920',
          color: '#f85149'
        }}>
          Sensitive data - click eye icon to reveal
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #30363d' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)', width: 200 }}>Key</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Value</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)', width: 80 }}>Size</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)', width: 100 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const isVisible = visibleKeys.has(item.key);
            const decodedValue = isVisible ? decodeValue(item.value) : null;
            const isCopied = copiedKey === item.key;

            return (
              <tr key={item.key} style={{ borderBottom: '1px solid #21262d' }}>
                <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)', fontFamily: 'monospace' }}>
                  {item.key}
                  {item.isBinary && (
                    <span style={{
                      marginLeft: 8,
                      fontSize: 10,
                      padding: '1px 4px',
                      borderRadius: 2,
                      backgroundColor: '#f8514920',
                      color: '#f85149'
                    }}>
                      binary
                    </span>
                  )}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  {isVisible ? (
                    <pre style={{
                      margin: 0,
                      padding: 8,
                      backgroundColor: '#0d1117',
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: 'var(--gh-text, #c9d1d9)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: 150,
                      overflow: 'auto'
                    }}>
                      {decodedValue}
                    </pre>
                  ) : (
                    <span style={{ color: 'var(--gh-text-muted, #8b949e)', fontFamily: 'monospace' }}>
                      {'•'.repeat(Math.min(20, item.size))}
                    </span>
                  )}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--gh-text-muted, #8b949e)', fontSize: 12 }}>
                  {formatSize(item.size)}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                    <button
                      onClick={() => toggleVisibility(item.key)}
                      title={isVisible ? 'Hide value' : 'Show value'}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'transparent',
                        border: '1px solid #30363d',
                        borderRadius: 4,
                        color: 'var(--gh-text, #c9d1d9)',
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      {isVisible ? '👁️' : '👁️‍🗨️'}
                    </button>
                    <button
                      onClick={() => copyToClipboard(item.key, item.value)}
                      title="Copy decoded value"
                      style={{
                        padding: '4px 8px',
                        backgroundColor: isCopied ? '#23863620' : 'transparent',
                        border: `1px solid ${isCopied ? '#238636' : '#30363d'}`,
                        borderRadius: 4,
                        color: isCopied ? '#238636' : 'var(--gh-text, #c9d1d9)',
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      {isCopied ? '✓' : '📋'}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
