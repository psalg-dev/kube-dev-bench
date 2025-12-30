import React, { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';

// Simple syntax detection for common formats
const detectSyntax = (content, key) => {
  const ext = key.split('.').pop()?.toLowerCase();
  if (ext === 'json' || ext === 'js') return 'json';
  if (ext === 'yaml' || ext === 'yml') return 'yaml';
  if (ext === 'xml') return 'xml';
  if (ext === 'properties' || ext === 'ini' || ext === 'conf') return 'properties';
  if (ext === 'sh' || ext === 'bash') return 'shell';

  // Try to detect from content
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.includes(':') && (trimmed.includes('\n  ') || trimmed.includes('\n-'))) return 'yaml';

  return 'text';
};

const getSyntaxColor = (syntax) => {
  switch (syntax) {
    case 'json': return '#f1e05a';
    case 'yaml': return '#cb171e';
    case 'xml': return '#e44b23';
    case 'properties': return '#89e051';
    case 'shell': return '#89e051';
    default: return '#8b949e';
  }
};

export default function ConfigMapDataTab({ namespace, configMapName }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState(new Set());

  useEffect(() => {
    if (!namespace || !configMapName) return;

    setLoading(true);
    setError(null);

    AppAPI.GetConfigMapDataByName(namespace, configMapName)
      .then(result => {
        setData(result || []);
        setLoading(false);
        // Auto-expand first key if only one
        if (result && result.length === 1) {
          setExpandedKeys(new Set([result[0].key]));
        }
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch configmap data');
        setLoading(false);
      });
  }, [namespace, configMapName]);

  const toggleExpand = (key) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
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
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>This ConfigMap has no data.</div>;
  }

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 8, color: 'var(--gh-text-muted, #8b949e)', fontSize: 12 }}>
        {data.length} key{data.length !== 1 ? 's' : ''}
      </div>
      {data.map((item) => {
        const isExpanded = expandedKeys.has(item.key);
        const syntax = detectSyntax(item.value, item.key);
        const displayValue = item.isBinary
          ? `[Binary data - ${formatSize(item.size)}]`
          : item.value;

        return (
          <div key={item.key} style={{ marginBottom: 8, border: '1px solid #30363d', borderRadius: 6 }}>
            <div
              onClick={() => toggleExpand(item.key)}
              style={{
                padding: '10px 12px',
                backgroundColor: '#161b22',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: isExpanded ? '1px solid #30363d' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--gh-text-muted, #8b949e)', width: 16 }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span style={{ color: 'var(--gh-text, #c9d1d9)', fontWeight: 500 }}>{item.key}</span>
                <span style={{
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 3,
                  backgroundColor: getSyntaxColor(syntax) + '20',
                  color: getSyntaxColor(syntax),
                  textTransform: 'uppercase'
                }}>
                  {syntax}
                </span>
                {item.isBinary && (
                  <span style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 3,
                    backgroundColor: '#f8514920',
                    color: '#f85149'
                  }}>
                    binary
                  </span>
                )}
              </div>
              <span style={{ color: 'var(--gh-text-muted, #8b949e)', fontSize: 12 }}>
                {formatSize(item.size)}
              </span>
            </div>
            {isExpanded && (
              <pre style={{
                margin: 0,
                padding: 12,
                backgroundColor: '#0d1117',
                overflow: 'auto',
                maxHeight: 400,
                fontSize: 12,
                fontFamily: 'monospace',
                color: 'var(--gh-text, #c9d1d9)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {displayValue}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
