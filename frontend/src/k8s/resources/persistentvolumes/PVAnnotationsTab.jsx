import React from 'react';

export default function PVAnnotationsTab({ annotations }) {
  const ann = annotations || {};
  const entries = Object.entries(ann);

  if (!entries.length) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>No annotations.</div>;
  }

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #30363d' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)', width: 320 }}>Key</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--gh-text-muted, #8b949e)' }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {entries
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => (
              <tr key={k} style={{ borderBottom: '1px solid #21262d' }}>
                <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)', fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', verticalAlign: 'top' }}>{k}</td>
                <td style={{ padding: '8px 12px', color: 'var(--gh-text, #c9d1d9)', wordBreak: 'break-all' }}>{String(v ?? '') || '-'}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
