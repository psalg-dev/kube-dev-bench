export default function PVAnnotationsTab({ annotations }) {
  const ann = annotations || {};
  const entries = Object.entries(ann);

  if (!entries.length) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>No annotations.</div>;
  }

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <table className="panel-table">
        <thead>
          <tr>
            <th style={{ width: 320 }}>Key</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {entries
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => (
              <tr key={k}>
                <td style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', verticalAlign: 'top' }}>{k}</td>
                <td style={{ wordBreak: 'break-all' }}>{String(v ?? '') || '-'}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
